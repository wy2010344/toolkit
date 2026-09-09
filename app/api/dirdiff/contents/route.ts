import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { assertRelInside } from "@/lib/dirdiff/server/fsutils";
import { readTextFile, type ReadTextResult } from "@/lib/dirdiff/server/text";
import type { FileContent, FileContentsResponse } from "@/lib/dirdiff/types";

function toContent(res: ReadTextResult): FileContent {
  if (res.ok) return { kind: "text", text: res.text, truncated: res.truncated, size: res.size };
  if (res.reason === "error") return { kind: "error", size: res.size, message: res.message };
  return { kind: res.reason, size: res.size };
}

export async function POST(req: NextRequest): Promise<NextResponse<FileContentsResponse | { error: string }>> {
  const body: { left?: string; right?: string; rel?: string } = await req.json().catch(() => ({}));
  const { left, right, rel } = body;
  if (typeof left !== "string" || !left || typeof right !== "string" || !right || typeof rel !== "string" || !rel) {
    return NextResponse.json({ error: "参数不完整" }, { status: 400 });
  }
  try {
    assertRelInside(left, rel);
    assertRelInside(right, rel);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const [leftContent, rightContent] = await Promise.all([
    readTextFile(path.join(left, rel)),
    readTextFile(path.join(right, rel)),
  ]);
  return NextResponse.json({ left: toContent(leftContent), right: toContent(rightContent), rel });
}