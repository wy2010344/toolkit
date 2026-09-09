"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowsLeftRight, CaretDown, FolderOpen, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { Button, IconButton, Notice, ProgressBar, Spinner, StatusBadge, Toggle, cn } from "@/components/ui";
import { basename, formatBytes, formatCount, formatDuration, toPosix } from "@/lib/dirdiff/format";
import { fetchGroups, postJson, streamCompare } from "@/lib/dirdiff/client";
import type {
  CompareEntry,
  CompareResult,
  DiffGroup,
  ProgressPayload,
} from "@/lib/dirdiff/types";
import { GroupRail } from "./GroupRail";
import { EntryDetail } from "./EntryDetail";
import { SyncPanel } from "./SyncPanel";

type CompareState =
  | { phase: "idle" }
  | { phase: "running"; progress: ProgressPayload | null }
  | { phase: "done"; result: CompareResult }
  | { phase: "error"; message: string };

type FilterKey = "diff" | "left" | "right" | "modified" | "conflict" | "all";

interface Draft {
  name: string;
  left: string;
  right: string;
  ignoreText: string;
  includeHidden: boolean;
  includeEqual: boolean;
}

interface Toast {
  tone: "error" | "ok";
  msg: string;
}

const DEFAULT_IGNORE = ["node_modules", "*.log", ".DS_Store"].join("\n");

function emptyDraft(): Draft {
  return { name: "", left: "", right: "", ignoreText: DEFAULT_IGNORE, includeHidden: false, includeEqual: false };
}

