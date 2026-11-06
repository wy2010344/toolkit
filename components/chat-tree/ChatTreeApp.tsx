"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CaretUp, List, X } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/components/ui";
import { AnswerPanel } from "./AnswerPanel";
import { ConversationList } from "./ConversationList";
import { TreeCanvas, type FocusRequest, type ViewCommand } from "./TreeCanvas";
import { layoutTree } from "@/lib/chat-tree/layout";
import { makeDemoAnswer } from "@/lib/chat-tree/generate";
import { SAMPLE_CONVERSATIONS } from "@/lib/chat-tree/sample";
import { childrenOf, nextNodeId, nowLabel, pathTo, pathToMarkdown, subtreeIds } from "@/lib/chat-tree/tree";
import type { ChatNode, Conversation, FollowUpMode, PersistedState, TreeDirection } from "@/lib/chat-tree/types";

const STORAGE_KEY = "chat-tree-demo-v1";

function cloneSamples(): Conversation[] {
  return SAMPLE_CONVERSATIONS.map((c) => ({ ...c, nodes: c.nodes.map((n) => ({ ...n })) }));
}

function isPersistedState(v: unknown): v is PersistedState {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.conversations) || o.conversations.length === 0) return false;
  if (typeof o.activeConvId !== "string") return false;
  if (o.selectedId !== null && typeof o.selectedId !== "string") return false;
  if (o.direction !== "LR" && o.direction !== "TB") return false;
  return o.conversations.every((c) => {
    if (!c || typeof c !== "object") return false;
    const conv = c as Record<string, unknown>;
    return typeof conv.id === "string" && typeof conv.title === "string" && Array.isArray(conv.nodes) && conv.nodes.length > 0;
  });
}

function download(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]/g, "_").slice(0, 40);

/**
 * 主壳：左侧会话列表 + 中间可缩放的提问树 + 右侧当前节点的回答。
 * 所有数据都在浏览器里（localStorage），没有后端、没有模型调用。
 */
