import type { ChatNode, Conversation, Revision } from "./types";

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

/** 节点当前展示的版本；无版本历史时返回 null（单版本走顶层字段）。 */
export function activeRevisionOf(node: ChatNode): Revision | null {
  const list = node.revisions;
  if (!list?.length) return null;
  const i = Math.min(Math.max(node.activeRevision ?? 0, 0), list.length - 1);
  return list[i]!;
}

/** 节点当前展示的问题与回答元信息 —— 所有读取问题 / 回答的地方都走这里。 */
export function answerOf(
  node: ChatNode,
): Pick<Revision, "answer" | "model" | "time" | "date" | "synthetic" | "pending"> & { prompt: string } {
  const rev = activeRevisionOf(node);
  return rev
    ? {
        prompt: rev.prompt,
        answer: rev.answer,
        model: rev.model,
        time: rev.time,
        date: rev.date,
        synthetic: rev.synthetic ?? node.synthetic,
        pending: rev.pending ?? node.pending,
      }
    : { prompt: node.prompt, answer: node.answer, model: node.model, time: node.time, date: node.date, synthetic: node.synthetic, pending: node.pending };
}

/**
 * 追加一个版本。prompt 是用户编辑后的新问题：它写进版本，也同步到节点顶层。
 * 旧节点首次修改时先把当前问题 / 回答收作第 1 版。
 */
export function withRevision(
  node: ChatNode,
  prompt: string,
  answer: string,
  model: string,
  time: string,
  date: string,
  reason: string,
  synthetic = model === "本地模板",
): ChatNode {
  const first: Revision = {
    id: `${node.id}-r1`,
    prompt: node.prompt,
    answer: node.answer,
    model: node.model,
    time: node.time,
    date: node.date,
    reason: "首次提问",
  };
  const revisions = [...(node.revisions?.length ? node.revisions : [first])];
  const next: Revision = {
    id: `${node.id}-r${revisions.length + 1}`,
    prompt,
    answer,
    model,
    time,
    date,
    reason,
    synthetic,
    pending: answer === "",
  };
  revisions.push(next);
  return {
    ...node,
    revisions,
    activeRevision: revisions.length - 1,
    prompt,
    answer,
    model,
    time,
    date,
    synthetic,
    pending: answer === "",
  };
}

/** 切换当前版本，并同步顶层字段（搜索 / 复制 / 导出都读顶层）。 */
export function setActiveRevision(node: ChatNode, index: number): ChatNode {
  if (!node.revisions?.length || index < 0 || index >= node.revisions.length) return node;
  const chosen = node.revisions![index]!;
  return {
    ...node,
    activeRevision: index,
    prompt: chosen.prompt,
    answer: chosen.answer,
    model: chosen.model,
    time: chosen.time,
    date: chosen.date,
    synthetic: chosen.synthetic ?? node.synthetic,
    pending: chosen.pending ?? node.pending,
  };
}

/** 版本伪节点的稳定 id：不占用真实节点 id，也不会和 n-1 这类自增 id 撞车。 */
export function revisionNodeId(ownerId: string, index: number): string {
  return `rev:${ownerId}:${index}`;
}

export function isRevisionNode(node: ChatNode): boolean {
  return !!node.revisionRef;
}

/**
 * 构造画布专用的显示节点。关键语义：
 * - 版本不是提问的子节点，而是与提问**同层**的兄弟；当前版本仍由原节点表示，
 *   其余版本派生为带 `revisionRef` 的伪节点，父节点沿用原节点的父节点。
 * - 子节点通过 `parentRevision` 认领父提问的某一版：展开后挂到那一版（含自己的整棵后继树），
 *   不跟随、也不继承其他版本；未标注的旧数据默认挂在父节点的当前版。
 * - 派生结果只进画布布局，不写回会话数据。
 */
export function buildDisplayNodes(nodes: ChatNode[], expandedIds: Set<string>): ChatNode[] {
  const owners = new Map(nodes.map((n) => [n.id, n]));
  const pseudo = new Map<string, ChatNode>();
  const out: ChatNode[] = [];

  // 先按原顺序铺节点：每个提问前插它的历史版本兄弟，保证版本链在兄弟槽里相邻。
  for (const node of nodes) {
    if (expandedIds.has(node.id)) {
      node.revisions?.forEach((rev, index) => {
        if (index === (node.activeRevision ?? 0)) return;
        const id = revisionNodeId(node.id, index);
        const versionNode: ChatNode = {
          id,
          parentId: node.parentId,
          // 版本卡片展示这一版自己的问题，让人一眼看出「改了哪一问」。
          prompt: rev.prompt,
          answer: rev.answer,
          model: rev.model,
          time: rev.time,
          date: rev.date,
          synthetic: rev.synthetic,
          pending: rev.pending,
          hidden: node.hidden,
          collapsed: node.collapsed,
          revisionRef: { ownerId: node.id, index },
        };
        pseudo.set(`${node.id}:${index}`, versionNode);
        out.push(versionNode);
      });
    }
    out.push(node);
  }

  // 再把每个子节点改挂到它真正跟随的版本上；当前版仍用原节点承接。
  return out.map((node) => {
    if (!node.parentId || node.revisionRef || node.parentRevision == null) return node;
    const parent = owners.get(node.parentId);
    if (!parent || node.parentRevision === (parent.activeRevision ?? 0)) return node;
    const target = pseudo.get(`${parent.id}:${node.parentRevision}`);
    return target ? { ...node, parentId: target.id } : node;
  });
}

/** 隐藏分支及其整棵子树的 id —— 父分支隐藏时后代一并从画布剔除。 */
export function hiddenIds(nodes: ChatNode[]): Set<string> {
  const out = new Set<string>();
  for (const n of nodes) {
    if (n.hidden) for (const id of subtreeIds(nodes, n.id)) out.add(id);
  }
  return out;
}

/** 真正参与画布布局的节点；打开「显示隐藏分支」后返回全量。 */
export function visibleNodes(nodes: ChatNode[], showHidden: boolean): ChatNode[] {
  if (showHidden) return nodes;
  const hidden = hiddenIds(nodes);
  return nodes.filter((n) => !hidden.has(n.id));
}

/** 顶层隐藏分支数量（已隐藏的后代不重复计数）。 */
export function hiddenBranchCount(nodes: ChatNode[]): number {
  const map = indexNodes(nodes);
  return nodes.filter((n) => n.hidden && !(n.parentId && map.get(n.parentId)?.hidden)).length;
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
    const a = answerOf(n);
    const version = n.revisions?.length ? ` · 第 ${(n.activeRevision ?? 0) + 1}/${n.revisions.length} 版` : "";
    lines.push(`## ${i + 1}. ${a.prompt}`, "");
    lines.push(a.answer.trim(), "");
    if (a.model) lines.push(`<sub>${a.model} · ${a.date} ${a.time}${version}</sub>`, "");
  });
  return lines.join("\n");
}
