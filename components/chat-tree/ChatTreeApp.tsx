"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CaretUp, List, X } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/components/ui";
import { AnswerPanel } from "./AnswerPanel";
import { ConversationList } from "./ConversationList";
import { DevPanel } from "./DevPanel";
import { FirstRunTour, tourSeen } from "./FirstRunTour";
import { TreeCanvas, type FocusRequest, type NodeActions, type ViewCommand } from "./TreeCanvas";
import { layoutTree } from "@/lib/chat-tree/layout";
import { makeDemoAnswer, makeRevisionAnswer } from "@/lib/chat-tree/generate";
import { buildModelMessages, streamModelAnswer, type ModelMessage } from "@/lib/chat-tree/model";
import { SAMPLE_CONVERSATIONS } from "@/lib/chat-tree/sample";
import {
  answerOf,
  buildDisplayNodes,
  childrenOf,
  hiddenBranchCount,
  hiddenIds,
  nextNodeId,
  nowLabel,
  pathTo,
  pathToMarkdown,
  revisionNodeId,
  setActiveRevision,
  subtreeIds,
  visibleNodes,
  withRevision,
} from "@/lib/chat-tree/tree";
import type { ChatNode, Conversation, FollowUpMode, PersistedState, RevisionRef, TreeDirection } from "@/lib/chat-tree/types";

const STORAGE_KEY = "chat-tree-demo-v3";

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
    return typeof conv.id === "string" && typeof conv.title === "string" && Array.isArray(conv.nodes);
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
const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * 主壳：左侧会话列表 + 中间可缩放的提问树 + 右侧当前节点的回答。
 * 树数据保存在浏览器（localStorage）；新回答通过服务端 /api/chat 调用真实模型。
 */
