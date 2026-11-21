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
 * 这个子节点此刻真正挂在父提问的哪一版下面。
 *
 * `parentRevision` 是永久锚点（最初是在哪一版之后追问的）；`followRevision`
 * 是用户显式批准的跟随目标，且只对「父节点当前版」有效。当前版一换，批准就过期，
 * 自动退回锚点 —— 所以永远不会悄悄把旧版的子树归档到新版下。
 */
export function attachedRevisionOf(node: ChatNode, parent: ChatNode): number {
  const active = parent.activeRevision ?? 0;
  const origin = node.parentRevision ?? active;
  return node.followRevision != null && node.followRevision === active ? active : origin;
}

/**
 * 构造画布专用的显示节点。关键语义：
 * - 版本不是提问的子节点，而是与提问**同层**的兄弟；当前版本仍由原节点表示，
 *   其余版本派生为带 `revisionRef` 的伪节点，父节点沿用原节点的父节点。
 * - 每个后继节点按 `attachedRevisionOf` 挂到它真正归属的那一版。历史版本即使没有
 *   「展开版本」，只要有后继挂在上面，也照样派生出伪节点来承接 —— 不会掉回当前版。
 * - 历史版本卡片、以及挂在历史版本上的整棵子树都标 `versionState: "archived"`，
 *   在画布上一起置灰；已批准跟随当前版的子树根标 `"following"`。
 * - 派生结果只进画布布局，不写回会话数据。
 */
export function buildDisplayNodes(nodes: ChatNode[], expandedIds: Set<string>): ChatNode[] {
  const owners = new Map(nodes.map((n) => [n.id, n]));
  const activeOf = (id: string) => owners.get(id)?.activeRevision ?? 0;

  // 1. 先算出每个节点实际归属的版本，以及哪些版本必须派生出伪节点来承接子树。
  const attached = new Map<string, number>();
  const needed = new Map<string, Set<number>>();
  const needRevision = (ownerId: string, index: number) => {
    const set = needed.get(ownerId) ?? new Set<number>();
    set.add(index);
    needed.set(ownerId, set);
  };
  for (const node of nodes) {
    if (!node.parentId) continue;
    const parent = owners.get(node.parentId);
    if (!parent) continue;
    const index = attachedRevisionOf(node, parent);
    attached.set(node.id, index);
    if (index !== (parent.activeRevision ?? 0)) needRevision(parent.id, index);
  }
  for (const id of expandedIds) {
    const owner = owners.get(id);
    owner?.revisions?.forEach((_, i) => {
      if (i !== (owner.activeRevision ?? 0)) needRevision(id, i);
    });
  }

  // 2. 铺节点：每个提问前插它需要展示的历史版本兄弟，保证版本链在兄弟槽里相邻。
  const pseudo = new Map<string, ChatNode>();
  const out: ChatNode[] = [];
  for (const node of nodes) {
    const indices = [...(needed.get(node.id) ?? [])].sort((a, b) => a - b);
    for (const index of indices) {
      const rev = node.revisions?.[index];
      if (!rev) continue;
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
        // 历史版本本身就按「历史态」显示，和挂在它下面的子树一致。
        versionState: "archived",
      };
      pseudo.set(`${node.id}:${index}`, versionNode);
      out.push(versionNode);
    }
    out.push(node);
  }

  // 3. 改挂到归属版本；挂不上去时宁可保持原位，也绝不静默归档到当前版。
  const reparented = out.map((node) => {
    if (node.revisionRef || !node.parentId) return node;
    const index = attached.get(node.id);
    if (index == null) return node;
    if (index === activeOf(node.parentId)) {
      return node.followRevision === activeOf(node.parentId)
        ? { ...node, versionState: "following" as const }
        : node;
    }
    const target = pseudo.get(`${node.parentId}:${index}`);
    // 目标版本不存在也不退回当前版：至少保持灰显，让用户能右键批准跟随。
    return target ? { ...node, parentId: target.id, versionState: "archived" as const } : { ...node, versionState: "archived" as const };
  });

  // 4. archived 沿真实父子链继承：灰色子树里不该冒出一个亮着的后代。
  const map = new Map(reparented.map((n) => [n.id, n]));
  const children = new Map<string, ChatNode[]>();
  for (const node of reparented) {
    if (!node.parentId) continue;
    const list = children.get(node.parentId) ?? [];
    list.push(node);
    children.set(node.parentId, list);
  }
  const walk = (node: ChatNode) => {
    for (const child of children.get(node.id) ?? []) {
      if (node.versionState === "archived" && child.versionState !== "archived") {
        const next = { ...child, versionState: "archived" as const };
        map.set(child.id, next);
        walk(next);
      } else walk(child);
    }
  };
  for (const root of reparented.filter((n) => !n.parentId)) walk(map.get(root.id) ?? root);
  return reparented.map((n) => map.get(n.id) ?? n);
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
