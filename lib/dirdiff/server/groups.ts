import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { DiffGroup } from "../types";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "dirdiff-groups.json");

async function readAll(): Promise<DiffGroup[]> {
  try {
    const raw = await fs.promises.readFile(FILE, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(clean).filter((g): g is DiffGroup => g !== null);
  } catch {
    return [];
  }
}

async function writeAll(groups: DiffGroup[]): Promise<void> {
  await fs.promises.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  await fs.promises.writeFile(tmp, JSON.stringify(groups, null, 2), "utf8");
  await fs.promises.rename(tmp, FILE);
}

export async function listGroups(): Promise<DiffGroup[]> {
  const groups = await readAll();
  groups.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return groups;
}

export type GroupInput = {
  id?: string;
  name: string;
  left: string;
  right: string;
  ignore: string[];
  includeHidden: boolean;
};

export async function saveGroup(input: GroupInput): Promise<DiffGroup> {
  const groups = await readAll();
  const now = Date.now();
  const base = {
    name: input.name.trim() || "未命名",
    left: input.left.trim(),
    right: input.right.trim(),
    ignore: dedupe(input.ignore.map((s) => s.trim()).filter(Boolean)),
    includeHidden: !!input.includeHidden,
  };

  if (input.id) {
    const idx = groups.findIndex((g) => g.id === input.id);
    if (idx === -1) throw new Error("该对比组不存在");
    const group: DiffGroup = { ...groups[idx], ...base, updatedAt: now };
    groups[idx] = group;
    await writeAll(groups);
    return group;
  }

  const group: DiffGroup = { ...base, id: randomUUID(), createdAt: now, updatedAt: now };
  groups.push(group);
  await writeAll(groups);
  return group;
}

export async function deleteGroup(id: string): Promise<void> {
  const groups = await readAll();
  const next = groups.filter((g) => g.id !== id);
  await writeAll(next);
}

function clean(value: unknown): DiffGroup | null {
  if (!value || typeof value !== "object") return null;
  const g = value as Record<string, unknown>;
  if (typeof g.id !== "string" || !g.id) return null;
  return {
    id: g.id,
    name: typeof g.name === "string" ? g.name || "未命名" : "未命名",
    left: typeof g.left === "string" ? g.left : "",
    right: typeof g.right === "string" ? g.right : "",
    ignore: Array.isArray(g.ignore) ? g.ignore.filter((s): s is string => typeof s === "string") : [],
    includeHidden: g.includeHidden === true,
    createdAt: typeof g.createdAt === "number" ? g.createdAt : 0,
    updatedAt: typeof g.updatedAt === "number" ? g.updatedAt : 0,
  };
}

function dedupe(items: string[]): string[] {
  return [...new Set(items)];
}