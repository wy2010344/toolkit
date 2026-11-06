"use client";

import { useState, type KeyboardEvent } from "react";
import {
  ArrowBendUpLeft,
  ArrowRight,
  CaretDown,
  Copy,
  DownloadSimple,
  PaperPlaneTilt,
  Star,
  Trash,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/components/ui";
import { Markdown } from "./Markdown";
import type { ChatNode, Conversation, FollowUpMode } from "@/lib/chat-tree/types";

export function AnswerPanel({
  conversation,
  node,
  chain,
  childrenNodes,
  ordinal,
  onSelect,
  onFollowUp,
  onExportPath,
  onDelete,
  onToggleCollapse,
  onToggleStar,
}: {
  conversation: Conversation;
  node: ChatNode | null;
  chain: ChatNode[];
  childrenNodes: ChatNode[];
  ordinal: number;
  onSelect: (id: string) => void;
  onFollowUp: (prompt: string, mode: FollowUpMode) => void;
  onExportPath: () => void;
  onDelete: () => void;
  onToggleCollapse: () => void;
  onToggleStar: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<FollowUpMode>("continue");
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* 剪贴板不可用（非 HTTPS 等），演示里静默忽略 */
    }
  };

  const send = () => {
    const text = draft.trim();
    if (!text || !node) return;
    onFollowUp(text, mode === "regenerate" && node.parentId ? "regenerate" : "continue");
    setDraft("");
  };

  const onComposerKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  if (!node) {
    return (
      <aside className="flex h-full w-full items-center justify-center bg-surface p-8 text-center text-[12.5px] leading-relaxed text-faint lg:w-[330px] lg:shrink-0 lg:border-l lg:border-line xl:w-[372px]">
        点一下图里的任意提问节点，右侧会显示它对应的回答，以及从开场走到这里的整条追问链。
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden bg-surface lg:w-[330px] lg:shrink-0 lg:border-l lg:border-line xl:w-[372px]">
      {/* 头部操作 */}
      <header className="flex shrink-0 items-center gap-2 border-b border-line bg-canvas/60 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-ink">回答</div>
          <div className="font-mono text-[10px] text-faint">
            Q{String(ordinal).padStart(2, "0")} · 第 {chain.length} 轮 · {conversation.nodes.length} 节点中的一条路径
          </div>
        </div>
        <button
          type="button"
          aria-label={node.starred ? "取消收藏" : "收藏这一轮"}
          title={node.starred ? "取消收藏" : "收藏这一轮"}
          onClick={onToggleStar}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md hover:bg-surface-mute",
            node.starred ? "text-acc-yellow-fg" : "text-muted hover:text-ink",
          )}
        >
          <Star size={15} weight={node.starred ? "fill" : "regular"} />
        </button>
        <button
          type="button"
          aria-label="复制回答"
          title="复制回答"
          onClick={() => copy(node.answer)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-mute hover:text-ink"
        >
          {copied ? <span className="text-[10px] text-acc-green-fg">OK</span> : <Copy size={15} />}
        </button>
        <button
          type="button"
          aria-label={confirmDelete ? "再点一次确认删除分支" : "删除该提问及其子树"}
          title={confirmDelete ? "再点一次确认删除" : "删除该提问及其子树"}
          onClick={() => {
            if (!node.parentId) return;
            if (confirmDelete) {
              onDelete();
              setConfirmDelete(false);
            } else setConfirmDelete(true);
          }}
          disabled={!node.parentId}
          onBlur={() => setConfirmDelete(false)}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md hover:bg-surface-mute disabled:opacity-30",
            confirmDelete ? "text-acc-red-fg" : "text-muted hover:text-ink",
          )}
        >
          <Trash size={15} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* 追问链回溯 */}
        <section className="border-b border-line px-3 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-ink">
              <ArrowBendUpLeft size={13} className="text-acc-blue-fg" />
              追问链 · 从开场到这里
            </span>
            <button
              type="button"
              onClick={onExportPath}
              title="把这一条链导出成 Markdown"
              className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[10.5px] text-muted hover:border-line-strong hover:text-ink"
            >
              <DownloadSimple size={11} />
              导出这条链
            </button>
          </div>
          <ol className="relative ml-1 border-l border-dashed border-line-strong pl-3">
            {chain.map((c, i) => (
              <li key={c.id} className="relative mb-1.5 last:mb-0">
                <span
                  className={cn(
                    "absolute -left-[19px] top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border font-mono text-[8px]",
                    c.id === node.id ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-faint",
                  )}
                >
                  {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className={cn(
                    "block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] transition-colors",
                    c.id === node.id ? "bg-surface-mute font-medium text-ink" : "text-muted hover:bg-surface-mute hover:text-ink",
                  )}
                >
                  {c.prompt}
                </button>
              </li>
            ))}
          </ol>
        </section>

        {/* 当前这一轮 */}
        <section className="px-4 py-4">
          <div className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-faint">
            <span>你的提问</span>
            {node.badge && <span className="rounded bg-acc-orange-bg px-1.5 py-[1px] text-[9px] normal-case text-acc-orange-fg">{node.badge}</span>}
          </div>
          <div className="rounded-r-md border-l-2 border-acc-blue-fg bg-acc-blue-bg/40 px-3 py-2.5 text-[12.5px] font-medium leading-[1.7] text-ink">
            {node.prompt}
          </div>

          <div className="mb-2 mt-5 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-faint">
            <span>模型回答</span>
            <span className="normal-case">{node.model}</span>
          </div>
          <Markdown text={node.answer} />

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2.5 font-mono text-[10px] text-faint">
            <span>{node.date} {node.time}</span>
            <span>·</span>
            <span>{node.answer.length} 字</span>
            {node.synthetic && <span className="rounded bg-acc-yellow-bg px-1.5 py-[1px] text-acc-yellow-fg">本地演示回答</span>}
          </div>
        </section>

        {/* 并列分支 */}
        <section className="border-t border-line bg-canvas/50 px-3 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-ink">
              从这里分出的分支 <span className="font-mono text-faint">({childrenNodes.length})</span>
            </span>
            {(childrenNodes.length > 0 || node.collapsed) && (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="flex items-center gap-1 text-[10.5px] text-muted hover:text-ink"
              >
                <CaretDown size={11} className={cn(node.collapsed && "-rotate-90")} />
                {node.collapsed ? "在图中展开" : "在图中折叠"}
              </button>
            )}
          </div>
          {childrenNodes.length === 0 ? (
            <p className="text-[11px] leading-relaxed text-faint">还没有后续提问。在下面直接追问，就会从这一节点长出一个新分支。</p>
          ) : (
            <div className="space-y-1.5">
              {childrenNodes.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className="flex w-full items-start gap-2 rounded-md border border-line bg-surface px-2.5 py-2 text-left transition-colors hover:border-line-strong hover:bg-surface-mute"
                >
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-acc-blue-bg font-mono text-[9px] text-acc-blue-fg">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink">{c.prompt}</span>
                  <ArrowRight size={12} className="mt-0.5 shrink-0 text-faint" />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 追问输入：真的会往树上追加节点 */}
      <div className="shrink-0 border-t border-line bg-surface px-3 py-3">
        <div className="mb-2 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMode("continue")}
            className={cn(
              "rounded-md px-2 py-1 text-[10.5px] transition-colors",
              mode === "continue" ? "bg-ink text-white" : "bg-surface-mute text-muted hover:text-ink",
            )}
          >
            继续追问
          </button>
          <button
            type="button"
            disabled={!node.parentId}
            onClick={() => setMode("regenerate")}
            title={node.parentId ? "对同一个父提问换一种问法，生成并列分支" : "开场提问没有上一级"}
            className={cn(
              "rounded-md px-2 py-1 text-[10.5px] transition-colors disabled:opacity-40",
              mode === "regenerate" ? "bg-ink text-white" : "bg-surface-mute text-muted hover:text-ink",
            )}
          >
            换个问法
          </button>
          <span className="ml-auto max-w-[150px] truncate text-[9.5px] text-faint">
            {mode === "regenerate" ? "与当前回答并列" : "挂在当前节点下"}
          </span>
        </div>
        <div className="flex items-end gap-1.5 rounded-md border border-line bg-canvas p-1.5 focus-within:border-line-strong">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onComposerKey}
            rows={2}
            placeholder="问点什么…（Enter 发送 / Shift+Enter 换行）"
            className="min-h-[42px] min-w-0 flex-1 resize-none bg-transparent px-1 py-0.5 text-[11.5px] leading-[1.6] text-ink outline-none placeholder:text-faint"
          />
          <div className="flex shrink-0 flex-col items-center gap-1">
            {draft && (
              <button type="button" aria-label="清空输入" onClick={() => setDraft("")} className="text-faint hover:text-ink">
                <X size={11} weight="bold" />
              </button>
            )}
            <button
              type="button"
              onClick={send}
              disabled={!draft.trim()}
              aria-label="发送追问"
              className="flex h-7 w-7 items-center justify-center rounded-md bg-ink text-white transition-opacity disabled:opacity-30"
            >
              <PaperPlaneTilt size={14} weight="fill" />
            </button>
          </div>
        </div>
        <p className="mt-1.5 text-[9.5px] leading-relaxed text-faint">
          演示不调用模型：新节点会得到一段标注过的本地模板回答，用来展示分支追加后的树形变化。
        </p>
      </div>
    </aside>
  );
}
