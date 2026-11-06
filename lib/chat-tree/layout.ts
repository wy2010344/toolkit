import type { ChatNode, TreeDirection } from "./types";

/**
 * 纯布局层：把「提问树」摆成类图那样的分层结构，并生成正交连线路径。
 * 不依赖 DOM / React，方便单独推演。
 *
 * 采用 leaf-slot 布局：每个可见叶子占一个等距槽位，父节点落在它所有叶子
 * 跨度的中点。这样任意两棵子树都不会互相压到，也不需要迭代收敛。
 */

export const NODE_W = 232;
export const NODE_H = 126;
export const GAP_X = 96;
export const GAP_Y = 34;
export const PAD = 56;

export interface PositionedNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
  childCount: number;
  siblingIndex: number;
  siblingCount: number;
}

export interface LayoutEdge {
  id: string;
  from: string;
  to: string;
  d: string;
  /** 分叉点的汇合圆点。 */
  junction: { x: number; y: number } | null;
  /** 子节点入口处的分支序号圆点（只有兄弟 > 1 时才画）。 */
  marker: { x: number; y: number; index: number } | null;
}

export interface TreeLayout {
  nodes: PositionedNode[];
  edges: LayoutEdge[];
  byId: Map<string, PositionedNode>;
  width: number;
  height: number;
}

const round = (n: number) => Math.round(n * 10) / 10;

export function layoutTree(nodes: ChatNode[], direction: TreeDirection): TreeLayout {
  const map = new Map(nodes.map((n) => [n.id, n]));
  const children = new Map<string, ChatNode[]>();
  const roots: ChatNode[] = [];

  for (const n of nodes) {
    const parent = n.parentId ? map.get(n.parentId) : undefined;
    if (!parent) {
      roots.push(n);
      continue;
    }
    // 折叠节点在布局上等价于叶子，但数据仍在，随时可以展开。
    if (parent.collapsed) continue;
    const list = children.get(parent.id) ?? [];
    list.push(n);
    children.set(parent.id, list);
  }

  const slot = direction === "LR" ? NODE_H + GAP_Y : NODE_W + GAP_X;
  const placed = new Map<string, { center: number; depth: number; siblingIndex: number; siblingCount: number }>();
  let cursor = 0;

  const walk = (node: ChatNode, depth: number, siblingIndex: number, siblingCount: number): number => {
    const kids = children.get(node.id) ?? [];
    let center: number;
    if (kids.length === 0) {
      center = cursor * slot;
      cursor += 1;
    } else {
      const centers = kids.map((k, i) => walk(k, depth + 1, i, kids.length));
      center = (centers[0]! + centers[centers.length - 1]!) / 2;
    }
    placed.set(node.id, { center, depth, siblingIndex, siblingCount });
    return center;
  };

  roots.forEach((r, i) => walk(r, 0, i, roots.length));

  const positioned: PositionedNode[] = [];
  for (const [id, p] of placed) {
    positioned.push({
      id,
      x: direction === "LR" ? PAD + p.depth * (NODE_W + GAP_X) : PAD + p.center - NODE_W / 2,
      y: direction === "LR" ? PAD + p.center - NODE_H / 2 : PAD + p.depth * (NODE_H + GAP_Y),
      w: NODE_W,
      h: NODE_H,
      depth: p.depth,
      childCount: (children.get(id) ?? []).length,
      siblingIndex: p.siblingIndex,
      siblingCount: p.siblingCount,
    });
  }
  const byId = new Map(positioned.map((n) => [n.id, n]));

  const edges: LayoutEdge[] = [];
  for (const parent of positioned) {
    const kids = (children.get(parent.id) ?? []).map((k) => byId.get(k.id)).filter((n): n is PositionedNode => !!n);
    if (!kids.length) continue;

    const junction =
      kids.length > 1
        ? direction === "LR"
          ? { x: parent.x + parent.w + Math.min(46, GAP_X / 2), y: parent.y + parent.h / 2 }
          : { x: parent.x + parent.w / 2, y: parent.y + parent.h + Math.min(38, GAP_Y / 2) }
        : null;

    kids.forEach((child, i) => {
      let d: string;
      let marker: LayoutEdge["marker"] = null;
      if (direction === "LR") {
        const outX = parent.x + parent.w;
        const outY = parent.y + parent.h / 2;
        const cy = child.y + child.h / 2;
        const trunkX = junction?.x ?? child.x;
        d =
          Math.abs(cy - outY) < 0.5
            ? `M ${round(outX)} ${round(outY)} H ${round(child.x)}`
            : `M ${round(outX)} ${round(outY)} H ${round(trunkX)} V ${round(cy)} H ${round(child.x)}`;
        if (kids.length > 1) marker = { x: child.x - 17, y: cy, index: i + 1 };
      } else {
        const outX = parent.x + parent.w / 2;
        const outY = parent.y + parent.h;
        const cx = child.x + child.w / 2;
        const trunkY = junction?.y ?? child.y;
        d =
          Math.abs(cx - outX) < 0.5
            ? `M ${round(outX)} ${round(outY)} V ${round(child.y)}`
            : `M ${round(outX)} ${round(outY)} V ${round(trunkY)} H ${round(cx)} V ${round(child.y)}`;
        if (kids.length > 1) marker = { x: cx, y: child.y - 17, index: i + 1 };
      }
      edges.push({ id: `${parent.id}->${child.id}`, from: parent.id, to: child.id, d, junction, marker });
    });
  }

  const width = Math.max(PAD * 2, ...positioned.map((n) => n.x + n.w + PAD));
  const height = Math.max(PAD * 2, ...positioned.map((n) => n.y + n.h + PAD));
  return { nodes: positioned, edges, byId, width, height };
}
