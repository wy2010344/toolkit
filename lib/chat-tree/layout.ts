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
  /** 版本伪节点在布局层也留个标记，便于连线区别对待。 */
  kind?: "revision";
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
  childCount: number;
}

export interface LayoutEdge {
  id: string;
  from: string;
  to: string;
  d: string;
  /** 版本伪分支用虚线和暖色区分。 */
  kind: "question" | "revision";
}

export interface TreeLayout {
  nodes: PositionedNode[];
  edges: LayoutEdge[];
  byId: Map<string, PositionedNode>;
  width: number;
  height: number;
}

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * 把一串正交折点转成带圆角拐点的路径：每个拐点用一小段二次曲线切过去，
 * 而不是留一个尖锐的直角。半径会自动收敛到相邻线段长度的一半，短边也不会反折。
 */
function roundedPath(points: { x: number; y: number }[], radius = 14): string {
  if (points.length < 2) return "";
  const [first, ...rest] = points;
  let d = `M ${round(first!.x)} ${round(first!.y)}`;
  for (let i = 0; i < rest.length - 1; i += 1) {
    const prev = points[i]!;
    const cur = rest[i]!;
    const next = rest[i + 1]!;
    const inLen = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const outLen = Math.hypot(next.x - cur.x, next.y - cur.y);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    if (r < 0.6) {
      d += ` L ${round(cur.x)} ${round(cur.y)}`;
      continue;
    }
    const enter = { x: cur.x + ((prev.x - cur.x) / inLen) * r, y: cur.y + ((prev.y - cur.y) / inLen) * r };
    const leave = { x: cur.x + ((next.x - cur.x) / outLen) * r, y: cur.y + ((next.y - cur.y) / outLen) * r };
    d += ` L ${round(enter.x)} ${round(enter.y)} Q ${round(cur.x)} ${round(cur.y)} ${round(leave.x)} ${round(leave.y)}`;
  }
  const last = rest[rest.length - 1]!;
  d += ` L ${round(last.x)} ${round(last.y)}`;
  return d;
}

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
  const placed = new Map<string, { center: number; depth: number }>();
  let cursor = 0;

  const walk = (node: ChatNode, depth: number): number => {
    const kids = children.get(node.id) ?? [];
    let center: number;
    if (kids.length === 0) {
      center = cursor * slot;
      cursor += 1;
    } else {
      const centers = kids.map((k) => walk(k, depth + 1));
      center = (centers[0]! + centers[centers.length - 1]!) / 2;
    }
    placed.set(node.id, { center, depth });
    return center;
  };

  roots.forEach((r) => walk(r, 0));

  const positioned: PositionedNode[] = [];
  for (const [id, p] of placed) {
    positioned.push({
      id,
      kind: map.get(id)?.revisionRef ? "revision" : undefined,
      x: direction === "LR" ? PAD + p.depth * (NODE_W + GAP_X) : PAD + p.center - NODE_W / 2,
      y: direction === "LR" ? PAD + p.center - NODE_H / 2 : PAD + p.depth * (NODE_H + GAP_Y),
      w: NODE_W,
      h: NODE_H,
      depth: p.depth,
      childCount: (children.get(id) ?? []).length,
    });
  }
  const byId = new Map(positioned.map((n) => [n.id, n]));

  const edges: LayoutEdge[] = [];
  for (const parent of positioned) {
    const kids = (children.get(parent.id) ?? []).map((k) => byId.get(k.id)).filter((n): n is PositionedNode => !!n);
    if (!kids.length) continue;

    // 多子节点共享一个靠近父节点的转折槽位（就是以前汇合圆点的位置），
    // 单子节点则取间距中点。转折留在中间，别拖到子节点边缘才拐。
    const forks = kids.filter((k) => k.kind !== "revision");
    const junction =
      forks.length > 1
        ? direction === "LR"
          ? { x: parent.x + parent.w + Math.min(46, GAP_X / 2), y: parent.y + parent.h / 2 }
          : { x: parent.x + parent.w / 2, y: parent.y + parent.h + Math.min(38, GAP_Y / 2) }
        : null;

    kids.forEach((child) => {
      let d: string;
      if (direction === "LR") {
        const outX = parent.x + parent.w;
        const outY = parent.y + parent.h / 2;
        const cy = child.y + child.h / 2;
        const trunkX = junction?.x ?? outX + (child.x - outX) / 2;
        const pts = Math.abs(cy - outY) < 0.5
          ? [{ x: outX, y: outY }, { x: child.x, y: cy }]
          : [{ x: outX, y: outY }, { x: trunkX, y: outY }, { x: trunkX, y: cy }, { x: child.x, y: cy }];
        d = roundedPath(pts);
      } else {
        const outX = parent.x + parent.w / 2;
        const outY = parent.y + parent.h;
        const cx = child.x + child.w / 2;
        const trunkY = junction?.y ?? outY + (child.y - outY) / 2;
        const pts = Math.abs(cx - outX) < 0.5
          ? [{ x: outX, y: outY }, { x: cx, y: child.y }]
          : [{ x: outX, y: outY }, { x: outX, y: trunkY }, { x: cx, y: trunkY }, { x: cx, y: child.y }];
        d = roundedPath(pts);
      }
      edges.push({
        id: `${parent.id}->${child.id}`,
        from: parent.id,
        to: child.id,
        d,
        kind: child.kind === "revision" ? "revision" : "question",
      });
    });
  }

  const width = Math.max(PAD * 2, ...positioned.map((n) => n.x + n.w + PAD));
  const height = Math.max(PAD * 2, ...positioned.map((n) => n.y + n.h + PAD));
  return { nodes: positioned, edges, byId, width, height };
}
