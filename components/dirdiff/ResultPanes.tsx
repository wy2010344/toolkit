"use client";

import { useMemo, useState } from "react";
import { CaretDown, CaretRight, FileText, Folder, FolderOpen } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/components/ui";
import type { CompareEntry, EntryStatus } from "@/lib/dirdiff/types";

interface Row {
  rel: string;
  name: string;
  depth: number;
  isDir: boolean;
  leaf?: CompareEntry;
  leftPresent: boolean;
  rightPresent: boolean;
  status: EntryStatus;
  childCount: number;
}

interface DirMeta {
  a: boolean;
  b: boolean;
  count: number;
}

function pickStatus(a: boolean, b: boolean, dirty: boolean): EntryStatus {
  if (a && b) return dirty ? "modified" : "equal";
  if (a) return "left-only";
  if (b) return "right-only";
  return "equal";
}

interface Node {
  rel: string;
  name: string;
  leaf?: CompareEntry;
  children: Map<string, Node>;
}

function buildTree(entries: CompareEntry[]): { nodes: Node[]; dirMeta: Map<string, DirMeta> } {
  const root: Node = { rel: "", name: "", children: new Map() };
  const dirMeta = new Map<string, DirMeta>();

  const fileMeta = (e: CompareEntry, rel: string) => {
    const m = dirMeta.get(rel) ?? { a: false, b: false, count: 0 };
    if (e.left) m.a = true;
    if (e.right) m.b = true;
    dirMeta.set(rel, m);
  };
  const dirMetaFor = (rel: string): DirMeta => dirMeta.get(rel) ?? { a: false, b: false, count: 0 };

  for (const e of entries) {
    const segs = e.rel.split("/");
    let node = root;
    let prefix = "";
    for (let i = 0; i < segs.length; i++) {
      prefix = prefix ? `${prefix}/${segs[i]}` : segs[i];
      const last = i === segs.length - 1;
      let child = node.children.get(segs[i]);
      if (!child) {
        child = { rel: prefix, name: segs[i], children: new Map() };
        node.children.set(segs[i], child);
      }
      if (last) {
        child.leaf = e;
        if (e.type === "file") fileMeta(e, prefix);
        else fileMeta(e, prefix); // one-sided dir carries presence too
      } else {
        fileMeta(e, prefix); // ancestor presence
        dirMetaFor(prefix).count++;
      }
      node = child;
    }
  }

  // child counts for dirs (direct children only)
  const nodes: Node[] = [];
  const visit = (n: Node) => {
    nodes.push(n);
    n.children.forEach(visit);
  };
  visit(root);

  const countMap = new Map<string, number>();
  const countDirs = (n: Node): number => {
    let total = n.leaf && n.leaf.type === "file" ? 1 : 0;
    n.children.forEach((c) => {
      total += countDirs(c);
    });
    countMap.set(n.rel, total);
    return total;
  };
  countDirs(root);

  return { nodes, dirMeta };
}

export function ResultPanes({
  entries,
  leftLabel,
  rightLabel,
  onOpen,
}: {
  entries: CompareEntry[];
  leftLabel: string;
  rightLabel: string;
  onOpen: (e: CompareEntry) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const { rows, visibleCount } = useMemo(() => {
    const { nodes, dirMeta } = buildTree(entries);
    const rows: Row[] = [];

    const meta = (rel: string) => {
      const m = dirMeta.get(rel);
      return { a: m?.a ?? false, b: m?.b ?? false, count: m?.count ?? 0 };
    };

    const statusOf = (n: Node): EntryStatus => {
      if (n.leaf) {
        if (n.leaf.status !== "equal") return n.leaf.status;
        // dir that is equal on both sides cannot appear, but keep safe
        return "equal";
      }
      let dirty = false;
      for (const c of n.children.values()) {
        const s = statusOf(c);
        if (s === "modified" || s === "conflict") {
          dirty = true;
          break;
        }
      }
      const m = meta(n.rel);
      return pickStatus(m.a, m.b, dirty);
    };

    let count = 0;
    const flatten = (n: Node, depth: number) => {
      if (n === nodes[0]) {
        const kids = [...n.children.values()].sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0));
        kids.forEach((k) => flatten(k, 0));
        return;
      }
      const m = meta(n.rel);
      const row: Row = {
        rel: n.rel,
        name: n.name,
        depth,
        isDir: n.children.size > 0 || n.leaf?.type === "dir",
        leaf: n.leaf,
        leftPresent: m.a || n.leaf?.left != null,
        rightPresent: m.b || n.leaf?.right != null,
        status: statusOf(n),
        childCount: (n.children.size + (n.leaf && n.leaf.type === "file" ? 1 : 0)) || 0,
      };
      rows.push(row);
      count++;
      if (row.isDir && collapsed.has(n.rel)) return;
      const kids = [...n.children.values()].sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0));
      kids.forEach((k) => flatten(k, depth + 1));
    };
    flatten(nodes[0], 0);
    return { rows, visibleCount: count };
  }, [entries, collapsed]);

  const toggle = (rel: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(rel)) next.delete(rel);
      else next.add(rel);
      return next;
    });
  };

  if (rows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-[13px] text-faint">没有差异,两个目录内容一致!</p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" style={{ contain: "strict" }}>
      <div className="min-h-full min-w-full">
        <div className="sticky top-0 z-10 grid grid-cols-2 gap-px border-b border-line bg-line">
          {[leftLabel, rightLabel].map((n, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-canvas px-3 py-1.5">
              <span className={cn("h-1.5 w-1.5 rounded-full", i === 0 ? "bg-acc-blue-fg" : "bg-acc-yellow-fg")} />
              <span className="truncate font-mono text-[11px] text-muted">{n}</span>
            </div>
          ))}
        </div>

        {rows.map((row) => (
          <div key={row.rel} className="dirdiff-row grid grid-cols-2 gap-px border-b border-line/60 bg-line">
            <Cell
              side="left"
              row={row}
              collapsed={collapsed.has(row.rel)}
              onToggle={() => toggle(row.rel)}
              onOpen={row.leaf ? () => onOpen(row.leaf!) : undefined}
              isDir={row.isDir}
            />
            <Cell
              side="right"
              row={row}
              collapsed={collapsed.has(row.rel)}
              onToggle={() => toggle(row.rel)}
              onOpen={row.leaf ? () => onOpen(row.leaf!) : undefined}
              isDir={row.isDir}
            />
          </div>
        ))}

        <div className="px-3 py-2 font-mono text-[10.5px] text-faint">{visibleCount.toLocaleString("zh-CN")} 条</div>
      </div>
    </div>
  );
}

