import fs from "node:fs";
import path from "node:path";
import { mapLimit, statOrNull, toSafePath } from "./fsutils";

export interface TreeNode {
  rel: string;
  type: "file" | "dir";
  size: number;
  mtimeMs: number;
}

export interface WalkResult {
  entries: TreeNode[];
  warnings: string[];
  totalFiles: number;
}

interface Enumerated {
  rel: string;
  kind: "file" | "dir";
  abs: string;
}

export interface WalkOptions {
  isIgnored: (rel: string) => boolean;
  includeHidden: boolean;
  /** Called once enumeration finishes so callers can report totals. */
  onEnumerated?: (count: number) => void;
}

const HASH_CONCURRENCY = 16;

async function enumerate(
  root: string,
  isIgnored: (rel: string) => boolean,
  includeHidden: boolean,
  warnings: string[],
): Promise<Enumerated[]> {
  const safeRoot = toSafePath(root);
  const items: Enumerated[] = [];
  const seenDirs = new Set<string>();
  const stack: Array<{ rel: string; abs: string }> = [{ rel: "", abs: safeRoot }];

  while (stack.length) {
    const { rel, abs } = stack.pop()!;
    let dirents: fs.Dirent[];
    try {
      dirents = await fs.promises.readdir(abs, { withFileTypes: true });
    } catch (err) {
      warnings.push(`${rel || "·"} 读取失败: ${(err as Error).message}`);
      continue;
    }
    for (const d of dirents) {
      const name = d.name;
      if (!includeHidden && name.startsWith(".")) continue;
      const childRel = rel ? `${rel}/${name}` : name;
      if (isIgnored(childRel)) continue;
      const childAbs = path.join(abs, name);
      if (d.isDirectory()) {
        items.push({ rel: childRel, kind: "dir", abs: childAbs });
        stack.push({ rel: childRel, abs: childAbs });
      } else if (d.isFile()) {
        items.push({ rel: childRel, kind: "file", abs: childAbs });
      } else {
        // Symlink or special file: resolve so the type is correct, but stop
        // descending into symlinked dirs we have already visited (loop guard).
        const st = await statOrNull(childAbs);
        if (!st) {
          warnings.push(`${childRel} 无法访问`);
          continue;
        }
        if (st.isDirectory()) {
          items.push({ rel: childRel, kind: "dir", abs: childAbs });
          let real = childAbs;
          try {
            real = await fs.promises.realpath(toSafePath(childAbs));
          } catch {
            /* keep childAbs */
          }
          if (!seenDirs.has(real)) {
            seenDirs.add(real);
            stack.push({ rel: childRel, abs: childAbs });
          }
        } else {
          items.push({ rel: childRel, kind: "file", abs: childAbs });
        }
      }
    }
  }
  return items;
}

export async function walk(root: string, opts: WalkOptions): Promise<WalkResult> {
  const { isIgnored, includeHidden, onEnumerated } = opts;
  const warnings: string[] = [];
  const items = await enumerate(root, isIgnored, includeHidden, warnings);
  onEnumerated?.(items.length);

  items.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));

  const fileItems = items.filter((i) => i.kind === "file");
  const stats = await mapLimit(fileItems, HASH_CONCURRENCY, async (item) => {
    const st = await statOrNull(item.abs);
    return st ? { rel: item.rel, size: st.size, mtimeMs: st.mtimeMs, error: false } : { rel: item.rel, size: 0, mtimeMs: 0, error: true };
  });
  const byRel = new Map(stats.map((s) => [s.rel, s]));

  const entries: TreeNode[] = items.map((item) => {
    if (item.kind === "dir") return { rel: item.rel, type: "dir" as const, size: 0, mtimeMs: 0 };
    const st = byRel.get(item.rel);
    if (!st?.error) {
      return { rel: item.rel, type: "file" as const, size: st?.size ?? 0, mtimeMs: st?.mtimeMs ?? 0 };
    }
    warnings.push(`${item.rel} 无法读取`);
    return { rel: item.rel, type: "file" as const, size: 0, mtimeMs: 0 };
  });

  return { entries, warnings, totalFiles: fileItems.length };
}