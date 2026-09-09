import fs from "node:fs";
import path from "node:path";
import type { SyncDirection, SyncPlan, SyncRequest, SyncResult } from "../types";
import { copyFilePreservingMtime, mapLimit, removeEmptyAncestors, toSafePath } from "./fsutils";

const SYNC_CONCURRENCY = 8;

export function buildSyncPlan(req: SyncRequest, entries: SyncRequest["entries"]): SyncPlan {
  const copies: SyncPlan["copies"] = [];
  const deletions: SyncPlan["deletions"] = [];
  const skipped: SyncPlan["skipped"] = [];
  let copyBytes = 0;

  for (const e of entries) {
    if (e.status === "conflict") {
      skipped.push({ rel: e.rel, kind: "skip", reason: "文件与目录类型冲突,请手动处理" });
      continue;
    }
    if (e.status === "equal") continue;

    const srcHas =
      e.status === "modified" ||
      (req.direction === "left-to-right" && e.status === "left-only") ||
      (req.direction === "right-to-left" && e.status === "right-only");
    const tgtHas =
      e.status === "modified" ||
      (req.direction === "left-to-right" && e.status === "right-only") ||
      (req.direction === "right-to-left" && e.status === "left-only");

    if (srcHas) {
      copies.push({ rel: e.rel, kind: "copy" });
      copyBytes += e.size ?? 0;
    } else if (tgtHas) {
      if (req.deleteExtra) {
        deletions.push({ rel: e.rel, kind: "delete" });
      } else {
        skipped.push({ rel: e.rel, kind: "skip", reason: "目标侧独有,未选择删除" });
      }
    }
  }

  return { copies, deletions, skipped, copyBytes };
}

export async function executeSync(req: SyncRequest): Promise<SyncResult> {
  const sourceRoot = req.direction === "left-to-right" ? req.left : req.right;
  const targetRoot = req.direction === "left-to-right" ? req.right : req.left;
  const plan = buildSyncPlan(req, req.entries);

  const srcOf = (rel: string) => path.join(sourceRoot, rel);
  const dstOf = (rel: string) => path.join(targetRoot, rel);

  const applied: SyncResult["applied"] = [];
  const failed: SyncResult["failed"] = [];
  const byRel = new Map(req.entries.map((e) => [e.rel, e]));

  const dirDeletions = plan.deletions.filter((d) => byRel.get(d.rel)?.type === "dir");
  const coveredByDir = (rel: string) =>
    dirDeletions.some((d) => rel.startsWith(`${d.rel}/`));

  const copyTasks = plan.copies.map((c) => async () => {
    try {
      const entry = byRel.get(c.rel)!;
      if (entry.type === "dir") {
        await fs.promises.mkdir(toSafePath(dstOf(c.rel)), { recursive: true });
      } else {
        await copyFilePreservingMtime(srcOf(c.rel), dstOf(c.rel));
      }
      applied.push(c);
    } catch (err) {
      failed.push({ rel: c.rel, kind: "copy", reason: (err as Error).message });
    }
  });

  const deleteTasks = plan.deletions.map((d) => async () => {
    if (coveredByDir(d.rel)) return; // handled by the enclosing directory removal
    try {
      const entry = byRel.get(d.rel)!;
      if (entry.type === "dir") {
        await fs.promises.rm(toSafePath(dstOf(d.rel)), { recursive: true, force: true });
      } else {
        await fs.promises.unlink(toSafePath(dstOf(d.rel)));
        await removeEmptyAncestors(dstOf(d.rel), targetRoot);
      }
      applied.push(d);
    } catch (err) {
      failed.push({ rel: d.rel, kind: "delete", reason: (err as Error).message });
    }
  });

  await mapLimit(copyTasks, SYNC_CONCURRENCY, (t) => t());
  await mapLimit(deleteTasks, SYNC_CONCURRENCY, (t) => t());

  return { ...plan, applied, failed };
}

export type { SyncDirection };