"use client";

import { CaretDown, CaretRight, Star } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/components/ui";
import type { PositionedNode } from "@/lib/chat-tree/layout";
import type { ChatNode, TreeDirection } from "@/lib/chat-tree/types";

/** 类图式的「类框」：标题栏 / 提问区 / 元信息栏，三段之间用分隔线切开。 */
export function NodeCard({
  node,
  pos,
  ordinal,
  selected,
  onPath,
  dimmed,
  matched,
  hiddenCount,
  direction,
  onSelect,
  onToggleCollapse,
}: {
  node: ChatNode;
  pos: PositionedNode;
  ordinal: number;
  selected: boolean;
  onPath: boolean;
  dimmed: boolean;
  matched: boolean;
  hiddenCount: number;
  direction: TreeDirection;
  onSelect: () => void;
  onToggleCollapse: () => void;
}) {
  const stripe = selected
    ? "bg-ink"
    : matched
      ? "bg-acc-yellow-fg"
      : onPath
        ? "bg-acc-blue-fg"
        : "bg-line-strong";

  return (
    <div
      data-tree-node="1"
      className={cn("group absolute", dimmed && "opacity-30")}
      style={{ left: pos.x, top: pos.y, width: pos.w, height: pos.h }}
    >
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "relative flex h-full w-full flex-col overflow-hidden rounded-[5px] border bg-surface text-left transition-[border-color,box-shadow,transform] duration-150",
          selected
            ? "border-ink shadow-[0_10px_26px_-12px_rgba(0,0,0,0.55)] ring-2 ring-ink/20"
            : matched
              ? "border-acc-yellow-fg shadow-sm hover:-translate-y-0.5"
              : onPath
                ? "border-acc-blue-fg/70 shadow-sm hover:-translate-y-0.5"
                : "border-line-strong shadow-sm hover:-translate-y-0.5 hover:border-faint",
        )}
      >
        <span className={cn("absolute left-0 top-0 h-full w-[3px]", stripe)} />

        {/* 标题栏 */}
        <span className="flex h-[27px] shrink-0 items-center gap-1.5 border-b border-line bg-surface-mute/70 pl-3 pr-2">
          <span className="font-mono text-[10px] font-semibold tracking-wider text-muted">Q{String(ordinal).padStart(2, "0")}</span>
          {node.badge && (
            <span className="truncate rounded-[3px] bg-acc-orange-bg px-1.5 py-[1px] text-[9.5px] font-medium text-acc-orange-fg">
              {node.badge}
            </span>
          )}
          {pos.siblingCount > 1 && !node.badge && (
            <span className="rounded-[3px] bg-acc-blue-bg px-1.5 py-[1px] font-mono text-[9.5px] text-acc-blue-fg">
              分支 {String.fromCharCode(64 + pos.siblingIndex + 1)}
            </span>
          )}
          <span className="ml-auto shrink-0 font-mono text-[9.5px] text-faint">{node.time}</span>
        </span>

        {/* 提问区 */}
        <span className="flex min-h-0 flex-1 items-start px-3 py-2">
          <span className="line-clamp-3 text-[12.5px] font-medium leading-[1.55] text-ink">{node.prompt}</span>
        </span>

        {/* 元信息栏 */}
        <span className="flex h-[25px] shrink-0 items-center gap-1.5 border-t border-line bg-canvas/60 px-2.5 text-[10px] text-faint">
          <span className="truncate font-mono">{node.model}</span>
          {node.starred && <Star size={10} weight="fill" className="shrink-0 text-acc-yellow-fg" />}
          <span className="ml-auto flex shrink-0 items-center gap-1">
            {node.collapsed ? (
              <span className="rounded-[3px] bg-acc-yellow-bg px-1.5 py-[1px] font-mono text-acc-yellow-fg">+{hiddenCount} 折叠</span>
            ) : (
              <span className="font-mono">{pos.childCount} 后续</span>
            )}
          </span>
        </span>
      </button>

      {/* 折叠 / 展开：悬停才出现，不干扰点击选中 */}
      {pos.childCount > 0 || node.collapsed ? (
        <button
          type="button"
          title={node.collapsed ? "展开该分支" : "折叠该分支"}
          aria-label={node.collapsed ? "展开该分支" : "折叠该分支"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse();
          }}
          className="absolute -right-2 -top-2 hidden h-5 w-5 items-center justify-center rounded-full border border-line-strong bg-surface text-muted shadow-sm hover:border-ink hover:text-ink group-hover:flex"
        >
          {node.collapsed ? <CaretRight size={11} weight="bold" /> : <CaretDown size={11} weight="bold" />}
        </button>
      ) : null}

      {/* UML 端口圆点 */}
      <span
        className={cn(
          "pointer-events-none absolute h-2 w-2 rounded-full border bg-surface",
          selected ? "border-ink" : "border-line-strong",
          direction === "LR" ? "-left-[5px] top-1/2 -translate-y-1/2" : "-top-[5px] left-1/2 -translate-x-1/2",
        )}
      />
      <span
        className={cn(
          "pointer-events-none absolute h-2 w-2 rounded-full border bg-surface",
          selected ? "border-ink" : "border-line-strong",
          direction === "LR" ? "-right-[5px] top-1/2 -translate-y-1/2" : "-bottom-[5px] left-1/2 -translate-x-1/2",
        )}
      />
    </div>
  );
}
