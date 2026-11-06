"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ArrowRight,
  CaretDown,
  DotsThree,
  DownloadSimple,
  Eye,
  EyeSlash,
  FrameCorners,
  GitBranch,
  MagnifyingGlass,
  Minus,
  Plus,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { cn, IconButton } from "@/components/ui";
import { NodeCard } from "./NodeCard";
import { GAP_X, GAP_Y, NODE_H, NODE_W, type PositionedNode, type TreeLayout } from "@/lib/chat-tree/layout";
import { indexNodes, subtreeIds, treeStats } from "@/lib/chat-tree/tree";
import type { Conversation, TreeDirection } from "@/lib/chat-tree/types";

const MIN_K = 0.28;
const MAX_K = 2.2;
/** 默认不整树适配：树一大文字就看不清。以可读比例落在当前节点附近，全图交给「适配」按钮和小地图。 */
const DEFAULT_K = 0.86;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface FocusRequest {
  id: string;
  token: number;
}

export interface ViewCommand {
  kind: "zoomIn" | "zoomOut" | "fit";
  token: number;
}

interface View {
  x: number;
  y: number;
  k: number;
}

export function TreeCanvas({
  conversation,
  layout,
  selectedId,
  pathIds,
  focusPath,
  matchIds,
  searchQuery,
  direction,
  focusRequest,
  viewCommand,
  onSelect,
  onToggleCollapse,
  onDirectionChange,
  onSearchChange,
  onFocusPathChange,
  onExportJson,
}: {
  conversation: Conversation;
  layout: TreeLayout;
  selectedId: string | null;
  pathIds: Set<string>;
  focusPath: boolean;
  matchIds: Set<string>;
  searchQuery: string;
  direction: TreeDirection;
  focusRequest: FocusRequest | null;
  viewCommand: ViewCommand | null;
  onSelect: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onDirectionChange: (d: TreeDirection) => void;
  onSearchChange: (q: string) => void;
  onFocusPathChange: (v: boolean) => void;
  onExportJson: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const handledToken = useRef(-1);
  const handledCommand = useRef(-1);
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const sizeRef = useRef(size);
  const viewRef = useRef(view);
  const [dragging, setDragging] = useState(false);
  const [matchCursor, setMatchCursor] = useState(-1);
  const [showMore, setShowMore] = useState(false);
  const layoutRef = useRef(layout);
  const selectedRef = useRef(selectedId);
  const initializedKey = useRef("");
  /** 当前按在画布上的触点：单指平移，双指缩放。 */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; midX: number; midY: number; view: View } | null>(null);
  const savedUserSelect = useRef<string | null>(null);

  useEffect(() => {
    sizeRef.current = size;
  }, [size]);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);
  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);

  // 画布尺寸：ResizeObserver 首次观察就会回调，无需在 effect 里同步 setState。
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    const { w, h } = sizeRef.current;
    if (!w || !h) return;
    const k = clamp(Math.min((w - 88) / layout.width, (h - 88) / layout.height, 1), MIN_K, 1);
    setView({ k, x: (w - layout.width * k) / 2, y: (h - layout.height * k) / 2 });
  }, [layout.width, layout.height]);

  const centerOn = useCallback((node: PositionedNode) => {
    const { w, h } = sizeRef.current;
    setView((prev) => ({
      ...prev,
      x: w / 2 - (node.x + node.w / 2) * prev.k,
      y: h / 2 - (node.y + node.h / 2) * prev.k,
    }));
  }, []);

  const zoomBy = useCallback((factor: number) => {
    const { w, h } = sizeRef.current;
    setView((prev) => {
      const k = clamp(prev.k * factor, MIN_K, MAX_K);
      const ratio = k / prev.k;
      return { k, x: w / 2 - (w / 2 - prev.x) * ratio, y: h / 2 - (h / 2 - prev.y) * ratio };
    });
  }, []);

  // 首次进入 / 切换会话 / 切换方向时给一个可读的默认视图；
  // 之后用户的平移缩放、增删节点、折叠、窗口 resize 都不会把它拽回去。
  useEffect(() => {
    const { w, h } = sizeRef.current;
    if (!w || !h) return;
    const key = `${conversation.id}:${direction}`;
    if (initializedKey.current === key) return;
    initializedKey.current = key;
    const current = layoutRef.current;
    const node = current.byId.get(selectedRef.current ?? "") ?? current.nodes[0];
    const compact = w < 700;
    const k = compact ? 0.7 : DEFAULT_K;
    // 桌面开场时把视野往「生长方向」推一层多，第一眼能看到根 + 分叉 + 后续；
    // 窄屏不做偏移，直接把当前节点居中，避免把根节点推出屏幕。
    const shift = !compact && node?.depth === 0 ? (direction === "LR" ? 1.1 * (NODE_W + GAP_X) : 1.1 * (NODE_H + GAP_Y)) : 0;
    const cx = (node ? node.x + node.w / 2 : current.width / 2) + (direction === "LR" ? shift : 0);
    const cy = (node ? node.y + node.h / 2 : current.height / 2) + (direction === "TB" ? shift : 0);
    setView({ k, x: w / 2 - cx * k, y: h / 2 - cy * k });
  }, [conversation.id, direction, size.w, size.h]);

  // 外部请求（切换会话、新增分支、搜索定位）把某个节点滚到视野中央。
  useEffect(() => {
    if (!focusRequest || handledToken.current === focusRequest.token) return;
    const node = layout.byId.get(focusRequest.id);
    if (!node) return;
    handledToken.current = focusRequest.token;
    const raf = requestAnimationFrame(() => centerOn(node));
    return () => cancelAnimationFrame(raf);
  }, [focusRequest, layout, centerOn]);

  // 来自键盘的缩放 / 适配指令。
  useEffect(() => {
    if (!viewCommand || handledCommand.current === viewCommand.token) return;
    handledCommand.current = viewCommand.token;
    if (viewCommand.kind === "fit") fit();
    else zoomBy(viewCommand.kind === "zoomIn" ? 1.2 : 1 / 1.2);
  }, [viewCommand, fit, zoomBy]);

  // wheel 必须用非 passive 的原生监听器，React 的 onWheel 无法 preventDefault。
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.006 : 0.0016));
      setView((prev) => {
        const k = clamp(prev.k * factor, MIN_K, MAX_K);
        const ratio = k / prev.k;
        return { k, x: mx - (mx - prev.x) * ratio, y: my - (my - prev.y) * ratio };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const localPoint = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top };
  };

  const beginPinch = () => {
    const pts = [...pointers.current.values()];
    if (pts.length < 2) return;
    const mid = localPoint(pts[0]!, pts[1]!);
    pinch.current = {
      dist: Math.max(1, Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y)),
      midX: mid.x,
      midY: mid.y,
      view: viewRef.current,
    };
    drag.current = null;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-tree-node]") || target.closest("[data-canvas-control]")) return;
    // 触摸时阻止浏览器默认的选中/滚动手势；鼠标保留默认行为以免吞掉双击适配。
    if (e.pointerType === "touch") e.preventDefault();
    // 关键：开始平移前清掉已有选区，并在拖拽期间锁住整个文档的 user-select。
    window.getSelection()?.removeAllRanges();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);
    if (pointers.current.size === 1) {
      drag.current = { px: e.clientX, py: e.clientY, x: viewRef.current.x, y: viewRef.current.y };
      setDragging(true);
      savedUserSelect.current = document.body.style.userSelect;
      document.body.style.userSelect = "none";
    } else {
      beginPinch();
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // 双指：以两指中点为锚点，按指距变化缩放。
    if (pinch.current && pointers.current.size >= 2) {
      const pts = [...pointers.current.values()];
      const dist = Math.max(1, Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y));
      const mid = localPoint(pts[0]!, pts[1]!);
      const base = pinch.current;
      const k = clamp(base.view.k * (dist / base.dist), MIN_K, MAX_K);
      const ratio = k / base.view.k;
      setView({
        k,
        x: mid.x - (base.midX - base.view.x) * ratio,
        y: mid.y - (base.midY - base.view.y) * ratio,
      });
      return;
    }

    const start = drag.current;
    if (!start) return;
    setView((prev) => ({ ...prev, x: start.x + e.clientX - start.px, y: start.y + e.clientY - start.py }));
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (pointers.current.size === 0) {
      drag.current = null;
      pinch.current = null;
      setDragging(false);
      if (savedUserSelect.current !== null) {
        document.body.style.userSelect = savedUserSelect.current;
        savedUserSelect.current = null;
      }
    } else if (pointers.current.size === 1) {
      // 双指抬起一根后，剩下那根无缝接回单指平移。
      pinch.current = null;
      const p = [...pointers.current.values()][0]!;
      drag.current = { px: p.x, py: p.y, x: viewRef.current.x, y: viewRef.current.y };
    } else {
      beginPinch();
    }
  };

  const nodeMap = useMemo(() => indexNodes(conversation.nodes), [conversation.nodes]);
  const ordinals = useMemo(
    () => new Map(conversation.nodes.map((n, i) => [n.id, i + 1])),
    [conversation.nodes],
  );
  const hiddenCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of conversation.nodes) {
      if (n.collapsed) m.set(n.id, subtreeIds(conversation.nodes, n.id).size - 1);
    }
    return m;
  }, [conversation.nodes]);
  const stats = useMemo(() => treeStats(conversation.nodes), [conversation.nodes]);
  const matches = useMemo(() => layout.nodes.filter((n) => matchIds.has(n.id)), [layout.nodes, matchIds]);

  const locateNext = () => {
    if (!matches.length) return;
    const next = (matchCursor + 1) % matches.length;
    setMatchCursor(next);
    const node = matches[next]!;
    onSelect(node.id);
    centerOn(node);
  };

  const onMinimapClick = (e: ReactMouseEvent<SVGSVGElement>) => {
    const svg = minimapRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const { w, h } = sizeRef.current;
    setView((prev) => ({ ...prev, x: w / 2 - p.x * prev.k, y: h / 2 - p.y * prev.k }));
  };

  const unit = Math.max(layout.width, layout.height) / 180;
  const viewport = {
    x: -view.x / view.k,
    y: -view.y / view.k,
    w: size.w / view.k,
    h: size.h / view.k,
  };

  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden border-x border-line bg-canvas">
      {/* 工具条 */}
      <header className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-line bg-surface px-3 py-2">
        <div className="min-w-0 flex-1 pr-2">
          <h2 className="truncate text-[13px] font-semibold text-ink">{conversation.title}</h2>
          <p className="mt-0.5 hidden items-center gap-1.5 font-mono text-[10px] text-faint lg:flex">
            <span>{stats.count} 节点</span>
            <span className="text-line-strong">/</span>
            <span>{stats.forks} 处分叉</span>
            <span className="text-line-strong">/</span>
            <span>深度 {stats.maxDepth}</span>
            <span className="text-line-strong">/</span>
            <span>{stats.leaves} 个末梢</span>
          </p>
        </div>

        {/* 缩放控件常驻；窄屏把搜索 / 方向 / 聚焦 / 导出收进「更多」。 */}
        <div className="ml-auto flex items-center gap-1.5">
          <div className="flex h-8 items-center rounded-md border border-line bg-canvas">
            <IconButton label="缩小" className="h-7 w-7 rounded-none" onClick={() => zoomBy(1 / 1.2)}>
              <Minus size={13} weight="bold" />
            </IconButton>
            <button
              type="button"
              onClick={fit}
              title="适配视图"
              className="h-7 min-w-[46px] border-x border-line px-1 font-mono text-[10.5px] text-muted hover:text-ink"
            >
              {Math.round(view.k * 100)}%
            </button>
            <IconButton label="放大" className="h-7 w-7 rounded-none" onClick={() => zoomBy(1.2)}>
              <Plus size={13} weight="bold" />
            </IconButton>
          </div>
          <IconButton label="适配全部节点" className="h-8 w-8 border border-line bg-canvas" onClick={fit}>
            <FrameCorners size={14} />
          </IconButton>
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            aria-expanded={showMore}
            className="flex h-8 items-center gap-1 rounded-md border border-line bg-canvas px-2 text-[11px] text-muted lg:hidden"
          >
            <DotsThree size={14} weight="bold" />
            更多
          </button>
        </div>

        <div className={cn("w-full flex-wrap items-center gap-1.5 lg:w-auto lg:flex", showMore ? "flex" : "hidden")}>
          <div className="relative flex h-8 w-[186px] items-center rounded-md border border-line bg-canvas focus-within:border-line-strong">
            <MagnifyingGlass size={13} className="ml-2.5 shrink-0 text-faint" />
            <input
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setMatchCursor(-1);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") locateNext();
                if (e.key === "Escape") onSearchChange("");
              }}
              placeholder="找提问 / 回答…"
              className="h-full min-w-0 flex-1 bg-transparent px-2 text-[11.5px] text-ink outline-none placeholder:text-faint"
            />
            {searchQuery && (
              <span className="mr-1.5 flex shrink-0 items-center gap-1">
                <span className="font-mono text-[9.5px] text-faint">{matches.length}</span>
                <button type="button" aria-label="清除搜索" onClick={() => onSearchChange("")} className="text-faint hover:text-ink">
                  <X size={11} weight="bold" />
                </button>
              </span>
            )}
          </div>
          {searchQuery && matches.length > 0 && (
            <button
              type="button"
              onClick={locateNext}
              title="定位下一个匹配"
              className="h-8 rounded-md border border-line bg-surface px-2 text-[11px] text-muted hover:border-line-strong hover:text-ink"
            >
              下一个
            </button>
          )}

          <span className="mx-0.5 hidden h-5 w-px bg-line lg:block" />

          <div className="flex h-8 items-center rounded-md border border-line bg-canvas p-0.5">
            <button
              type="button"
              title="横向：从左到右"
              onClick={() => onDirectionChange("LR")}
              className={cn(
                "flex h-6 items-center gap-1 rounded px-2 text-[11px] transition-colors",
                direction === "LR" ? "bg-ink text-white" : "text-muted hover:text-ink",
              )}
            >
              <ArrowRight size={12} weight="bold" /> 横向
            </button>
            <button
              type="button"
              title="纵向：从上到下"
              onClick={() => onDirectionChange("TB")}
              className={cn(
                "flex h-6 items-center gap-1 rounded px-2 text-[11px] transition-colors",
                direction === "TB" ? "bg-ink text-white" : "text-muted hover:text-ink",
              )}
            >
              <CaretDown size={12} weight="bold" /> 纵向
            </button>
          </div>

          <button
            type="button"
            onClick={() => onFocusPathChange(!focusPath)}
            title="只高亮当前追问链"
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-md border px-2 text-[11px] transition-colors",
              focusPath ? "border-ink bg-ink text-white" : "border-line bg-canvas text-muted hover:border-line-strong hover:text-ink",
            )}
          >
            {focusPath ? <Eye size={13} /> : <EyeSlash size={13} />}
            聚焦路径
          </button>
          <IconButton label="导出当前会话 JSON" className="h-8 w-8 border border-line bg-canvas" onClick={onExportJson}>
            <DownloadSimple size={14} />
          </IconButton>
        </div>
      </header>

      {/* 画布 */}
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).closest("[data-tree-node]")) return;
          fit();
        }}
        className={cn("relative min-h-0 flex-1 select-none touch-none overflow-hidden", dragging ? "cursor-grabbing" : "cursor-grab")}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, var(--color-line) 1px, transparent 1px)",
            backgroundSize: `${24 * view.k}px ${24 * view.k}px`,
            backgroundPosition: `${view.x}px ${view.y}px`,
          }}
        />

        <div
          className="absolute left-0 top-0 origin-top-left select-none"
          style={{
            width: layout.width,
            height: layout.height,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
          }}
        >
          <svg
            width={layout.width}
            height={layout.height}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            className="pointer-events-none absolute inset-0 overflow-visible"
          >
            {layout.edges.map((edge) => {
              const active = pathIds.has(edge.from) && pathIds.has(edge.to);
              return (
                <g key={edge.id} className={cn(focusPath && !active && "opacity-20")}>
                  <path
                    d={edge.d}
                    fill="none"
                    strokeWidth={active ? 2.2 * (1 / Math.max(view.k, 0.6)) : 1.8}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    className={active ? "stroke-ink" : "stroke-faint"}
                  />
                  {edge.junction && edge.marker?.index === 1 && (
                    <circle
                      cx={edge.junction.x}
                      cy={edge.junction.y}
                      r={3.6}
                      className={cn("fill-surface", active ? "stroke-ink" : "stroke-line-strong")}
                      strokeWidth={1.4}
                    />
                  )}
                  {edge.marker && (
                    <g>
                      <circle
                        cx={edge.marker.x}
                        cy={edge.marker.y}
                        r={8.5}
                        className={cn("fill-surface", active ? "stroke-ink" : "stroke-line-strong")}
                        strokeWidth={1.2}
                      />
                      <text
                        x={edge.marker.x}
                        y={edge.marker.y + 0.5}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={9}
                        className={cn("font-mono", active ? "fill-ink" : "fill-muted")}
                      >
                        {edge.marker.index}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>

          {layout.nodes.map((pos) => {
            const node = nodeMap.get(pos.id);
            if (!node) return null;
            return (
              <NodeCard
                key={node.id}
                node={node}
                pos={pos}
                ordinal={ordinals.get(node.id) ?? 0}
                selected={selectedId === node.id}
                onPath={pathIds.has(node.id)}
                dimmed={focusPath && !pathIds.has(node.id)}
                matched={matchIds.has(node.id)}
                hiddenCount={hiddenCounts.get(node.id) ?? 0}
                direction={direction}
                onSelect={() => onSelect(node.id)}
                onToggleCollapse={() => onToggleCollapse(node.id)}
              />
            );
          })}
        </div>

        {/* 操作提示 */}
        <div className="pointer-events-none absolute bottom-16 left-3 flex flex-col gap-1 rounded-md border border-line bg-surface/85 px-2.5 py-2 text-[10.5px] leading-relaxed text-faint backdrop-blur-sm lg:bottom-3 lg:flex">
          <span className="hidden lg:inline">滚轮缩放 · 拖拽平移 · 双击空白处适配</span>
          <span className="lg:hidden">拖拽平移 · 双指或按钮缩放 · 点节点看回答</span>
          <span className="hidden items-center gap-1.5 lg:flex">
            <GitBranch size={11} className="text-acc-blue-fg" />
            实线为当前追问链，圆点数字是同一提问下的并列分支
          </span>
        </div>

        {/* 小地图：窄屏让位给画布，靠「适配」按钮看全图 */}
        <div
          data-canvas-control="1"
          className="absolute bottom-3 right-3 hidden overflow-hidden rounded-md border border-line bg-surface/90 shadow-sm backdrop-blur-sm lg:block"
        >
          <div className="flex items-center justify-between border-b border-line px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-faint">
            <span>minimap</span>
            <span>{Math.round(view.k * 100)}%</span>
          </div>
          <svg
            ref={minimapRef}
            width={176}
            height={104}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            preserveAspectRatio="xMidYMid meet"
            onClick={onMinimapClick}
            className="block cursor-crosshair bg-canvas"
          >
            {layout.nodes.map((n) => (
              <rect
                key={n.id}
                x={n.x}
                y={n.y}
                width={n.w}
                height={n.h}
                rx={8}
                className={cn(selectedId === n.id ? "fill-ink" : pathIds.has(n.id) ? "fill-acc-blue-fg" : "fill-line-strong")}
              />
            ))}
            <rect
              x={viewport.x}
              y={viewport.y}
              width={viewport.w}
              height={viewport.h}
              rx={unit}
              className="fill-ink/10 stroke-ink"
              strokeWidth={unit * 1.5}
            />
          </svg>
        </div>
      </div>
    </section>
  );
}
