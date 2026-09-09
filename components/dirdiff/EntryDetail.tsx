"use client";

import { useEffect, useState } from "react";
import { CornersIn, CornersOut } from "@phosphor-icons/react/dist/ssr";
import { IconButton, Modal, Notice, Spinner, StatusBadge } from "@/components/ui";
import { basename, formatBytes } from "@/lib/dirdiff/format";
import { detectLanguage } from "@/lib/dirdiff/lang";
import type { CompareEntry, FileContent, FileContentsResponse } from "@/lib/dirdiff/types";
import { DiffView } from "./DiffView";

export function EntryDetail({
  left,
  right,
  entry,
  open,
  onClose,
}: {
  left: string;
  right: string;
  entry: CompareEntry | null;
  open: boolean;
  onClose: () => void;
}) {
  const [loaded, setLoaded] = useState<{ key: string; data: FileContentsResponse | null; error: string | null }>({
    key: "",
    data: null,
    error: null,
  });
  const [fullscreen, setFullscreen] = useState(false);

  const requestKey = entry ? `${left}\n${right}\n${entry.rel}` : "";

  useEffect(() => {
    if (!open || !entry) return;
    let cancelled = false;
    fetch("/api/dirdiff/contents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ left, right, rel: entry.rel }),
    })
      .then(async (res) => {
        const json = (await res.json()) as Partial<FileContentsResponse>;
        if (!res.ok) throw new Error((json as { error?: string }).error ?? "加载失败");
        return json as FileContentsResponse;
      })
      .then((data) => {
        if (!cancelled) setLoaded({ key: requestKey, data, error: null });
      })
      .catch((err: Error) => {
        if (!cancelled) setLoaded({ key: requestKey, data: null, error: err.message ?? "加载失败" });
      });
    return () => {
      cancelled = true;
    };
  }, [open, entry, left, right, requestKey]);

  if (!entry) return null;

  const same = entry.status === "modified" || entry.status === "equal";
  const leftName = basename(left);
  const rightName = basename(right);

  const isCurrent = loaded.key === requestKey;

  const renderBody = () => {
    if (!isCurrent) {
      return (
        <div className="flex h-48 items-center justify-center gap-2 text-muted">
          <Spinner /> 正在读取文件内容…
        </div>
      );
    }

    if (loaded.error) {
      return (
        <div className="p-4">
          <Notice tone="error">{loaded.error}</Notice>
        </div>
      );
    }

    const data = loaded.data!;
    const l = data.left;
    const r = data.right;

    if (entry.status === "conflict") {
      return (
        <div className="space-y-3 p-4">
          <Notice tone="warn">
            两侧类型冲突:一侧是文件,另一侧是目录。无法预览或比较,同步时也会跳过,请手动处理。
          </Notice>
          <div className="grid grid-cols-2 gap-3">
            <MetaCard label={leftName} meta={l} side="left" />
            <MetaCard label={rightName} meta={r} side="right" />
          </div>
        </div>
      );
    }

    const sides: Array<{ side: "left" | "right"; content: typeof l }> = [
      { side: "left", content: l },
      { side: "right", content: r },
    ];

    if (same && l.kind === "text" && r.kind === "text") {
      return (
        <DiffView
          leftName={`${leftName}  ·  ${entry.rel}`}
          rightName={`${rightName}  ·  ${entry.rel}`}
          leftText={l.text}
          rightText={r.text}
          language={detectLanguage(entry.rel)}
        />
      );
    }

    // modified but not text-comparable, or one-sided entry
    const textSides = sides
      .filter((s) => s.content.kind === "text")
      .map((s) => ({ side: s.side, text: (s.content as Extract<FileContent, { kind: "text" }>).text }));
    const messages = sides
      .filter((s) => s.content.kind !== "text")
      .map((s) => {
        const who = s.side === "left" ? "A" : "B";
        const c = s.content;
        if (c.kind === "too-large") return `${who} 侧文件过大(> 2 MB),不适合内联对比`;
        if (c.kind === "binary") return `${who} 侧是二进制文件,无法预览文本`;
        if (c.kind === "missing") return `${who} 侧文件不存在`;
        return `${who} 侧读取失败${c.kind === "error" && c.message ? `: ${c.message}` : ""}`;
      })
      .filter(Boolean);

    return (
      <div className="space-y-3 p-4">
        {messages.length > 0 && (
          <Notice tone="warn">
            {messages.map((m, i) => (
              <div key={i}>{m}</div>
            ))}
          </Notice>
        )}
        {textSides.map((s) => (
          <div key={s.side}>
            <div className="mb-1.5 text-[11px] font-medium tracking-wide text-faint uppercase">
              {s.side === "left" ? "A 侧预览" : "B 侧预览"} · {basename(s.side === "left" ? left : right)}
            </div>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md border border-line bg-canvas/50 p-3 font-mono text-[12px] leading-relaxed text-ink">
              {s.text}
            </pre>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      fullscreen={fullscreen}
      action={
        <IconButton label={fullscreen ? "退出全屏" : "全屏显示"} onClick={() => setFullscreen((v) => !v)}>
          {fullscreen ? <CornersIn size={15} weight="bold" /> : <CornersOut size={15} weight="bold" />}
        </IconButton>
      }
      title={<span className="font-mono">{entry.rel}</span>}
    >
      <div className="flex items-center gap-2 border-b border-line px-4 py-2">
        <StatusBadge status={entry.status} />
        {entry.type === "file" && (
          <span className="font-mono text-[11px] text-faint">
            A {entry.left ? formatBytes(entry.left.size) : "—"} · B {entry.right ? formatBytes(entry.right.size) : "—"}
          </span>
        )}
        {entry.error && <span className="text-[11px] text-acc-red-fg">{entry.error}</span>}
      </div>
      <div className="min-h-[240px]">{renderBody()}</div>
    </Modal>
  );
}

function MetaCard({ label, meta, side }: { label: string; meta: { kind: string; size?: number; message?: string }; side: "left" | "right" }) {
  return (
    <div className={`rounded-lg border border-line p-3 ${side === "left" ? "bg-acc-red-bg/20" : "bg-acc-green-bg/20"}`}>
      <div className="mb-1 truncate font-mono text-[11px] text-muted">{label}</div>
      <div className="font-mono text-[11px] text-faint">{meta.kind === "text" ? formatBytes(meta.size ?? 0) : meta.kind}</div>
    </div>
  );
}