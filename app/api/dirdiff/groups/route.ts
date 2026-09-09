import { NextRequest, NextResponse } from "next/server";
import { listGroups, saveGroup, deleteGroup, type GroupInput } from "@/lib/dirdiff/server/groups";

function parseBody(body: unknown): GroupInput | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const { id, name, left, right, ignore, includeHidden, ignoreDirs } = b;
  if (id !== undefined && typeof id !== "string") return null;
  if (typeof name !== "string" || typeof left !== "string" || typeof right !== "string") return null;
  const ignoreArr =
    Array.isArray(ignore) && ignore.every((s) => typeof s === "string") ? (ignore as string[]) : [];
  return { id, name, left, right, ignore: ignoreArr, includeHidden: includeHidden === true, ignoreDirs: ignoreDirs !== false };
}

export async function GET() {
  return NextResponse.json({ groups: await listGroups() });
}

export async function POST(req: NextRequest) {
  return upsert(req, false);
}

export async function PUT(req: NextRequest) {
  return upsert(req, true);
}

async function upsert(req: NextRequest, requiresId: boolean): Promise<Response> {
  const body = await req.json().catch(() => null);
  const input = parseBody(body);
  if (!input || (requiresId && !input.id)) {
    return NextResponse.json({ error: "参数不完整" }, { status: 400 });
  }
  try {
    const group = await saveGroup(input);
    return NextResponse.json({ group });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const id = (body as { id?: unknown } | null)?.id;
  if (typeof id !== "string" || !id) {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  }
  await deleteGroup(id);
  return NextResponse.json({ ok: true });
}