export function DirDiffApp() {
  const [groups, setGroups] = useState<DiffGroup[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [compare, setCompare] = useState<CompareState>({ phase: "idle" });
  const [filter, setFilter] = useState<FilterKey>("diff");
  const [query, setQuery] = useState("");
  const [browsing, setBrowsing] = useState<"A" | "B" | null>(null);
  const [detail, setDetail] = useState<CompareEntry | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    fetchGroups().then(setGroups).catch(() => {});
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const currentGroup = groups.find((g) => g.id === activeId) ?? null;
  const isDirty = useMemo(() => {
    if (!currentGroup) return false;
    return (
      draft.name !== currentGroup.name ||
      draft.left !== currentGroup.left ||
      draft.right !== currentGroup.right ||
      draft.includeHidden !== currentGroup.includeHidden ||
      splitIgnore(draft.ignoreText).join("\n") !== currentGroup.ignore.join("\n")
    );
  }, [draft, currentGroup]);

  function splitIgnore(text: string): string[] {
    return text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  }

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  async function loadGroup(g: DiffGroup) {
    setActiveId(g.id);
    setDraft({
      name: g.name,
      left: g.left,
      right: g.right,
      ignoreText: g.ignore.join("\n"),
      includeHidden: g.includeHidden,
      includeEqual: draft.includeEqual,
    });
    runCompare({
      left: g.left,
      right: g.right,
      ignore: g.ignore,
      includeHidden: g.includeHidden,
      includeEqual: true,
    });
  }

  function newGroup() {
    setActiveId(null);
    setDraft(emptyDraft());
    setCompare({ phase: "idle" });
  }

  async function saveGroup() {
    const name = draft.name.trim() || `${basename(draft.left) || "A"} ↔ ${basename(draft.right) || "B"}`;
    try {
      const { group } = await postJson<{ group: DiffGroup }>("/api/dirdiff/groups", {
        id: activeId ?? undefined,
        name,
        left: draft.left.trim(),
        right: draft.right.trim(),
        ignore: splitIgnore(draft.ignoreText),
        includeHidden: draft.includeHidden,
      });
      setGroups(await fetchGroups());
      setActiveId(group.id);
      setDraft((d) => ({ ...d, name: group.name }));
      setToast({ tone: "ok", msg: "方案已保存" });
    } catch (err) {
      setToast({ tone: "error", msg: (err as Error).message });
    }
  }

  async function deleteGroup(g: DiffGroup) {
    if (!confirm(`确定删除方案「${g.name}」?`)) return;
    await postJson<{ ok: boolean }>("/api/dirdiff/groups", { id: g.id });
    setGroups(await fetchGroups());
    if (activeId === g.id) newGroup();
  }

  async function browse(side: "A" | "B") {
    setBrowsing(side);
    try {
      const res = await postJson<{ path: string | null; error?: string }>("/api/dirdiff/browse", {});
      if (res.error) setToast({ tone: "error", msg: res.error });
      else if (res.path) patch(side === "A" ? { left: res.path } : { right: res.path });
    } catch {
      setToast({ tone: "error", msg: "打开文件夹选择器失败" });
    } finally {
      setBrowsing(null);
    }
  }

  async function runCompare(req?: {
    left: string;
    right: string;
    ignore: string[];
    includeHidden: boolean;
    includeEqual?: boolean;
  }) {
    const payload = req ?? {
      left: draft.left.trim(),
      right: draft.right.trim(),
      ignore: splitIgnore(draft.ignoreText),
      includeHidden: draft.includeHidden,
      includeEqual: true,
    };
    setFilter("diff");
    setCompare({ phase: "running", progress: null });
    try {
      const result = await streamCompare(payload, (progress) =>
        setCompare({ phase: "running", progress }),
      );
      setCompare({ phase: "done", result });
    } catch (err) {
      setCompare({ phase: "error", message: (err as Error).message });
    }
  }

  const result = compare.phase === "done" ? compare.result : null;
  const running = compare.phase === "running";
  const progress = compare.phase === "running" ? compare.progress : null;

  const visible = useMemo(() => {
    if (!result) return [];
    const q = query.trim().toLowerCase();
    let list = result.entries;
    if (!draft.includeEqual) list = list.filter((e) => e.status !== "equal");
    list = list.filter((e) => {
      if (filter === "all") return true;
      if (filter === "diff") return e.status !== "equal";
      return e.status === filter;
    });
    return q ? list.filter((e) => e.rel.toLowerCase().includes(q)) : list;
  }, [result, filter, query, draft.includeEqual]);

  async function handleSyncApplied() {
    runCompare();
  }

  const statuses = result?.stats;
  const filterCounts: Record<FilterKey, number> = {
    diff: (statuses ? statuses["left-only"] + statuses["right-only"] + statuses.modified + statuses.conflict : 0),
    left: statuses?.["left-only"] ?? 0,
    right: statuses?.["right-only"] ?? 0,
    modified: statuses?.modified ?? 0,
    conflict: statuses?.conflict ?? 0,
    all: result?.entries.length ?? 0,
  };

  return (
    <div className="flex h-dvh min-h-0 bg-canvas">
      <GroupRail
        groups={groups}
        activeId={activeId}
        isDirty={isDirty}
        onSelect={loadGroup}
        onDelete={deleteGroup}
        onNew={newGroup}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        {/* header */}
        <header className="flex items-center gap-3 border-b border-line bg-surface px-5 py-3">
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold tracking-tight text-ink">目录对比同步</h1>
            <p className="truncate text-[12px] text-faint">逐文件哈希对比,不依赖 git;文本差异弹出查看。</p>
          </div>
          <div className="ml-auto flex shrink-0 gap-2">
            <Button variant="subtle" onClick={saveGroup} disabled={!draft.left.trim() || !draft.right.trim()}>
              {currentGroup ? "更新方案" : "保存方案"}
            </Button>
            <Button onClick={() => runCompare()} loading={running}>
              {running ? "对比中" : "开始对比"}
            </Button>
          </div>
        </header>

        {/* config */}
        <section className="space-y-3 border-b border-line bg-surface px-5 py-4">
          <div className="flex flex-wrap items-end gap-2">
            <PathField
              badge="A"
              label="源目录"
              value={draft.left}
              busy={browsing === "A"}
              onChange={(v) => patch({ left: v })}
              onBrowse={() => browse("A")}
              className="min-w-[min(380px,100%)] flex-1"
            />
            <button
              onClick={() => draft.left.trim() && draft.right.trim() && patch({ left: draft.right, right: draft.left })}
              className="mb-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line text-muted transition-colors hover:bg-surface-mute hover:text-ink"
              title="交换 A / B"
            >
              <ArrowsLeftRight size={15} />
            </button>
            <PathField
              badge="B"
              label="目标目录"
              value={draft.right}
              busy={browsing === "B"}
              onChange={(v) => patch({ right: v })}
              onBrowse={() => browse("B")}
              className="min-w-[min(380px,100%)] flex-1"
            />
          </div>

          <div className="flex flex-wrap items-start gap-5">
            <label className="block w-full max-w-md">
              <span className="mb-1 block text-xs font-medium text-muted">忽略规则</span>
              <textarea
                rows={3}
                value={draft.ignoreText}
                onChange={(e) => patch({ ignoreText: e.target.value })}
                spellCheck={false}
                className="w-full resize-y rounded-md border border-line bg-surface px-2.5 py-2 font-mono text-[12px] leading-5 text-ink outline-none placeholder:text-faint focus:border-line-strong focus:ring-2 focus:ring-ink/10"
                placeholder={"每行一个 gitignore 风格模式,如 node_modules\n支持 ! 取反(重新包含)"}
              />
            </label>
            <div className="flex min-w-[220px] flex-col gap-3 pt-5">
              <Toggle
                label="忽略隐藏文件 / 目录"
                hint="以 . 开头的名称(如 .git)默认排除"
                checked={draft.includeHidden}
                onChange={(v) => patch({ includeHidden: v })}
              />
              <Toggle
                label="同时显示相同的文件"
                hint="在结果中保留内容一致的条目"
                checked={draft.includeEqual}
                onChange={(v) => patch({ includeEqual: v })}
              />
            </div>
          </div>

          {/* progress */}
          {running && (
            <div className="space-y-1">
              <ProgressBar
                value={progress?.phase === "hash" && progress.total > 0 ? (progress.done / progress.total) * 100 : null}
              />
              <p className="font-mono text-[11px] text-faint">
                {progress?.phase === "hash"
                  ? `正在校验内容 ${formatCount(progress.done)} / ${formatCount(progress.total)}`
                  : progress?.label
                    ? `正在遍历 ${basename(progress.label) || progress.label} …`
                    : "正在准备对比…"}
              </p>
            </div>
          )}
          {compare.phase === "error" && <Notice tone="error">{compare.message}</Notice>}
        </section>

        {/* results */}
        <section className="flex min-h-0 flex-1 flex-col">
          {!result ? (
            <div className="flex flex-1 items-center justify-center p-8">
              <div className="max-w-md text-center">
                <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-surface text-muted">
                  <FolderOpen size={22} />
                </div>
                <h2 className="text-[15px] font-semibold text-ink">开始第一次对比</h2>
                <p className="mt-2 text-left text-[12.5px] leading-relaxed text-faint">
                  1. 填入(或用「浏览」选择)两个要对比的目录;<br />
                  2. 如需忽略某些文件,在「忽略规则」里按 gitignore 语法填写;<br />
                  3. 点右上角「开始对比」,有差异的文本文件会直接弹出侧边对比。
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-5 py-2.5">
                {(["diff", "left", "right", "modified", "conflict", "all"] as FilterKey[]).map((k) => (
                  <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>
                    {FILTER_LABEL[k]} <span className="opacity-60">{filterCounts[k]}</span>
                  </Chip>
                ))}
                <div className="relative ml-auto min-w-[180px]">
                  <MagnifyingGlass size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-faint" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="按路径筛选"
                    className="h-8 w-full rounded-md border border-line bg-surface pl-8 pr-2.5 font-mono text-[12px] text-ink outline-none focus:border-line-strong focus:ring-2 focus:ring-ink/10"
                  />
                </div>
                <Button
                  variant={statuses && statuses["left-only"] + statuses["right-only"] + statuses.modified + statuses.conflict > 0 ? "primary" : "subtle"}
                  disabled={!statuses || statuses["left-only"] + statuses["right-only"] + statuses.modified + statuses.conflict === 0}
                  onClick={() => setSyncOpen(true)}
                >
                  同步
                </Button>
              </div>

              <div className="flex items-center justify-between border-b border-line bg-canvas/40 px-5 py-1.5 font-mono text-[11px] text-faint">
                <span className="truncate">
                  {basename(draft.left) || draft.left} vs {basename(draft.right) || draft.right} · 已校验{" "}
                  {formatCount(result.totalScanned)} 项 · 哈希比对 {formatCount(result.hashed)} 个 · 用时 {formatDuration(result.durationMs)}
                  {result.warnings.length > 0 && <span className="text-acc-yellow-fg"> · {result.warnings.length} 项警告</span>}
                </span>
                <span className="hidden shrink-0 sm:inline">点击条目可查看文本差异</span>
              </div>

              <ResultTable
                entries={visible}
                onOpen={setDetail}
                showEqual={draft.includeEqual}
                totalVisible={visible.length}
              />
            </>
          )}
        </section>
      </main>

      <EntryDetail
        left={draft.left.trim()}
        right={draft.right.trim()}
        entry={detail}
        open={!!detail}
        onClose={() => setDetail(null)}
      />

      <SyncPanel
        open={syncOpen}
        onClose={() => setSyncOpen(false)}
        left={draft.left.trim()}
        right={draft.right.trim()}
        entries={result?.entries ?? []}
        onApplied={handleSyncApplied}
      />

      {toast && (
        <div
          className={cn(
            "fixed right-4 bottom-4 z-[60] rounded-lg border px-3 py-2 text-[12.5px] shadow-[0_12px_40px_-12px_rgba(0,0,0,0.3)]",
            toast.tone === "ok" ? "border-acc-green-fg/30 bg-acc-green-bg text-acc-green-fg" : "border-acc-red-fg/30 bg-acc-red-bg text-acc-red-fg",
          )}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

const FILTER_LABEL: Record<FilterKey, string> = {
  diff: "差异",
  left: "仅 A",
  right: "仅 B",
  modified: "已修改",
  conflict: "冲突",
  all: "全部",
};

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[12px] transition-colors",
        active ? "bg-ink text-white" : "bg-surface-mute text-muted hover:bg-line hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function PathField({
  badge,
  label,
  value,
  busy,
  onChange,
  onBrowse,
  className,
  hint,
}: {
  badge: "A" | "B";
  label: string;
  value: string;
  busy: boolean;
  onChange: (v: string) => void;
  onBrowse: () => void;
  className?: string;
  hint?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-1 flex items-center gap-1.5">
        <span className="inline-flex h-4.5 min-w-5 items-center justify-center rounded bg-ink px-1 font-mono text-[10px] font-bold text-white">{badge}</span>
        <span className="text-xs font-medium text-muted">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          placeholder={hint ?? "请选择或输入目录路径"}
          className="h-9 w-full rounded-md border border-line bg-surface px-2.5 font-mono text-[12px] text-ink outline-none placeholder:text-faint focus:border-line-strong focus:ring-2 focus:ring-ink/10"
        />
        <IconButton label={`浏览${label}`} onClick={onBrowse} disabled={busy}>
          {busy ? <Spinner className="h-4 w-4" /> : <FolderOpen size={15} />}
        </IconButton>
      </div>
    </div>
  );
}

function ResultTable({
  entries,
  onOpen,
  showEqual,
  totalVisible,
}: {
  entries: CompareEntry[];
  onOpen: (e: CompareEntry) => void;
  showEqual: boolean;
  totalVisible: number;
}) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-[13px] text-faint">{showEqual ? "没有条目" : "没有差异,两个目录内容一致!"}</p>
      </div>
    );
  }
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="min-w-full">
        <div className="sticky top-0 z-10 grid grid-cols-[76px_minmax(0,1fr)_150px_150px] gap-2 border-b border-line bg-canvas px-5 py-2 font-mono text-[10.5px] tracking-wider text-faint uppercase">
          <span>状态</span>
          <span>路径</span>
          <span className="text-right">大小 (A · B)</span>
          <span className="text-right">修改时间 (A)</span>
        </div>
        {entries.map((e) => (
          <button
            key={e.rel}
            onClick={() => e.type === "file" && e.status !== "equal" && onOpen(e)}
            className={cn(
              "dirdiff-row grid w-full grid-cols-[76px_minmax(0,1fr)_150px_150px] items-center gap-2 border-b border-line/60 bg-surface px-5 py-1.5 text-left transition-colors hover:bg-surface-mute/70",
              e.status === "equal" && "hover:bg-transparent cursor-default",
              e.type === "dir" && "cursor-default hover:bg-transparent",
              e.status === "modified" && "bg-acc-red-bg/15",
              e.status === "conflict" && "bg-acc-orange-bg/20",
            )}
          >
            <StatusBadge status={e.status} muted={e.status === "equal"} />
            <span className="flex min-w-0 items-center gap-1.5">
              {e.type === "dir" && <CaretDown size={12} className="shrink-0 rotate-180 text-faint" />}
              <span className="truncate font-mono text-[12px] text-ink">{toPosix(e.rel)}</span>
              {e.error && <span className="shrink-0 font-mono text-[10px] text-acc-red-fg">读取失败</span>}
            </span>
            <span className="truncate text-right font-mono text-[11.5px] text-muted">
              {e.type === "dir" ? "—" : `${e.left ? formatBytes(e.left.size) : "—"} · ${e.right ? formatBytes(e.right.size) : "—"}`}
            </span>
            <span className="truncate text-right font-mono text-[11.5px] text-faint">
              {e.left ? formatDateTime(e.left.mtimeMs) : "—"}
            </span>
          </button>
        ))}
        <div className="px-5 py-2 font-mono text-[10.5px] text-faint">共 {formatCount(totalVisible)} 条</div>
      </div>
    </div>
  );
}

function formatDateTime(ms: number): string {
  if (!ms) return "—";
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}