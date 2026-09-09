import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { assertRelInside } from "@/lib/dirdiff/server/fsutils";
import { buildSyncPlan, executeSync } from "@/lib/dirdiff/server/sync";
import type { SyncDirection, SyncEntryInput, SyncPlan, SyncResult } from "@/lib/dirdiff/types";

interface SyncBody {
  left?: unknown;
  right?: unknown;
  direction?: unknown;
  deleteExtra?: unknown;
  dryRun?: unknown;
  entries?: unknown;
}

const DIRECTIONS = new Set<SyncDirection>(["left-to-right", "right-to-left"]);

function parseEntries(value: unknown): SyncEntryInput[] | null {
  if (!Array.isArray(value)) return null;
  const out: SyncEntryInput[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const e = item as Record<string, unknown>;
    if (typeof e.rel !== "string" || !e.rel || (e.type !== "file" && e.type !== "dir")) return null;
    const status = e.status;
    if (status !== "left-only" && status !== "right-only" && status !== "modified" && status !== "equal" && status !== "conflict") return null;
    out.push({
      rel: e.rel,
      type: e.type,
      status,
      size: typeof e.size === "number" ? e.size : undefined,
    });
  }
  return out;
}

export async function POST(req: NextRequest): Promise<Response> {
  const body = (await req.json().catch(() => null)) as SyncBody | null;
  const { left, right, direction, deleteExtra, dryRun, entries: rawEntries } = body ?? {};
  const entries = parseEntries(rawEntries);

  if (
    typeof left !== "string" || !left ||
    typeof right !== "string" || !right ||
    !DIRECTIONS.has(direction as SyncDirection) ||
    entries === null
  ) {
    return NextResponse.json({ error: "参数不完整" }, { status: 400 });
  }

  const [leftOk, rightOk] = await Promise.all([
    fs.promises.stat(left).then((s) => s.isDirectory()).catch(() => false),
    fs.promises.stat(right).then((s) => s.isDirectory()).catch(() => false),
  ]);
  if (!leftOk || !rightOk) {
    return NextResponse.json({ error: "目录不存在" }, { status: 400 });
  }

  const rels = new Set(entries.map((e) => e.rel));
  for (const rel of rels) {
    try {
      assertRelInside(left, rel);
      assertRelInside(right, rel);
    } catch {
      return NextResponse.json({ error: `非法路径: ${rel}` }, { status: 400 });
    }
  }

  const reqBody = {
    left,
    right,
    entries,
    direction: direction as SyncDirection,
    deleteExtra: deleteExtra === true,
    dryRun: dryRun === true,
  };

  try {
    if (reqBody.dryRun) {
      const plan: SyncPlan = buildSyncPlan(reqBody, entries);
      return NextResponse.json({ plan });
    }
    const result: SyncResult = await executeSync(reqBody);
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}