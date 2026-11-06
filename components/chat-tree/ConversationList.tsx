"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowClockwise,
  ChatsCircle,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Trash,
  TreeStructure,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/components/ui";
import { treeStats } from "@/lib/chat-tree/tree";
import type { Conversation } from "@/lib/chat-tree/types";

const GROUPS = ["今天", "昨天", "更早"] as const;

export function ConversationList({
  conversations,
  activeId,
  query,
  onQueryChange,
  onSelect,
  onNew,
  onRename,
  onDelete,
  onReset,
  onClose,
}: {
  conversations: Conversation[];
  activeId: string;
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onReset: () => void;
  onClose?: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) editRef.current?.focus();
  }, [editingId]);

  const q = query.trim().toLowerCase();
  const filtered = conversations.filter(
    (c) =>
      !q ||
      c.title.toLowerCase().includes(q) ||
      c.nodes.some((n) => n.prompt.toLowerCase().includes(q) || n.answer.toLowerCase().includes(q)),
  );

  const commitRename = () => {
    if (editingId && draft.trim()) onRename(editingId, draft.trim());
    setEditingId(null);
  };

  return (
    <aside className="flex h-full w-full flex-col border-r border-line bg-surface lg:w-[248px] lg:shrink-0">
      <header className="border-b border-line px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-white">
            <TreeStructure size={17} weight="fill" />
          </span>
          <div className="min-w-0">
            <h1 className="text-[13px] font-semibold leading-tight text-ink">对话树</h1>
            <p className="truncate text-[10px] text-faint">提问即节点 · 分支可回溯</p>
          </div>
          {onClose && (
            <button
              type="button"
              aria-label="关闭会话列表"
              onClick={onClose}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted hover:bg-surface-mute hover:text-ink lg:hidden"
            >
              <X size={13} weight="bold" />
            </button>
          )}
          <Link
            href="/"
            className="ml-auto shrink-0 rounded border border-line px-1.5 py-0.5 font-mono text-[9.5px] text-faint transition-colors hover:border-line-strong hover:text-ink"
          >
            工具箱
          </Link>
        </div>
        <button
          type="button"
          onClick={onNew}
          className="mt-3 flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-line-strong bg-canvas text-[12px] font-medium text-ink transition-colors hover:bg-surface-mute"
        >
          <Plus size={13} weight="bold" />
          新建会话
        </button>
        <div className="mt-2 flex h-8 items-center gap-2 rounded-md border border-line bg-canvas px-2.5 focus-within:border-line-strong">
          <MagnifyingGlass size={13} className="shrink-0 text-faint" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="搜索会话或提问"
            className="h-full min-w-0 flex-1 bg-transparent text-[11.5px] text-ink outline-none placeholder:text-faint"
          />
          {query && (
            <button type="button" aria-label="清除" onClick={() => onQueryChange("")} className="text-faint hover:text-ink">
              <X size={11} weight="bold" />
            </button>
          )}
        </div>
      </header>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {filtered.length === 0 && <p className="px-2 py-6 text-center text-[11.5px] text-faint">没有匹配的会话</p>}
        {GROUPS.map((group) => {
          const items = filtered.filter((c) => c.group === group);
          if (!items.length) return null;
          return (
            <div key={group} className="mb-3">
              <div className="px-2 pb-1.5 pt-1 font-mono text-[10px] uppercase tracking-wider text-faint">{group}</div>
              {items.map((c) => {
                const active = c.id === activeId;
                const stats = treeStats(c.nodes);
                const last = c.nodes[c.nodes.length - 1]?.prompt ?? "空会话";
                const editing = editingId === c.id;
                const shell = cn(
                  "flex w-full flex-col gap-1 rounded-lg px-2.5 py-2 pr-14 text-left transition-colors",
                  active ? "bg-ink text-white" : "text-ink-soft hover:bg-surface-mute",
                );
                const meta = (
                  <>
                    <span className={cn("truncate text-[10.5px]", active ? "text-white/60" : "text-faint")}>{last}</span>
                    <span className={cn("flex items-center gap-1.5 font-mono text-[9.5px]", active ? "text-white/55" : "text-faint")}>
                      <span>{c.updated}</span>
                      <span>·</span>
                      <span>{stats.count} 节点</span>
                      {stats.forks > 0 && (
                        <>
                          <span>·</span>
                          <span>{stats.forks} 分叉</span>
                        </>
                      )}
                    </span>
                  </>
                );
                return (
                  <div key={c.id} className="group relative">
                    {editing ? (
                      <div className={shell}>
                        <input
                          ref={editRef}
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename();
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="h-6 w-full rounded border border-line-strong bg-surface px-1.5 text-[12.5px] text-ink outline-none"
                        />
                        {meta}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelect(c.id)}
                        onDoubleClick={() => {
                          setDraft(c.title);
                          setEditingId(c.id);
                        }}
                        className={shell}
                      >
                        <span className="truncate text-[12.5px] font-medium">{c.title}</span>
                        {meta}
                      </button>
                    )}
                    {!editing && (
                      <div className="absolute right-1.5 top-2 hidden items-center gap-0.5 group-hover:flex">
                        <button
                          type="button"
                          aria-label="重命名会话"
                          title="重命名"
                          onClick={() => {
                            setDraft(c.title);
                            setEditingId(c.id);
                          }}
                          className="flex h-5 w-5 items-center justify-center rounded text-faint hover:bg-surface-mute hover:text-ink"
                        >
                          <PencilSimple size={12} />
                        </button>
                        <button
                          type="button"
                          aria-label={confirmDelete === c.id ? "再点一次确认删除" : "删除会话"}
                          title={confirmDelete === c.id ? "再点一次确认删除" : "删除会话"}
                          onClick={() => {
                            if (confirmDelete === c.id) {
                              onDelete(c.id);
                              setConfirmDelete(null);
                            } else setConfirmDelete(c.id);
                          }}
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded hover:bg-surface-mute",
                            confirmDelete === c.id ? "text-acc-red-fg" : "text-faint hover:text-ink",
                          )}
                        >
                          <Trash size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </nav>

      <footer className="shrink-0 border-t border-line p-3">
        <div className="mb-2.5 rounded-md border border-line bg-canvas px-2.5 py-2 text-[10.5px] leading-[1.7] text-muted">
          <span className="mb-1 flex items-center gap-1.5 font-medium text-ink">
            <ChatsCircle size={12} />
            怎么用
          </span>
          点节点 → 右侧看回答；在右侧继续追问 → 长出新分支；追问链可单独导出。
        </div>
        <button
          type="button"
          onClick={() => {
            if (confirmReset) {
              onReset();
              setConfirmReset(false);
            } else setConfirmReset(true);
          }}
          onBlur={() => setConfirmReset(false)}
          className={cn(
            "flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 text-[11px] transition-colors",
            confirmReset ? "bg-acc-red-bg text-acc-red-fg" : "text-faint hover:bg-surface-mute hover:text-ink",
          )}
        >
          <ArrowClockwise size={12} />
          {confirmReset ? "再点一次恢复示例数据" : "恢复示例数据"}
        </button>
        <p className="mt-1.5 text-center text-[9.5px] leading-relaxed text-faint">改动保存在浏览器 localStorage · 纯前端演示，不接模型 API</p>
      </footer>
    </aside>
  );
}
