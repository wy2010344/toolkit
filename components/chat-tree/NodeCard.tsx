"use client";

import { type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import { CaretDown, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/components/ui";
import type { PositionedNode } from "@/lib/chat-tree/layout";
import type { ChatNode } from "@/lib/chat-tree/types";

function activateOnKey(e: ReactKeyboardEvent<HTMLDivElement>, fn: () => void) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn();
  }
}

/** 类图式的「类框」：卡片上只放问题本身，底部一行模型 · 时间。 */
export function NodeCard({
  node,
  pos,
  selected,
  onPath,
  dimmed,
  matched,
  hidden,
  archived,
  onSelect,
  onToggleCollapse,
  onContextMenu,
}: {
  node: ChatNode;
  pos: PositionedNode;
  selected: boolean;
  onPath: boolean;
  dimmed: boolean;
  matched: boolean;
  /** 自身或祖先被标记隐藏 —— 整棵子树一起灰显。 */
  hidden: boolean;
  /** 挂在历史版本下的分支 —— 与历史版本一起置灰。 */
  archived: boolean;
  onSelect: () => void;
  onToggleCollapse: () => void;
  onContextMenu: (e: ReactMouseEvent) => void;
}) {
  const strip = hidden
    ? "ct-strip-line"
    : selected
      ? "ct-strip-ink"
      : matched
        ? "ct-strip-yellow"
        : onPath
          ? "ct-strip-blue"
          : "ct-strip-line";

  return (
    <div
      data-tree-node="1"
      className={cn("group absolute", dimmed ? "opacity-25" : hidden ? "opacity-35" : archived ? "opacity-45 saturate-50" : "")}
      style={{ left: pos.x, top: pos.y, width: pos.w, height: pos.h }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => activateOnKey(e, onSelect)}
        onContextMenu={onContextMenu}
        title="点击查看回答 · 右键更多操作"
        className={cn(
          "ct-card relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-[14px] text-left outline-none focus-visible:ring-2 focus-visible:ring-ink/25",
          hidden && "ct-card-muted",
          !hidden && selected && "ct-card-selected",
          !hidden && !selected && matched && "ct-card-matched",
          !hidden && !selected && !matched && onPath && "ct-card-path",
        )}
      >
        <span className={cn("ct-strip", strip)} />

        {/* 提问区 */}
        <span className="flex min-h-0 flex-1 items-start px-3 py-2.5">
          <span className="line-clamp-3 text-[12.5px] font-medium leading-[1.55] text-ink">{node.prompt}</span>
        </span>

        {/* 元信息栏：模型 · 时间 */}
        <span className="ct-card-foot flex h-[25px] shrink-0 items-center gap-1.5 px-2.5 text-[10px] text-faint">
          <span className="truncate font-mono">{node.model}</span>
          {node.pending ? (
            <span className="ml-auto flex shrink-0 items-center gap-1 font-mono">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-acc-blue-fg" />
              生成中
            </span>
          ) : (
            <span className="ml-auto shrink-0 font-mono">{node.time}</span>
          )}
        </span>
      </div>

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
          className="ct-soft-btn absolute -right-2 -top-2 hidden h-5 w-5 items-center justify-center rounded-full group-hover:flex"
        >
          {node.collapsed ? <CaretRight size={11} weight="bold" /> : <CaretDown size={11} weight="bold" />}
        </button>
      ) : null}

    </div>
  );
}

/**
 * 回答版本的「伪节点」：与提问卡片**同层**，用暖色渐染的色块和虚线连线与真实分支区分。
 * 它不是一次新提问，所以没有 Q 序号；箭头指向下一版，终点是当前版。
 */
export function RevisionCard({
  node,
  pos,
  selected,
  isCurrent,
  dimmed,
  matched,
  hidden,
  archived,
  onSelect,
  onRestore,
}: {
  node: ChatNode;
  pos: PositionedNode;
  selected: boolean;
  isCurrent: boolean;
  dimmed: boolean;
  matched: boolean;
  hidden: boolean;
  archived: boolean;
  onSelect: () => void;
  onRestore: () => void;
}) {
  const index = node.revisionRef?.index ?? 0;
  return (
    <div
      data-tree-node="1"
      data-revision-node="1"
      className={cn("group absolute", dimmed ? "opacity-25" : hidden ? "opacity-35" : archived ? "opacity-45 saturate-50" : "")}
      style={{ left: pos.x, top: pos.y, width: pos.w, height: pos.h }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => activateOnKey(e, onSelect)}
        title="点击预览这一版的问题与回答 · 与当前版本平级，箭头指向下一版"
        className={cn(
          "ct-card ct-card-revision relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-[14px] text-left outline-none focus-visible:ring-2 focus-visible:ring-acc-yellow-fg/30",
          (selected || matched) && "ct-card-selected",
        )}
      >
        <span className="ct-strip ct-strip-yellow" />

        {/* 提问区 */}
        <span className="flex min-h-0 flex-1 items-start px-3 py-2.5">
          <span className="line-clamp-3 text-[12px] font-medium leading-[1.55] text-ink">{node.prompt}</span>
        </span>

        {/* 元信息栏：vN · 模型 · 时间 + 切回入口 */}
        <span className="ct-card-foot ct-card-foot-warm flex h-[25px] shrink-0 items-center gap-1.5 px-2.5 font-mono text-[10px] text-faint">
          <span className={cn("shrink-0 rounded-[3px] px-1 font-semibold", isCurrent ? "bg-acc-yellow-bg text-acc-yellow-fg" : "bg-acc-yellow-fg text-white")}>
            v{index + 1}
          </span>
          <span className="min-w-0 truncate">{node.time}</span>
          <span className="ml-auto shrink-0">
            {isCurrent ? (
              <span className="text-[9px] text-acc-yellow-fg">当前版</span>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRestore();
                }}
                className="text-[9.5px] text-acc-yellow-fg hover:underline"
              >
                切回此版
              </button>
            )}
          </span>
        </span>
      </div>
    </div>
  );
}
