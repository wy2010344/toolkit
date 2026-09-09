import path from "node:path";
import type { CompareEntry, CompareRequest, CompareResult, EntryStatus } from "../types";
import { mapLimit, sha1File } from "./fsutils";
import { buildIgnoreChecker } from "./ignore";
import { MAX_DIFF_FETCH_BYTES, sniffText } from "./text";
import { walk } from "./walk";

export interface ProgressEvent {
  phase: "walk" | "hash";
  done: number;
  total: number;
  label?: string;
}

const keyOf = (rel: string) =>
  process.platform === "win32" || process.platform === "darwin" ? rel.toLowerCase() : rel;

interface PendingPair {
  rel: string;
  leftAbs: string;
  rightAbs: string;
}

export async function compareDirs(
  req: CompareRequest,
  onProgress?: (e: ProgressEvent) => void,
): Promise<CompareResult> {
  const started = Date.now();
  const isIgnored = buildIgnoreChecker(req.ignore);

  const counts: number[] = [];
  const emitWalk = (i: number, label: string) => {
    const done = (counts[0] ?? 0) + (counts[1] ?? 0);
    onProgress?.({ phase: "walk", done, total: -1, label });
  };
  const [left, right] = await Promise.all([
    walk(req.left, {
      isIgnored,
      includeHidden: req.includeHidden,
      onEnumerated: (c) => {
        counts[0] = c;
        emitWalk(0, req.left);
      },
    }),
    walk(req.right, {
      isIgnored,
      includeHidden: req.includeHidden,
      onEnumerated: (c) => {
        counts[1] = c;
        emitWalk(1, req.right);
      },
    }),
  ]);

  const leftMap = new Map(left.entries.map((e) => [keyOf(e.rel), e]));
  const rightMap = new Map(right.entries.map((e) => [keyOf(e.rel), e]));
  const allKeys = new Set([...leftMap.keys(), ...rightMap.keys()]);

  const pending: PendingPair[] = [];
  const entries: CompareEntry[] = [];

  for (const key of allKeys) {
    const leftNode = leftMap.get(key);
    const rightNode = rightMap.get(key);

    if (leftNode && rightNode) {
      if (leftNode.type === "dir" && rightNode.type === "dir") {
        continue; // both sides have this dir; the files inside carry the differences
      }
      if (leftNode.type !== rightNode.type) {
        entries.push({
          rel: leftNode.rel,
          type: leftNode.type,
          status: "conflict",
          left: metaOf(leftNode),
          right: metaOf(rightNode),
        });
        continue;
      }
      if (leftNode.size !== rightNode.size) {
        entries.push({
          rel: leftNode.rel,
          type: "file",
          status: "modified",
          left: metaOf(leftNode),
          right: metaOf(rightNode),
        });
        continue;
      }
      pending.push({
        rel: leftNode.rel,
        leftAbs: path.join(req.left, leftNode.rel),
        rightAbs: path.join(req.right, rightNode.rel),
      });
      continue;
    }

    const node = leftNode ?? rightNode!;
    const status: EntryStatus = leftNode ? "left-only" : "right-only";
    entries.push({
      rel: node.rel,
      type: node.type,
      status,
      ...(leftNode ? { left: metaOf(node) } : { right: metaOf(node) }),
    });
  }

  // Hash the same-size pairs to separate equal from modified.
  let hashed = 0;
  const hashedPairs = await mapLimit(pending, 8, async (p) => {
    let leftHash: string | null = null;
    let rightHash: string | null = null;
    let err: string | undefined;
    try {
      leftHash = await sha1File(p.leftAbs);
      rightHash = await sha1File(p.rightAbs);
    } catch (e) {
      err = (e as Error).message;
    }
    hashed++;
    onProgress?.({ phase: "hash", done: hashed, total: pending.length });
    return { rel: p.rel, leftHash, rightHash, err };
  });

  for (const h of hashedPairs) {
    const leftNode = leftMap.get(keyOf(h.rel))!;
    const rightNode = rightMap.get(keyOf(h.rel))!;
    if (h.err || h.leftHash !== h.rightHash) {
      entries.push({
        rel: h.rel,
        type: "file",
        status: "modified",
        left: metaOf(leftNode),
        right: metaOf(rightNode),
        error: h.err,
      });
    } else if (req.includeEqual ?? false) {
      entries.push({
        rel: h.rel,
        type: "file",
        status: "equal",
        left: metaOf(leftNode),
        right: metaOf(rightNode),
      });
    }
  }

  // Sniff text-comparability for the files we may open in a modal.
  const toSniff = entries.filter(
    (e) =>
      e.type === "file" &&
      (e.left?.size ?? 0) <= MAX_DIFF_FETCH_BYTES &&
      (e.right?.size ?? 0) <= MAX_DIFF_FETCH_BYTES,
  );
  const sniffResults = await mapLimit(toSniff, 8, async (e) => ({
    rel: e.rel,
    left: await sniffText(path.join(req.left, e.rel)).catch(() => false),
    right: await sniffText(path.join(req.right, e.rel)).catch(() => false),
  }));
  const sniffMap = new Map(sniffResults.map((s) => [s.rel, s]));
  for (const e of entries) {
    const s = sniffMap.get(e.rel);
    if (s && e.left) e.left.isText = s.left;
    if (s && e.right) e.right.isText = s.right;
  }

  entries.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));

  const stats = { "left-only": 0, "right-only": 0, modified: 0, equal: 0, conflict: 0 };
  for (const e of entries) stats[e.status]++;

  return {
    entries,
    stats,
    hashed,
    totalScanned: (counts[0] ?? 0) + (counts[1] ?? 0),
    durationMs: Date.now() - started,
    warnings: [...left.warnings, ...right.warnings],
  };
}

function metaOf(node: { size: number; mtimeMs: number }) {
  return { size: node.size, mtimeMs: node.mtimeMs };
}