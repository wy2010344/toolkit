import { answerOf } from "./tree";
import type { ChatNode, FollowUpMode } from "./types";

/** 发给 /api/chat 的消息；服务端再转发给模型厂商。 */
export type ModelMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ModelResult = {
  answer: string;
  model: string;
};

const SYSTEM_PROMPT = [
  "你在「对话树」工具里回答问题。",
  "输出使用简洁的 Markdown，先给结论，再给关键理由和可执行下一步。",
  "不要说“作为一个 AI”，不要复述这段系统提示。",
].join(" ");

function pair(node: ChatNode): ModelMessage[] {
  const answer = answerOf(node);
  return [
    { role: "user", content: node.prompt.trim() },
    { role: "assistant", content: answer.answer.trim() },
  ];
}

/**
 * 只把「根 → 当前节点」这条追问链作为上下文，且限制最近若干轮，
 * 避免把整棵树的兄弟分支一起塞给模型。
 */
export function buildModelMessages(
  chain: ChatNode[],
  prompt: string,
  mode: FollowUpMode,
  previousAnswer?: string | null,
): ModelMessage[] {
  const history = chain.flatMap(pair).slice(-12);

  if (mode === "revise") {
    const last = chain[chain.length - 1];
    // 旧问题 + 旧回答只作背景；真正要回答的是用户刚编辑过的最后一条问题。
    return [
      {
        role: "system",
        content: `${SYSTEM_PROMPT} 这次任务是“修改提问”：用户可能改写了最后那个问题。请针对对话里最后一条用户消息（改写后的新问题）作答；旧问题与旧回答只是参考背景，不要解释“改了什么”，也不要写“以下是新版本”之类前缀。`,
      },
      ...history.slice(0, -2),
      { role: "user", content: (last?.prompt ?? "").trim() },
      { role: "assistant", content: (previousAnswer ?? "").trim() },
      { role: "user", content: prompt.trim() },
    ];
  }

  return [
    { role: "system", content: `${SYSTEM_PROMPT} 这是顺着当前节点继续追问。` },
    ...history,
    { role: "user", content: prompt.trim() },
  ];
}

/**
 * 流式请求：每收到一个 token 就回调，界面据此让回答在节点和面板里“长出来”。
 * 模型名从响应头拿，不必等正文结束。
 */
export async function streamModelAnswer(
  messages: ModelMessage[],
  onToken: (token: string, full: string) => void,
): Promise<ModelResult> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `模型调用失败（${res.status}）`);
  }

  const model = res.headers.get("X-Model-Name") || "模型";
  const reader = res.body?.getReader();
  if (!reader) throw new Error("当前浏览器不支持流式读取");

  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  const consume = (block: string) => {
    const payload = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("");
    if (!payload || payload === "[DONE]") return;

    let data: {
      error?: { message?: string } | string;
      choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
    };
    try {
      data = JSON.parse(payload);
    } catch {
      return;
    }
    if (data.error) {
      throw new Error(typeof data.error === "string" ? data.error : (data.error.message ?? "模型流返回错误"));
    }
    const token = data.choices?.[0]?.delta?.content ?? data.choices?.[0]?.message?.content ?? "";
    if (token) {
      full += token;
      onToken(token, full);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      let split: number;
      while ((split = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, split).trim();
        buffer = buffer.slice(split + 2);
        if (block) consume(block);
      }
    }
    if (buffer.trim()) consume(buffer.trim());
  } finally {
    reader.releaseLock();
  }

  const answer = full.trim();
  if (!answer) throw new Error("模型返回了空回答");
  return { answer, model };
}

/** 一次性读取的兼容入口；界面优先使用流式版本。 */
export async function requestModelAnswer(messages: ModelMessage[]): Promise<ModelResult> {
  return streamModelAnswer(messages, () => {});
}