export function ChatTreeApp() {
  const [conversations, setConversations] = useState<Conversation[]>(cloneSamples);
  const [activeConvId, setActiveConvId] = useState(SAMPLE_CONVERSATIONS[0]!.id);
  const [rawSelectedId, setRawSelectedId] = useState<string | null>(SAMPLE_CONVERSATIONS[0]!.nodes[0]!.id);
  const [direction, setDirection] = useState<TreeDirection>("LR");
  const [loaded, setLoaded] = useState(false);
  const [focusPath, setFocusPath] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [convQuery, setConvQuery] = useState("");
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const [mobileAnswerOpen, setMobileAnswerOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [viewCommand, setViewCommand] = useState<ViewCommand | null>(null);
  const tokenRef = useRef(0);

  // 读本地存档放到微任务里执行，避免水合期间同步改状态。
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (isPersistedState(parsed)) {
            setConversations(parsed.conversations);
            setActiveConvId(parsed.activeConvId);
            setRawSelectedId(parsed.selectedId);
            setDirection(parsed.direction);
          }
        }
      } catch {
        /* 存档损坏就退回示例数据 */
      }
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const state: PersistedState = { conversations, activeConvId, selectedId: rawSelectedId, direction };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* 隐私模式 / 配额不足：不影响本次使用 */
    }
  }, [loaded, conversations, activeConvId, rawSelectedId, direction]);

  const activeConv = conversations.find((c) => c.id === activeConvId) ?? conversations[0]!;
  const nodes = activeConv.nodes;
  const selectedId = nodes.some((n) => n.id === rawSelectedId) ? rawSelectedId : (nodes[0]?.id ?? null);
  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;
  const ordinal = nodes.findIndex((n) => n.id === selectedId) + 1;

  const layout = useMemo(() => layoutTree(nodes, direction), [nodes, direction]);
  const pathIds = useMemo(
    () => new Set(selectedId ? pathTo(nodes, selectedId).map((n) => n.id) : []),
    [nodes, selectedId],
  );
  const matchIds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return new Set<string>();
    return new Set(nodes.filter((n) => n.prompt.toLowerCase().includes(q) || n.answer.toLowerCase().includes(q)).map((n) => n.id));
  }, [nodes, searchQuery]);
  const chain = useMemo(() => (selectedId ? pathTo(nodes, selectedId) : []), [nodes, selectedId]);
  const childrenNodes = useMemo(() => (selectedId ? childrenOf(nodes, selectedId) : []), [nodes, selectedId]);

  const requestFocus = (id: string) => setFocusRequest({ id, token: ++tokenRef.current });
  const requestCommand = (kind: ViewCommand["kind"]) => setViewCommand({ kind, token: ++tokenRef.current });
  const selectAndFocus = (id: string) => {
    setRawSelectedId(id);
    requestFocus(id);
  };

  const updateNodes = (convId: string, fn: (list: ChatNode[]) => ChatNode[]) => {
    const { time } = nowLabel();
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, nodes: fn(c.nodes), updated: time, group: "今天" } : c)),
    );
  };

  const selectConversation = (id: string) => {
    const c = conversations.find((x) => x.id === id);
    if (!c) return;
    setActiveConvId(id);
    setSearchQuery("");
    const first = c.nodes[0]?.id ?? null;
    setRawSelectedId(first);
    if (first) requestFocus(first);
  };

  const addFollowUp = (prompt: string, mode: FollowUpMode) => {
    if (!selectedNode) return;
    const parentId = mode === "regenerate" && selectedNode.parentId ? selectedNode.parentId : selectedNode.id;
    const parent = nodes.find((n) => n.id === parentId) ?? selectedNode;
    const id = nextNodeId(nodes);
    const { time, date } = nowLabel();
    const fresh: ChatNode = {
      id,
      parentId,
      prompt,
      answer: makeDemoAnswer(prompt, parent.prompt, mode),
      model: "本地模板",
      time,
      date,
      badge: mode === "regenerate" ? "换个问法" : "新追问",
      synthetic: true,
    };
    // 如果挂在折叠节点下，先展开，否则新分支看不见。
    updateNodes(activeConv.id, (list) => [...list.map((n) => (n.id === parentId && n.collapsed ? { ...n, collapsed: false } : n)), fresh]);
    setRawSelectedId(id);
    requestFocus(id);
  };

  const toggleCollapse = (id: string) => {
    const target = nodes.find((n) => n.id === id);
    if (!target) return;
    const willCollapse = !target.collapsed;
    if (willCollapse && selectedId && subtreeIds(nodes, id).has(selectedId) && selectedId !== id) {
      setRawSelectedId(id);
    }
    updateNodes(activeConv.id, (list) => list.map((n) => (n.id === id ? { ...n, collapsed: willCollapse } : n)));
  };

  const deleteBranch = () => {
    if (!selectedNode?.parentId) return;
    const gone = subtreeIds(nodes, selectedNode.id);
    const parentId = selectedNode.parentId;
    updateNodes(activeConv.id, (list) => list.filter((n) => !gone.has(n.id)));
    selectAndFocus(parentId);
  };

  const toggleStar = () => {
    if (!selectedNode) return;
    updateNodes(activeConv.id, (list) => list.map((n) => (n.id === selectedNode.id ? { ...n, starred: !n.starred } : n)));
  };

  const newConversation = () => {
    const id = `conv-${Date.now()}`;
    const { time, date } = nowLabel();
    const conv: Conversation = {
      id,
      title: "新会话",
      group: "今天",
      updated: time,
      nodes: [
        {
          id: "n-root",
          parentId: null,
          prompt: "这是一次新对话的开场提问",
          answer: "> 空会话已建好。在右下角输入追问，就会从这个根节点开始长出第一条分支；也可以双击左侧标题重命名。",
          model: "本地模板",
          time,
          date,
          synthetic: true,
        },
      ],
    };
    setConversations((prev) => [conv, ...prev]);
    setActiveConvId(id);
    setRawSelectedId("n-root");
    requestFocus("n-root");
  };

  const deleteConversation = (id: string) => {
    if (conversations.length <= 1) return;
    const rest = conversations.filter((c) => c.id !== id);
    setConversations(rest);
    if (id === activeConvId) {
      const next = rest[0]!;
      setActiveConvId(next.id);
      const first = next.nodes[0]?.id ?? null;
      setRawSelectedId(first);
      if (first) requestFocus(first);
    }
  };

  const renameConversation = (id: string, title: string) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
  };

  const resetDemo = () => {
    setConversations(cloneSamples());
    setActiveConvId(SAMPLE_CONVERSATIONS[0]!.id);
    setRawSelectedId(SAMPLE_CONVERSATIONS[0]!.nodes[0]!.id);
    setDirection("LR");
    setFocusPath(false);
    setSearchQuery("");
    requestFocus(SAMPLE_CONVERSATIONS[0]!.nodes[0]!.id);
  };

  const exportPath = () => {
    if (!selectedId) return;
    download(`${safeName(activeConv.title)}-追问链.md`, pathToMarkdown(activeConv, selectedId), "text/markdown;charset=utf-8");
  };

  const exportJson = () => {
    download(`${safeName(activeConv.title)}-对话树.json`, JSON.stringify(activeConv, null, 2), "application/json;charset=utf-8");
  };

  // 键盘：↑ 父 / ↓ 子 / ←→ 兄弟，+ - 0 缩放，f 聚焦路径，Esc 清搜索。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, [contenteditable='true']")) return;
      if (!selectedNode) return;
      const siblings = nodes.filter((n) => n.parentId === selectedNode.parentId);
      const idx = siblings.findIndex((n) => n.id === selectedNode.id);
      const kids = childrenOf(nodes, selectedNode.id);
      const parent = selectedNode.parentId ? nodes.find((n) => n.id === selectedNode.parentId) : undefined;
      let target: string | undefined;
      switch (e.key) {
        case "ArrowUp":
          target = parent?.id;
          break;
        case "ArrowDown":
          target = kids[0]?.id;
          break;
        case "ArrowLeft":
          target = siblings[idx - 1]?.id;
          break;
        case "ArrowRight":
          target = siblings[idx + 1]?.id;
          break;
        case "+":
        case "=":
          requestCommand("zoomIn");
          break;
        case "-":
        case "_":
          requestCommand("zoomOut");
          break;
        case "0":
          requestCommand("fit");
          break;
        case "f":
        case "F":
          setFocusPath((v) => !v);
          break;
        case "Escape":
          setSearchQuery("");
          setFocusPath(false);
          setMobileListOpen(false);
          setMobileAnswerOpen(false);
          break;
        default:
          return;
      }
      e.preventDefault();
      if (target) selectAndFocus(target);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, selectedNode, selectedId]);

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-canvas text-ink">
      {/* 窄屏顶栏：桌面三栏常驻，不需要这一条 */}
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 lg:hidden">
        <button
          type="button"
          aria-label="打开会话列表"
          onClick={() => setMobileListOpen(true)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-canvas text-ink"
        >
          <List size={17} weight="bold" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-semibold text-ink">{activeConv.title}</div>
          <div className="font-mono text-[9px] text-faint">
            {nodes.length} 节点 · 当前第 {chain.length} 轮
          </div>
        </div>
        <button
          type="button"
          data-mobile-answer="1"
          onClick={() => setMobileAnswerOpen(true)}
          className="flex h-8 shrink-0 items-center gap-1 rounded-md bg-ink px-2.5 text-[11.5px] font-medium text-white"
        >
          回答 <CaretUp size={12} weight="bold" />
        </button>
      </header>

      {/* 抽屉遮罩 */}
      {(mobileListOpen || mobileAnswerOpen) && (
        <div
          className="fixed inset-0 z-30 bg-ink/35 backdrop-blur-[1px] lg:hidden"
          aria-hidden
          onClick={() => {
            setMobileListOpen(false);
            setMobileAnswerOpen(false);
          }}
        />
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* 左：宽屏常驻 / 窄屏左侧抽屉 */}
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-[min(84vw,300px)] shadow-2xl transition-transform duration-200 lg:static lg:z-auto lg:w-auto lg:translate-x-0 lg:shadow-none lg:transition-none",
            mobileListOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <ConversationList
            conversations={conversations}
            activeId={activeConv.id}
            query={convQuery}
            onQueryChange={setConvQuery}
            onSelect={(id) => {
              selectConversation(id);
              setMobileListOpen(false);
            }}
            onNew={() => {
              newConversation();
              setMobileListOpen(false);
            }}
            onRename={renameConversation}
            onDelete={deleteConversation}
            onReset={resetDemo}
            onClose={() => setMobileListOpen(false)}
          />
        </div>

        <TreeCanvas
          conversation={activeConv}
          layout={layout}
          selectedId={selectedId}
          pathIds={pathIds}
          focusPath={focusPath}
          matchIds={matchIds}
          searchQuery={searchQuery}
          direction={direction}
          focusRequest={focusRequest}
          viewCommand={viewCommand}
          onSelect={(id) => {
            setRawSelectedId(id);
            setMobileAnswerOpen(true);
          }}
          onToggleCollapse={toggleCollapse}
          onDirectionChange={setDirection}
          onSearchChange={setSearchQuery}
          onFocusPathChange={setFocusPath}
          onExportJson={exportJson}
        />

        {/* 右：宽屏常驻 / 窄屏底部抽屉（点节点自动升起） */}
        <div
          className={cn(
            "fixed inset-x-0 bottom-0 z-40 flex h-[min(80dvh,680px)] flex-col overflow-hidden rounded-t-xl border-t border-line bg-surface shadow-[0_-16px_44px_-18px_rgba(0,0,0,0.45)] transition-transform duration-200 lg:static lg:z-auto lg:h-auto lg:w-auto lg:shrink-0 lg:rounded-none lg:border-t-0 lg:border-l lg:shadow-none lg:translate-y-0 lg:transition-none",
            mobileAnswerOpen ? "translate-y-0" : "translate-y-full",
          )}
        >
          <div className="flex h-9 shrink-0 items-center justify-between border-b border-line px-3 lg:hidden">
            <span className="text-[11px] text-muted">回答 · 点图中节点可切换</span>
            <button
              type="button"
              aria-label="关闭回答"
              onClick={() => setMobileAnswerOpen(false)}
              className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-surface-mute hover:text-ink"
            >
              <X size={14} weight="bold" />
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <AnswerPanel
              conversation={activeConv}
              node={selectedNode}
              chain={chain}
              childrenNodes={childrenNodes}
              ordinal={ordinal}
              onSelect={selectAndFocus}
              onFollowUp={addFollowUp}
              onExportPath={exportPath}
              onDelete={deleteBranch}
              onToggleCollapse={() => selectedId && toggleCollapse(selectedId)}
              onToggleStar={toggleStar}
            />
          </div>
        </div>
      </div>

      {/* 窄屏底部提示条：不用打开抽屉也知道当前选了哪一问 */}
      {!mobileAnswerOpen && selectedNode && (
        <button
          type="button"
          data-mobile-answer="1"
          onClick={() => setMobileAnswerOpen(true)}
          className="absolute bottom-3 left-3 right-3 z-20 flex items-center gap-2 rounded-lg border border-line bg-surface/95 px-3 py-2 text-left shadow-md backdrop-blur lg:hidden"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-mono text-[9px] text-faint">当前提问 · Q{String(ordinal).padStart(2, "0")}</span>
            <span className="block truncate text-[11.5px] text-ink">{selectedNode.prompt}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted">
            查看回答 <CaretUp size={12} />
          </span>
        </button>
      )}
    </div>
  );
}
