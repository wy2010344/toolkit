import fs from "node:fs";
import { NextRequest } from "next/server";
import { compareDirs } from "@/lib/dirdiff/server/compare";
import type { CompareRequest } from "@/lib/dirdiff/types";

export const maxDuration = 300;

function isDir(p: unknown): p is string {
  if (typeof p !== "string" || !p.trim()) return false;
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as CompareRequest | null;
  const encoder = new TextEncoder();

  if (!body || !isDir(body.left) || !isDir(body.right)) {
    return new Response(
      encoder.encode(JSON.stringify({ type: "error", message: "请填写两个存在的目录路径" }) + "\n"),
      { status: 200, headers: { "content-type": "application/x-ndjson; charset=utf-8" } },
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        const result = await compareDirs(
          {
            left: body.left.trim(),
            right: body.right.trim(),
            ignore: body.ignore ?? [],
            includeHidden: body.includeHidden ?? false,
            includeEqual: body.includeEqual ?? false,
          },
          (p) => send({ type: "progress", ...p }),
        );
        send({ type: "done", result });
      } catch (err) {
        send({ type: "error", message: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8" },
  });
}