export function ChatTreeApp() {
  const [conversations, setConversations] = useState<Conversation[]>(cloneSamples);
  const [activeConvId, setActiveConvId] = useState(SAMPLE_CONVERSATIONS[0]!.id);
  const [rawSelectedId, setRawSelectedId] = useState<string | null>(SAMPLE_CONVERSATIONS[0]!.nodes[0]!.id);
  const [direction, setDirection] = useState<TreeDirection>("LR");
  const [loaded, setLoaded] = useState(false);
  const [focusPath, setFocusPath] = useState(false);
  // 默认 false：隐藏分支仍留在画布上、只是灰显；打开「过滤隐藏」才真正从布局剔除。
  const [filterHidden, setFilterHidden] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [convQuery, setConvQuery] = useState("");
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const [mobileAnswerOpen, setMobileAnswerOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [viewCommand, setViewCommand] = useState<ViewCommand | null>(null);
  const [expandedVersions, setExpandedVersions] = useState<string[]>([]);
  /** 当前在看的回答版本：只影响右侧面板与路径高亮，不改动持久化的当前版本。 */
  const [selectedRevision, setSelectedRevision] = useState<RevisionRef | null>(null);
  const [composerMode, setComposerMode] = useState<FollowUpMode>("continue");
  /** 切到「修改」时预填原问题；token 递增触发面板重新填入并聚焦。 */
  const [prefill, setPrefill] = useState<{ text: string; token: number } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  /** 首次进入的一次性演示与开发面板都只在需要时挂载，不常驻主界面。 */
  const [showTour, setShowTour] = useState(false);
  const [showDev, setShowDev] = useState(false);
  const tokenRef = useRef(0);
  /** 同步锁：连点两次发送时，第二次要在 state 更新前就被挡住。 */
  const generatingRef = useRef(false);
  /** 流式 token 先攒在这里，按帧写回 state，避免每个字都整棵树重渲染。 */
  const streamRef = useRef<{ convId: string; id: string; revision: boolean; text: string } | null>(null);
  const flushTimerRef = useRef<number | null>(null);

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
            setFilterHidden(parsed.filterHidden);
            setExpandedVersions(parsed.expandedVersions);
          }
        }
      } catch {
        /* 存档损坏就退回示例数据 */
      }
      setShowTour(!tourSeen());
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () => () => {
      if (flushTimerRef.current !== null) window.clearTimeout(flushTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!loaded) return;
    const state: PersistedState = {
      conversations,
      activeConvId,
      selectedId: rawSelectedId,
      direction,
      filterHidden,
      expandedVersions,
    };
    // 流式期间节点内容更新很频繁；防抖后才落盘，避免每个 token 都写一次 localStorage。
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        /* 隐私模式 / 配额不足：不影响本次使用 */
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [loaded, conversations, activeConvId, rawSelectedId, direction, filterHidden, expandedVersions]);

  const activeConv = conversations.find((c) => c.id === activeConvId) ?? conversations[0]!;
  const nodes = activeConv.nodes;
  const selectedId = nodes.some((n) => n.id === rawSelectedId) ? rawSelectedId : (nodes[0]?.id ?? null);
  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;
  const ordinal = nodes.findIndex((n) => n.id === selectedId) + 1;

  const expandedSet = useMemo(() => new Set(expandedVersions), [expandedVersions]);
  // 版本只在展开时进入画布：与提问同层、用箭头串联，各自带自己的后继树。
  const displayNodes = useMemo(() => buildDisplayNodes(nodes, expandedSet), [nodes, expandedSet]);
  // 默认把隐藏节点也放进布局（整棵子树一起灰显）；开启「过滤隐藏」才从布局剔除。
  const layout = useMemo(() => layoutTree(visibleNodes(displayNodes, !filterHidden), direction), [displayNodes, direction, filterHidden]);
  const hiddenSet = useMemo(() => hiddenIds(displayNodes), [displayNodes]);
  // 版本没有真实节点可切换时（删掉 / 收起 / 换会话），自动退回当前版。
  const previewRevision =
    selectedRevision &&
    selectedRevision.ownerId === selectedId &&
    expandedSet.has(selectedId ?? "") &&
    selectedNode?.revisions?.[selectedRevision.index]
      ? selectedRevision
      : null;
  const pathIds = useMemo(() => {
    const ids = selectedId ? pathTo(nodes, selectedId).map((n) => n.id) : [];
    if (previewRevision && selectedId) ids.push(revisionNodeId(selectedId, previewRevision.index));
    return new Set(ids);
  }, [nodes, selectedId, previewRevision]);
  const matchIds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return new Set<string>();
    return new Set(displayNodes.filter((n) => n.prompt.toLowerCase().includes(q) || n.answer.toLowerCase().includes(q)).map((n) => n.id));
  }, [displayNodes, searchQuery]);
  const chain = useMemo(() => (selectedId ? pathTo(nodes, selectedId) : []), [nodes, selectedId]);
  // 预览历史版时只改读取视图：activeRevision 指向该版，数据本身不变。
  const panelNode =
    previewRevision && selectedNode?.revisions?.[previewRevision.index]
      ? { ...selectedNode, activeRevision: previewRevision.index }
      : selectedNode;

  const requestFocus = (id: string) => setFocusRequest({ id, token: ++tokenRef.current });
  const requestCommand = (kind: ViewCommand["kind"]) => setViewCommand({ kind, token: ++tokenRef.current });
  /** 切到修改模式就把当前（含预览版本）的问题填进输入框。 */
  const changeComposerMode = (mode: FollowUpMode) => {
    setComposerMode(mode);
    if (mode === "revise" && panelNode) {
      setPrefill({ text: answerOf(panelNode).prompt, token: ++tokenRef.current });
    } else if (mode === "continue") {
      // 从修改切回追问时清掉原问题，避免把旧问题误当成新问题发出去。
      setPrefill({ text: "", token: ++tokenRef.current });
    }
  };
  const selectAndFocus = (id: string, revision?: RevisionRef | null) => {
    setRawSelectedId(id);
    setSelectedRevision(revision ?? null);
    requestFocus(revision ? revisionNodeId(id, revision.index) : id);
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
    setSelectedRevision(null);
    setComposerMode("continue");
    setPrefill({ text: "", token: ++tokenRef.current });
    const first = c.nodes[0]?.id ?? null;
    setRawSelectedId(first);
    if (first) requestFocus(first);
  };

  /** 把攒下的 token 一次性写回：追问写顶层回答，修改写当前版本。 */
  const flushStream = () => {
    if (flushTimerRef.current !== null) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    const buf = streamRef.current;
    streamRef.current = null;
    if (!buf) return;
    const { convId, id, revision, text } = buf;
    updateNodes(convId, (list) =>
      list.map((n) => {
        if (n.id !== id) return n;
        // 攒下的只是「这一批 token」，要追加到已有回答上；直接赋值会让文字每段互相覆盖。
        if (!revision) return { ...n, answer: `${n.answer ?? ""}${text}`, pending: true };
        const revs = [...(n.revisions ?? [])];
        const i = Math.min(Math.max(n.activeRevision ?? revs.length - 1, 0), revs.length - 1);
        const prior = revs[i]?.answer ?? "";
        if (revs[i]) revs[i] = { ...revs[i]!, answer: `${prior}${text}`, pending: true };
        return { ...n, answer: `${n.answer ?? ""}${text}`, revisions: revs, pending: true };
      }),
    );
  };

  const pushToken = (convId: string, id: string, revision: boolean, token: string) => {
    const cur = streamRef.current;
    if (cur && cur.convId === convId && cur.id === id && cur.revision === revision) cur.text += token;
    else {
      flushStream();
      streamRef.current = { convId, id, revision, text: token };
    }
    if (flushTimerRef.current === null) {
      flushTimerRef.current = window.setTimeout(flushStream, 60);
    }
  };

  /** 收尾：写定最终回答 / 模型名，清掉生成中标记。 */
  const settleNode = (convId: string, id: string, revision: boolean, answer: string, model: string, synthetic: boolean) => {
    updateNodes(convId, (list) =>
      list.map((n) => {
        if (n.id !== id) return n;
        if (!revision) return { ...n, answer, model, synthetic, pending: false };
        const revs = [...(n.revisions ?? [])];
        const i = Math.min(Math.max(n.activeRevision ?? revs.length - 1, 0), revs.length - 1);
        if (revs[i]) revs[i] = { ...revs[i]!, answer, model, synthetic, pending: false };
        return { ...n, answer, model, synthetic, pending: false, revisions: revs };
      }),
    );
  };

  const addFollowUp = async (prompt: string, mode: FollowUpMode, targetId?: string): Promise<boolean> => {
    if (generatingRef.current) return false;

    const convId = activeConv.id;
    const { time, date } = nowLabel();
    const text = prompt.trim();
    // 修改也要有内容：原问题已经预填，用户可以直接发送，但空问题不合法。
    if (!text) return false;

    generatingRef.current = true;
    setModelError(null);
    setGenerating(true);

    const base = nodes.find((n) => n.id === (targetId ?? selectedId));
    if (nodes.length > 0 && !base) {
      generatingRef.current = false;
      setGenerating(false);
      return false;
    }

    let id = "";
    let revision = false;
    let messages: ModelMessage[] | null = null;
    let fallback = "";

    if (nodes.length === 0) {
      // 空会话：第一问直接成为根节点，不凭空造一个「默认提问」。
      id = nextNodeId(nodes);
      const fresh: ChatNode = {
        id,
        parentId: null,
        parentRevision: 0,
        prompt: text,
        answer: "",
        model: "生成中…",
        time,
        date,
        pending: true,
      };
      messages = buildModelMessages([], text, "continue");
      fallback = makeDemoAnswer(text, "");
      updateNodes(convId, () => [fresh]);
      setRawSelectedId(id);
      setSelectedRevision(null);
      requestFocus(id);
    } else if (mode === "revise" && base) {
      // 修改：用编辑后的问题先落一个空的「生成中」版本，token 到达后逐字填进去。
      revision = true;
      id = base.id;
      messages = buildModelMessages(pathTo(nodes, base.id), text, "revise", answerOf(base).answer);
      fallback = makeRevisionAnswer(base, text);
      setSelectedRevision(null);
      setExpandedVersions((prev) => (prev.includes(base.id) ? prev : [...prev, base.id]));
      updateNodes(convId, (list) =>
        list.map((n) => (n.id === base.id ? withRevision(n, text, "", "生成中…", time, date, "修改") : n)),
      );
      setRawSelectedId(base.id);
    } else if (base) {
      // 追问：挂在当前节点下；若正在预览旧版，则这一问跟随那一版，继承它的后继树。
      const parentId = base.id;
      const parentRevision = previewRevision?.ownerId === base.id
        ? previewRevision.index
        : (base.activeRevision ?? 0);

      id = nextNodeId(nodes);
      const fresh: ChatNode = {
        id,
        parentId,
        parentRevision,
        prompt: text,
        answer: "",
        model: "生成中…",
        time,
        date,
        pending: true,
      };
      messages = buildModelMessages(pathTo(nodes, parentId), text, "continue");
      const followBase =
        previewRevision?.ownerId === base.id && base.revisions?.[previewRevision.index]
          ? { ...base, activeRevision: previewRevision.index }
          : base;
      fallback = makeDemoAnswer(text, answerOf(followBase).prompt);
      // 如果挂在折叠节点下，先展开，否则新分支看不见。
      updateNodes(convId, (list) => [
        ...list.map((n) => (n.id === parentId && n.collapsed ? { ...n, collapsed: false } : n)),
        fresh,
      ]);
      setRawSelectedId(id);
      setSelectedRevision(null);
      requestFocus(id);
    }

    if (!messages) {
      generatingRef.current = false;
      setGenerating(false);
      return false;
    }

    // 调用方立即返回：提问已经上树、输入框可以马上清空，网络请求在后台流式写回。
    const finalMessages: ModelMessage[] = messages;
    void (async () => {
      try {
        const result = await streamModelAnswer(finalMessages, (token) => pushToken(convId, id, revision, token));
        flushStream();
        settleNode(convId, id, revision, result.answer, result.model, false);
      } catch (error) {
        flushStream();
        settleNode(convId, id, revision, fallback, "本地模板", true);
        setModelError(`${errorMessage(error)}，已回退到本地模板回答。`);
      } finally {
        generatingRef.current = false;
        setGenerating(false);
      }
    })();

    return true;
  };

  /** 右键 / 角标 / 面板按钮统一走这里：展开的伪分支直接进画布，不再是弹窗。 */
  const toggleVersions = (id: string) => {
    const target = nodes.find((n) => n.id === id);
    if (!target?.revisions?.length) return;
    setExpandedVersions((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    if (selectedRevision?.ownerId === id) setSelectedRevision(null);
  };

  /** 在伪分支卡片上「切回此版」：真正改写当前版本，但保留展开状态便于继续对照。 */
  const restoreRevision = (ownerId: string, index: number) => {
    updateNodes(activeConv.id, (list) => list.map((n) => (n.id === ownerId ? setActiveRevision(n, index) : n)));
    setSelectedRevision(null);
    setRawSelectedId(ownerId);
    requestFocus(ownerId);
  };

  /**
   * 批准 / 撤销「跟随到当前版」。批准值绑定父提问当时的 activeRevision：
   * 当前版一换就自动过期，子树退回 parentRevision 那一版，不会悄悄归档。
   */
  const setFollow = (id: string, follow: boolean) => {
    const node = nodes.find((n) => n.id === id);
    if (!node?.parentId) return;
    const parent = nodes.find((n) => n.id === node.parentId);
    if (!parent) return;
    const active = parent.activeRevision ?? 0;
    updateNodes(activeConv.id, (list) =>
      list.map((n) => (n.id === id ? { ...n, followRevision: follow ? active : null } : n)),
    );
    requestFocus(id);
  };

  const toggleHidden = (id: string) => {
    const target = nodes.find((n) => n.id === id);
    if (!target) return;
    const willHide = !target.hidden;
    // 隐藏作用于整棵子树；反过来取消隐藏时，祖先也要一起解开，否则点了还是灰的。
    const affected = new Set(
      willHide ? [id] : [...pathTo(nodes, id).map((n) => n.id)],
    );
    if (willHide && filterHidden && selectedId && subtreeIds(nodes, id).has(selectedId) && target.parentId) {
      setRawSelectedId(target.parentId);
      setSelectedRevision(null);
    }
    updateNodes(activeConv.id, (list) => list.map((n) => (affected.has(n.id) ? { ...n, hidden: willHide } : n)));
  };

  const toggleCollapse = (id: string) => {
    const target = nodes.find((n) => n.id === id);
    if (!target) return;
    const willCollapse = !target.collapsed;
    if (willCollapse && selectedId && subtreeIds(nodes, id).has(selectedId) && selectedId !== id) {
      setRawSelectedId(id);
    }
    if (willCollapse && selectedRevision && subtreeIds(nodes, id).has(selectedRevision.ownerId)) {
      setSelectedRevision(null);
    }
    updateNodes(activeConv.id, (list) => list.map((n) => (n.id === id ? { ...n, collapsed: willCollapse } : n)));
  };

  const deleteBranch = (id?: string) => {
    const target = nodes.find((n) => n.id === (id ?? selectedId));
    if (!target?.parentId) return;
    const gone = subtreeIds(nodes, target.id);
    const parentId = target.parentId;
    updateNodes(activeConv.id, (list) => list.filter((n) => !gone.has(n.id)));
    if (selectedRevision && gone.has(selectedRevision.ownerId)) setSelectedRevision(null);
    setExpandedVersions((prev) => prev.filter((x) => !gone.has(x)));
    selectAndFocus(parentId);
  };

  const copyAnswer = (id: string, override?: ChatNode | null) => {
    const target = override ?? nodes.find((n) => n.id === id);
    if (!target) return;
    const a = answerOf(target);
    if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(a.answer);
  };

  /** 右键菜单的全部操作：先选中目标节点，再分派到对应的数据操作。 */
  const nodeActions: NodeActions = {
    followUp: (id) => {
      setRawSelectedId(id);
      setSelectedRevision(null);
      setComposerMode("continue");
      setPrefill({ text: "", token: ++tokenRef.current });
    },
    // 右键「修改这一问」不直接生成：选中目标、填入原问题，让用户先改。
    revise: (id) => {
      const target = nodes.find((n) => n.id === id);
      if (!target) return;
      setRawSelectedId(id);
      setSelectedRevision(null);
      setComposerMode("revise");
      setPrefill({ text: answerOf(target).prompt, token: ++tokenRef.current });
      setMobileAnswerOpen(true);
    },
    toggleVersions,
    hide: (id) => toggleHidden(id),
    collapse: (id) => toggleCollapse(id),
    copy: (id) => copyAnswer(id),
    remove: (id) => deleteBranch(id),
    follow: setFollow,
  };

  const newConversation = () => {
    const id = `conv-${Date.now()}`;
    const { time } = nowLabel();
    const conv: Conversation = {
      id,
      title: "新会话",
      group: "今天",
      updated: time,
      nodes: [],
    };
    setConversations((prev) => [conv, ...prev]);
    setActiveConvId(id);
    setRawSelectedId(null);
    setSelectedRevision(null);
    setComposerMode("continue");
    setPrefill({ text: "", token: ++tokenRef.current });
  };

  const deleteConversation = (id: string) => {
    if (conversations.length <= 1) return;
    const rest = conversations.filter((c) => c.id !== id);
    setConversations(rest);
    if (id === activeConvId) {
      const next = rest[0]!;
      setActiveConvId(next.id);
      setSelectedRevision(null);
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
    setFilterHidden(false);
    setSearchQuery("");
    setExpandedVersions([]);
    setSelectedRevision(null);
    setComposerMode("continue");
    setPrefill({ text: "", token: ++tokenRef.current });
    requestFocus(SAMPLE_CONVERSATIONS[0]!.nodes[0]!.id);
  };

  const clearStorage = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* 忽略隐私模式下的写入失败 */
    }
    window.location.reload();
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
      // 有些合成事件的 target 不是 Element（如 window），closest 不存在，直接放行。
      if (e.target instanceof Element && e.target.closest("input, textarea, [contenteditable='true']")) return;
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
        case "h":
        case "H":
          setFilterHidden((v) => !v);
          break;
        case "v":
        case "V":
          toggleVersions(selectedNode.id);
          break;
        case "Escape":
          setSearchQuery("");
          setFocusPath(false);
          setSelectedRevision(null);
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
            onClose={() => setMobileListOpen(false)}
          />
        </div>

        <TreeCanvas
          conversation={activeConv}
          displayNodes={displayNodes}
          layout={layout}
          selectedId={selectedId}
          selectedRevision={previewRevision}
          pathIds={pathIds}
          focusPath={focusPath}
          matchIds={matchIds}
          searchQuery={searchQuery}
          direction={direction}
          focusRequest={focusRequest}
          viewCommand={viewCommand}
          filterHidden={filterHidden}
          hiddenCount={hiddenBranchCount(nodes)}
          hiddenIds={hiddenSet}
          expandedVersions={expandedSet}
          onFilterHiddenChange={setFilterHidden}
          onSelect={(id, revision) => {
            setRawSelectedId(id);
            setSelectedRevision(revision ?? null);
            if (revision) requestFocus(revisionNodeId(id, revision.index));
            setMobileAnswerOpen(true);
          }}
          onDirectionChange={setDirection}
          onSearchChange={setSearchQuery}
          onFocusPathChange={setFocusPath}
          onExportJson={exportJson}
          onExportPath={exportPath}
          onRestoreRevision={restoreRevision}
          nodeActions={nodeActions}
          onOpenDev={() => setShowDev(true)}
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
              node={panelNode}
              ordinal={ordinal}
              chainLength={chain.length}
              composerMode={composerMode}
              versionsExpanded={!!selectedId && expandedSet.has(selectedId)}
              previewVersion={previewRevision?.index ?? null}
              prefill={prefill}
              generating={generating}
              modelError={modelError}
              onDismissModelError={() => setModelError(null)}
              onComposerModeChange={changeComposerMode}
              onFollowUp={addFollowUp}
              onRevise={(text) => (selectedId ? addFollowUp(text, "revise", selectedId) : Promise.resolve(false))}
              onCopy={() => selectedId && copyAnswer(selectedId, panelNode)}
              onToggleVersions={() => selectedId && toggleVersions(selectedId)}
              onExitPreview={() => setSelectedRevision(null)}
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

      {showTour && <FirstRunTour onClose={() => setShowTour(false)} />}
      {showDev && (
        <DevPanel
          onClose={() => setShowDev(false)}
          onReset={resetDemo}
          onClear={clearStorage}
          storageKey={STORAGE_KEY}
        />
      )}
    </div>
  );
}
