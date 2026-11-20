import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IncomingMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const UPSTREAM_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
/** 主模型首字超过 5 秒就算慢启动，切备用模型；备用再给 8 秒。 */
const PRIMARY_FIRST_TOKEN_MS = 5000;
const FALLBACK_FIRST_TOKEN_MS = 8000;

function isMessage(value: unknown): value is IncomingMessage {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  return (
    (m.role === "system" || m.role === "user" || m.role === "assistant") &&
    typeof m.content === "string" &&
    m.content.trim().length > 0
  );
}

type OpenedStream =
  | { ok: true; model: string; reader: ReadableStreamDefaultReader<Uint8Array>; controller: AbortController }
  | { ok: false; status: number; detail: string };

type FirstChunk =
  | { kind: "data"; value: ReadableStreamReadResult<Uint8Array> }
  | { kind: "timeout" };

async function openUpstream(model: string, apiKey: string, messages: IncomingMessage[]): Promise<OpenedStream> {
  const controller = new AbortController();
  let upstream: Response;
  try {
    upstream = await fetch(UPSTREAM_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      // 流式：让第一个 token 一到就往前送，用户能看见回答在长。
      body: JSON.stringify({ model, messages, temperature: 0.7, stream: true }),
      signal: controller.signal,
    });
  } catch (error) {
    return { ok: false, status: 502, detail: error instanceof Error ? error.message : "连接模型失败" };
  }

  if (!upstream.ok) {
    const data = (await upstream.json().catch(() => ({}))) as { error?: { message?: string } | string };
    const detail =
      typeof data.error === "string" ? data.error : (data.error?.message ?? `上游返回 ${upstream.status}`);
    return { ok: false, status: upstream.status, detail };
  }

  const reader = upstream.body?.getReader();
  if (!reader) return { ok: false, status: 502, detail: "上游没有返回可读流" };
  return { ok: true, model, reader, controller };
}

/** 等首块时设 deadline：慢启动和报错一样，都该切到备用模型。 */
async function readWithDeadline(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  controller: AbortController,
  ms: number,
): Promise<FirstChunk> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<FirstChunk>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ kind: "timeout" });
    }, ms);
  });
  const first = reader
    .read()
    .then((value): FirstChunk => ({ kind: "data", value }))
    // abort 后 read() 会 reject；race 已经选了 timeout，这里兜住避免未处理拒绝。
    .catch((): FirstChunk => ({ kind: "timeout" }));
  try {
    return await Promise.race([first, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const rawMessages = (body as { messages?: unknown } | null)?.messages;
  if (!Array.isArray(rawMessages)) {
    return NextResponse.json({ error: "缺少 messages 数组" }, { status: 400 });
  }

  const messages = rawMessages.filter(isMessage).slice(-20);
  if (messages.length === 0) {
    return NextResponse.json({ error: "messages 里没有有效内容" }, { status: 400 });
  }

  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "服务端未配置 ZHIPU_API_KEY" }, { status: 500 });
  }

  const primaryModel = process.env.ZHIPU_MODEL?.trim() || "glm-4.7-flash";
  const fallbackModel = "glm-4-flash-250414";

  let opened = await openUpstream(primaryModel, apiKey, messages);
  // 免费模型偶发限流很常见；报错就先切到另一个免费模型。
  if (!opened.ok && fallbackModel !== primaryModel) {
    opened = await openUpstream(fallbackModel, apiKey, messages);
  }
  if (!opened.ok) {
    return NextResponse.json({ error: opened.detail }, { status: opened.status });
  }

  let first = await readWithDeadline(opened.reader, opened.controller, PRIMARY_FIRST_TOKEN_MS);
  if (first.kind === "timeout" && opened.model !== fallbackModel) {
    // 主模型没报错，只是慢：别让用户对着骨架屏干等，直接换备用模型。
    try {
      opened.reader.releaseLock();
    } catch {
      /* abort 后 reader 可能已经释放 */
    }
    opened = await openUpstream(fallbackModel, apiKey, messages);
    if (!opened.ok) {
      return NextResponse.json({ error: opened.detail }, { status: opened.status });
    }
    first = await readWithDeadline(opened.reader, opened.controller, FALLBACK_FIRST_TOKEN_MS);
  }
  if (first.kind === "timeout") {
    return NextResponse.json({ error: "模型首字响应超时，请稍后再试" }, { status: 504 });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const { reader, model, controller } = opened;
  const firstValue = first.kind === "data" && !first.value.done ? first.value.value : undefined;

  const stream = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      let buffer = "";
      let sawDone = false;
      const send = (block: string) => {
        // 上游一个事件可能包含注释行；只把 data: payload 继续往浏览器送。
        const payload = block
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("");
        if (!payload) return;
        if (payload === "[DONE]") sawDone = true;
        ctrl.enqueue(encoder.encode(`data: ${payload}\n\n`));
      };
      const feed = (value: Uint8Array) => {
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
        let split: number;
        while ((split = buffer.indexOf("\n\n")) >= 0) {
          const block = buffer.slice(0, split).trim();
          buffer = buffer.slice(split + 2);
          if (block) send(block);
        }
      };

      try {
        // 首块在建立响应前已经读到，先补发出去，避免开头的字被吞掉。
        if (firstValue) feed(firstValue);
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          feed(value);
        }
        if (buffer.trim()) send(buffer.trim());
      } catch (error) {
        const detail = error instanceof Error ? error.message : "流读取中断";
        ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ error: { message: detail } })}\n\n`));
      } finally {
        if (!sawDone) ctrl.enqueue(encoder.encode("data: [DONE]\n\n"));
        ctrl.close();
        reader.releaseLock();
        controller.abort();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Model-Name": model,
    },
  });
}
