"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowClockwise, Copy, PencilSimple, PaperPlaneTilt, X } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/components/ui";
import { Markdown } from "./Markdown";
import { answerOf } from "@/lib/chat-tree/tree";
import type { ChatNode, FollowUpMode } from "@/lib/chat-tree/types";

/**
 * 右侧面板只承载「内容」：这一轮的提问与回答，外加追问输入。
 * 追问链由画布路径高亮表达、分支由节点表达、操作由节点右键菜单表达 —— 这里不重复。
 */
export function AnswerPanel({
  node,
  ordinal,
  chainLength,
  composerMode,
  generating,
  modelError,
  versionsExpanded,
  previewVersion,
  prefill,
  onDismissModelError,
  onComposerModeChange,
  onFollowUp,
  onRevise,
  onCopy,
  onToggleVersions,
  onExitPreview,
}: {
  node: ChatNode | null;
  ordinal: number;
  chainLength: number;
  composerMode: FollowUpMode;
  generating: boolean;
  modelError: string | null;
  versionsExpanded: boolean;
  /** 正在预览的历史版本下标；null 表示看的是当前版。 */
  previewVersion: number | null;
  /** 切到「修改」时由外部填入的原问题，token 变化即重新填入。 */
  prefill: { text: string; token: number } | null;
  onDismissModelError: () => void;
  onComposerModeChange: (m: FollowUpMode) => void;
  onFollowUp: (prompt: string, mode: FollowUpMode) => Promise<boolean>;
  onRevise: (prompt: string) => Promise<boolean>;
  onCopy: () => void;
  onToggleVersions: () => void;
  onExitPreview: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const current = node ? answerOf(node) : null;
  const versionCount = node?.revisions?.length ?? 0;

  // 进入「修改」时把原问题填进输入框，光标落在末尾，用户直接改几个字就能发送。
  useEffect(() => {
    if (!prefill) return;
    const text = prefill.text;
    const el = textareaRef.current;
    const raf = requestAnimationFrame(() => {
      setDraft(text);
      el?.focus();
      el?.setSelectionRange(text.length, text.length);
    });
    return () => cancelAnimationFrame(raf);
  }, [prefill]);

  // 在修改模式下换到别的节点 / 别的版本，也要换成那一问的原文。
  useEffect(() => {
    if (composerMode !== "revise" || !node) return;
    const text = answerOf(node).prompt;
    const raf = requestAnimationFrame(() => setDraft(text));
    return () => cancelAnimationFrame(raf);
    // 只在目标变化时重填；流式更新会不断产生新的 node 对象，不能作为依赖。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composerMode, node?.id, previewVersion]);

  const copy = async () => {
    onCopy();
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const send = async () => {
    if (generating) return;
    if (!node) {
      const text = draft.trim();
      if (!text) return;
      const ok = await onFollowUp(text, "continue");
      if (ok) setDraft("");
      return;
    }
    const text = draft.trim();
    if (!text) return;
    // 修改：把编辑后的问题交给上层产出新版本；追问：在当前节点下长子节点。
    const ok = composerMode === "revise" ? await onRevise(text) : await onFollowUp(text, "continue");
    if (ok) setDraft("");
  };

  const onComposerKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden bg-surface lg:w-[340px] lg:shrink-0 lg:border-l lg:border-line xl:w-[392px]">
      {modelError && (
        <div className="flex items-start gap-2 border-b border-acc-red-fg/25 bg-acc-red-bg px-4 py-2 text-[10.5px] leading-[1.5] text-acc-red-fg">
          <span className="min-w-0 flex-1">{modelError}</span>
          <button type="button" onClick={onDismissModelError} className="shrink-0 underline">
            关闭
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!node ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="text-[13px] font-medium text-ink">还没有提问</div>
            <p className="mt-2 max-w-[240px] text-[11px] leading-relaxed text-muted">
              写下第一个问题，它就会成为这棵树的根节点；之后的追问都从它长出来。
            </p>
          </div>
        ) : (
        <section className="px-5 pb-2 pt-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
              Q{String(ordinal).padStart(2, "0")} · 第 {chainLength} 轮
            </span>
            <span className="flex items-center gap-0.5">
              {versionCount > 0 && (
                <button
                  type="button"
                  onClick={onToggleVersions}
                  title={versionsExpanded ? "收起画布上的版本链" : "在画布上展开版本链，逐版查看"}
                  className={cn(
                    "flex h-7 items-center gap-1 rounded-lg px-2 text-[10.5px] transition-colors",
                    versionsExpanded ? "bg-acc-yellow-bg text-acc-yellow-fg" : "text-muted hover:bg-surface-mute hover:text-ink",
                  )}
                >
                  <ArrowClockwise size={12} />
                  {versionCount} 版
                </button>
              )}
              <button
                type="button"
                onClick={copy}
                title="复制回答"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface-mute hover:text-ink"
              >
                {copied ? <span className="text-[10px] text-acc-green-fg">OK</span> : <Copy size={13} />}
              </button>
            </span>
          </div>

          <h1 className="mt-3 text-[15px] font-semibold leading-[1.6] text-ink">{current?.prompt ?? node.prompt}</h1>

          {previewVersion !== null && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-acc-yellow-fg/50 bg-acc-yellow-bg/40 px-2.5 py-1.5 text-[10.5px] text-acc-yellow-fg">
              <ArrowClockwise size={11} />
              正在看第 {previewVersion + 1}/{versionCount} 版（画布上的平级版本节点），当前版本未改动
              <button type="button" onClick={onExitPreview} className="ml-auto underline hover:text-ink">
                回到当前版
              </button>
            </div>
          )}

          {current?.pending ? (
            <div className="mt-5">
              <div className="mb-2 flex items-center gap-2 text-[10.5px] text-acc-blue-fg">
                <span className="h-2 w-2 animate-pulse rounded-full bg-acc-blue-fg" />
                正在逐字生成
                <span data-stream-chars={current.answer.length} className="ml-auto font-mono text-[9.5px] text-faint">
                  {current.answer.length} 字
                </span>
              </div>
              {current.answer ? (
                <div>
                  <Markdown text={current.answer} />
                  <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse bg-ink align-middle" />
                </div>
              ) : (
                <div className="space-y-2 py-1" aria-label="正在连接模型">
                  <div className="h-3 w-4/5 animate-pulse rounded bg-surface-mute" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-surface-mute" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-surface-mute" />
                </div>
              )}
            </div>
          ) : (
            <div className="mt-5">
              <Markdown text={current?.answer ?? ""} />
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-line pt-2.5 font-mono text-[9.5px] text-faint">
            <span>{current?.model}</span>
            <span>·</span>
            <span>{current?.date} {current?.time}</span>
            {versionCount > 1 && <span>· 第 {(node.activeRevision ?? 0) + 1}/{versionCount} 版</span>}
            {current?.synthetic && <span className="rounded bg-acc-yellow-bg px-1.5 py-[1px] text-acc-yellow-fg">演示回答</span>}
          </div>
        </section>
        )}
      </div>

      {/* 唯一的创作入口：只有追问与修改两种模式 */}
      <div className="shrink-0 border-t border-line bg-canvas/40 px-4 py-3">
        <div className="mb-2 flex items-center gap-1">
          {generating && (
            <span className="ml-auto flex items-center gap-1 text-[10px] text-acc-blue-fg">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-acc-blue-fg" />
              生成中
            </span>
          )}
          {!node ? (
            <span className="text-[10.5px] text-muted">第一个问题会成为根节点</span>
          ) : (
            ([
              ["continue", "追问", "在当前节点下长出子节点"],
              ["revise", "修改", "编辑这一问并产出新版本；原问题已填好，直接改"],
            ] as [FollowUpMode, string, string][]
            ).map(([m, label, hint]) => (
              <button
                key={m}
                type="button"
                title={hint}
                onClick={() => onComposerModeChange(m)}
                className={cn(
                  "flex items-center gap-1 rounded-lg px-2 py-1 text-[10.5px] transition-colors",
                  composerMode === m ? "bg-ink text-white" : "text-muted hover:bg-surface-mute hover:text-ink",
                )}
              >
                {m === "revise" && <PencilSimple size={11} />}
                {label}
              </button>
            ))
          )}
        </div>
        <div className="flex items-end gap-1.5 rounded-xl border border-line bg-surface p-1.5 focus-within:border-line-strong">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onComposerKey}
            rows={2}
            disabled={generating}
            placeholder={
              !node
                ? "写下第一个问题…（Enter 发送）"
                : composerMode === "revise"
                  ? "编辑上面的问题，改完直接发送…"
                  : "接着问点什么…（Enter 发送 / Shift+Enter 换行）"
            }
            className="min-h-[42px] min-w-0 flex-1 resize-none bg-transparent px-1.5 py-0.5 text-[11.5px] leading-[1.6] text-ink outline-none placeholder:text-faint disabled:opacity-60"
          />
          <div className="flex shrink-0 flex-col items-center gap-1">
            {draft && (
              <button type="button" aria-label="清空输入" onClick={() => setDraft("")} className="text-faint hover:text-ink">
                <X size={11} weight="bold" />
              </button>
            )}
            <button
              type="button"
              onClick={() => void send()}
              disabled={generating || !draft.trim()}
              aria-label={composerMode === "revise" ? "发送修改" : "发送追问"}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-white transition-opacity disabled:opacity-30"
            >
              <PaperPlaneTilt size={14} weight="fill" />
            </button>
          </div>
        </div>
        {!!node && composerMode === "revise" && (
          <p className="mt-1.5 text-[9.5px] leading-snug text-faint">
            已填入当前问题，直接改写即可。修改只产出新版本，不会长出新节点。
          </p>
        )}
      </div>
    </aside>
  );
}
