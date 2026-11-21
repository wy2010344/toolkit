"use client";

import { type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import { CaretDown, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/components/ui";
import type { PositionedNode } from "@/lib/chat-tree/layout";
import type { ChatNode, TreeDirection } from "@/lib/chat-tree/types";

/** UML 端口圆点：伪分支和真实分支共用同一套「接线」语言。 */
function Ports({ direction, selected, revision }: { direction: TreeDirection; selected: boolean; revision?: boolean }) {
  const cls = cn(
    "pointer-events-none absolute h-2 w-2 rounded-full border bg-surface",
    revision ? "border-acc-yellow-fg/70" : selected ? "border-ink" : "border-line-strong",
  );
  return (
    <>
      <span className={cn(cls, direction === "LR" ? "-left-[5px] top-1/2 -translate-y-1/2" : "-top-[5px] left-1/2 -translate-x-1/2")} />
      <span className={cn(cls, direction === "LR" ? "-right-[5px] top-1/2 -translate-y-1/2" : "-bottom-[5px] left-1/2 -translate-x-1/2")} />
    </>
  );
}

/**
 * 版本链专用的另外两个端口。整体横向时后继走左/右，版本链就走上/下；
 * 整体纵向时反过来 —— 两组线永不共用端子，也就不会互相压住。
 */
function VersionPorts({ direction }: { direction: TreeDirection }) {
  const cls = "pointer-events-none absolute h-[7px] w-[7px] rounded-full border border-acc-yellow-fg/70 bg-surface";
  return (
    <>
      <span className={cn(cls, direction === "LR" ? "-top-[4px] left-1/2 -translate-x-1/2" : "-left-[4px] top-1/2 -translate-y-1/2")} />
      <span className={cn(cls, direction === "LR" ? "-bottom-[4px] left-1/2 -translate-x-1/2" : "-right-[4px] top-1/2 -translate-y-1/2")} />
    </>
  );
}

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
  versionPorts,
  direction,
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
  /** 展开版本链时，当前版本节点也要补上上/下（或左/右）端子。 */
  versionPorts: boolean;
  direction: TreeDirection;
  onSelect: () => void;
  onToggleCollapse: () => void;
  onContextMenu: (e: ReactMouseEvent) => void;
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
          "relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-[11px] border bg-surface text-left outline-none transition-[border-color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-ink/30",
          hidden
            ? "border-line shadow-none hover:border-line-strong"
            : selected
              ? "border-ink shadow-[0_10px_26px_-12px_rgba(0,0,0,0.55)] ring-2 ring-ink/20"
              : matched
                ? "border-acc-yellow-fg shadow-sm hover:-translate-y-0.5"
                : onPath
                  ? "border-acc-blue-fg/70 shadow-sm hover:-translate-y-0.5"
                  : "border-line shadow-sm hover:-translate-y-0.5 hover:border-line-strong",
        )}
      >
        <span className={cn("absolute left-0 top-0 h-full w-[3px]", stripe)} />

        {/* 提问区 */}
        <span className="flex min-h-0 flex-1 items-start px-3 py-2.5">
          <span className="line-clamp-3 text-[12.5px] font-medium leading-[1.55] text-ink">{node.prompt}</span>
        </span>

        {/* 元信息栏：模型 · 时间 */}
        <span className="flex h-[25px] shrink-0 items-center gap-1.5 border-t border-line bg-canvas/60 px-2.5 text-[10px] text-faint">
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
          className="absolute -right-2 -top-2 hidden h-5 w-5 items-center justify-center rounded-full border border-line-strong bg-surface text-muted shadow-sm hover:border-ink hover:text-ink group-hover:flex"
        >
          {node.collapsed ? <CaretRight size={11} weight="bold" /> : <CaretDown size={11} weight="bold" />}
        </button>
      ) : null}

      <Ports direction={direction} selected={selected} />
      {versionPorts && <VersionPorts direction={direction} />}
    </div>
  );
}

/**
 * 回答版本的「伪节点」：与提问卡片**同层**，用虚线框和暖色与真实分支区分。
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
  direction,
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
  direction: TreeDirection;
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
          "relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-[11px] border border-dashed bg-acc-yellow-bg/20 text-left outline-none transition-[border-color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-acc-yellow-fg/30",
          selected
            ? "border-acc-yellow-fg shadow-[0_10px_24px_-14px_rgba(149,100,0,0.6)] ring-2 ring-acc-yellow-fg/20"
            : matched
              ? "border-acc-yellow-fg"
              : "border-acc-yellow-fg/50 hover:-translate-y-0.5 hover:border-acc-yellow-fg",
        )}
      >
        <span className="absolute left-0 top-0 h-full w-[3px] bg-acc-yellow-fg" />

        {/* 提问区 */}
        <span className="flex min-h-0 flex-1 items-start px-3 py-2.5">
          <span className="line-clamp-3 text-[12px] font-medium leading-[1.55] text-ink">{node.prompt}</span>
        </span>

        {/* 元信息栏：vN · 模型 · 时间 + 切回入口 */}
        <span className="flex h-[25px] shrink-0 items-center gap-1.5 border-t border-dashed border-acc-yellow-fg/40 bg-canvas/50 px-2.5 font-mono text-[10px] text-faint">
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

      <Ports direction={direction} selected={selected} revision />
      <VersionPorts direction={direction} />
    </div>
  );
}