function Cell({
  side,
  row,
  collapsed,
  onToggle,
  onOpen,
  isDir,
}: {
  side: "left" | "right";
  row: Row;
  collapsed: boolean;
  onToggle: () => void;
  onOpen?: () => void;
  isDir: boolean;
}) {
  const present = side === "left" ? row.leftPresent : row.rightPresent;

  if (!present) {
    return <div className="bg-canvas/60" style={{ height: "100%" }} aria-hidden />;
  }

  const isFile = !isDir;
  const clickable = isFile && row.leaf != null && row.leaf.status !== "equal";

  const tintMap: Record<EntryStatus, string> = {
    "left-only": side === "left" ? "bg-acc-blue-bg/20" : "bg-surface",
    "right-only": side === "right" ? "bg-acc-yellow-bg/20" : "bg-surface",
    modified: "bg-acc-red-bg/15",
    conflict: "bg-acc-orange-bg/20",
    equal: "bg-surface",
  };
  const tint = tintMap[row.status];

  const inner = (
    <>
      {isDir ? (
        <span className="shrink-0 text-faint">
          {collapsed ? <CaretRight size={11} weight="bold" /> : <CaretDown size={11} weight="bold" />}
        </span>
      ) : (
        <span className="w-2.5 shrink-0" />
      )}
      <span className={cn("shrink-0", isDir ? (side === "left" ? "text-acc-blue-fg/70" : "text-acc-yellow-fg/70") : "text-faint")}>
        {isDir ? (collapsed ? <Folder size={13} weight="fill" /> : <FolderOpen size={13} weight="fill" />) : <FileText size={12} />}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink">{row.name}</span>
      {row.status === "modified" && isFile && (
        <span className="shrink-0 rounded-sm bg-acc-red-fg/10 px-1 font-mono text-[9px] font-bold text-acc-red-fg">≠</span>
      )}
      {isDir && row.childCount > 0 && (
        <span className="shrink-0 font-mono text-[10px] text-faint">{row.childCount}</span>
      )}
    </>
  );

  if (clickable) {
    return (
      <button
        onClick={onOpen}
        className={cn("flex min-w-0 items-center gap-1.5 py-[3px] pr-2 pl-2 text-left transition-colors hover:bg-ink/5", tint)}
        style={{ paddingLeft: 8 + row.depth * 16 }}
        title={row.rel}
      >
        {inner}
      </button>
    );
  }

  if (isDir) {
    return (
      <button
        onClick={onToggle}
        className={cn("flex min-w-0 items-center gap-1.5 py-[3px] pr-2 pl-2 text-left transition-colors hover:bg-ink/5", tint)}
        style={{ paddingLeft: 8 + row.depth * 16 }}
        title={row.rel}
        aria-expanded={!collapsed}
      >
        {inner}
      </button>
    );
  }

  return (
    <div
      className={cn("flex min-w-0 items-center gap-1.5 py-[3px] pr-2 pl-2", tint)}
      style={{ paddingLeft: 8 + row.depth * 16 }}
    >
      {inner}
    </div>
  );
}