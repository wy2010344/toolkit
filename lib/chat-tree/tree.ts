import type { ChatNode, Conversation } from "./types";

/** 建索引，避免在每个节点上反复 O(n) 扫全表。 */
export function indexNodes(nodes: ChatNode[]): Map<string, ChatNode> {
  return new Map(nodes.map((n) => [n.id, n]));
}

export function childrenOf(nodes: ChatNode[], parentId: string | null): ChatNode[] {
  return nodes.filter((n) => n.parentId === parentId);
}

/** 从根到目标节点（含目标）的追问链 —— 这个工具的核心「回溯」语义。 */
export function pathTo(nodes: ChatNode[], id: string): ChatNode[] {
  const map = indexNodes(nodes);
  const chain: ChatNode[] = [];
  let cur = map.get(id);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.push(cur);
    cur = cur.parentId ? map.get(cur.parentId) : undefined;
  }
  return chain.reverse();
}

/** 包含自身的整棵子树，删除分支时使用。 */
export function subtreeIds(nodes: ChatNode[], id: string): Set<string> {
  const byParent = new Map<string, ChatNode[]>();
  for (const n of nodes) {
    if (!n.parentId) continue;
    const list = byParent.get(n.parentId) ?? [];
    list.push(n);
    byParent.set(n.parentId, list);
  }
  const out = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    if (out.has(cur)) continue;
    out.add(cur);
    for (const child of byParent.get(cur) ?? []) stack.push(child.id);
  }
  return out;
}

export interface TreeStats {
  count: number;
  /** 有 2 个以上子节点的分叉点数量。 */
  forks: number;
  branches: number;
  maxDepth: number;
  leaves: number;
}

export function treeStats(nodes: ChatNode[]): TreeStats {
  const map = indexNodes(nodes);
  const childCount = new Map<string, number>();
  let forks = 0;
  let branches = 0;
  for (const n of nodes) {
    if (!n.parentId || !map.has(n.parentId)) continue;
    childCount.set(n.parentId, (childCount.get(n.parentId) ?? 0) + 1);
  }
  for (const c of childCount.values()) {
    if (c > 1) {
      forks += 1;
      branches += c - 1;
    }
  }
  let maxDepth = 0;
  for (const n of nodes) {
    let d = 0;
    let p = n.parentId ? map.get(n.parentId) : undefined;
    const seen = new Set<string>([n.id]);
    while (p && !seen.has(p.id)) {
      seen.add(p.id);
      d += 1;
      p = p.parentId ? map.get(p.parentId) : undefined;
    }
    maxDepth = Math.max(maxDepth, d);
  }
  return {
    count: nodes.length,
    forks,
    branches,
    maxDepth: maxDepth + 1,
    leaves: nodes.filter((n) => !childCount.has(n.id)).length,
  };
}

export function nextNodeId(nodes: ChatNode[]): string {
  const used = new Set(nodes.map((n) => n.id));
  let i = nodes.length + 1;
  while (used.has(`n-${i}`)) i += 1;
  return `n-${i}`;
}

export function nowLabel(): { time: string; date: string } {
  const d = new Date();
  const pad = (v: number) => String(v).padStart(2, "0");
  return {
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
  };
}

/** 把「从开场到当前节点」这一条追问链导出成可带走的 Markdown。 */
export function pathToMarkdown(conversation: Conversation, id: string): string {
  const chain = pathTo(conversation.nodes, id);
  const lines = [
    `# ${conversation.title}`,
    "",
    `> 从对话树中导出的单条追问链 · 共 ${chain.length} 轮 · ${conversation.nodes.length} 个节点中的一条路径`,
    "",
  ];
  chain.forEach((n, i) => {
    lines.push(`## ${i + 1}. ${n.prompt}`, "");
    lines.push(n.answer.trim(), "");
    if (n.model) lines.push(`<sub>${n.model} · ${n.date} ${n.time}${n.badge ? ` · ${n.badge}` : ""}</sub>`, "");
  });
  return lines.join("\n");
}
