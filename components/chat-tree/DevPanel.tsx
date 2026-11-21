"use client";

import { useEffect, useState } from "react";
import { ArrowClockwise, Bug, Trash, X } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/components/ui";

export function DevPanel({
  onClose,
  onReset,
  onClear,
  storageKey,
}: {
  onClose: () => void;
  onReset: () => void;
  onClear: () => void;
  storageKey: string;
}) {
  const [confirm, setConfirm] = useState<"reset" | "clear" | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const run = (kind: "reset" | "clear") => {
    if (confirm !== kind) {
      setConfirm(kind);
      return;
    }
    setConfirm(null);
    if (kind === "reset") onReset();
    else onClear();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-ink/30 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div
        role="dialog"
        aria-label="开发面板"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[400px] rounded-2xl border border-line bg-surface p-5 shadow-[0_24px_70px_-20px_rgba(0,0,0,0.55)]"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-mute text-muted">
              <Bug size={15} />
            </span>
            <div>
              <h2 className="text-[14px] font-semibold text-ink">开发面板</h2>
              <p className="font-mono text-[9.5px] text-faint">演示数据维护 · 不影响正常使用</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="关闭开发面板"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface-mute hover:text-ink"
          >
            <X size={15} weight="bold" />
          </button>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => run("reset")}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-[11.5px] transition-colors",
              confirm === "reset" ? "border-acc-red-fg bg-acc-red-bg text-acc-red-fg" : "border-line bg-canvas text-ink hover:border-line-strong",
            )}
          >
            <ArrowClockwise size={14} />
            <span className="flex-1">{confirm === "reset" ? "再点一次确认恢复示例数据" : "恢复示例数据"}</span>
          </button>
          <button
            type="button"
            onClick={() => run("clear")}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-[11.5px] transition-colors",
              confirm === "clear" ? "border-acc-red-fg bg-acc-red-bg text-acc-red-fg" : "border-line bg-canvas text-ink hover:border-line-strong",
            )}
          >
            <Trash size={14} />
            <span className="flex-1">{confirm === "clear" ? "再点一次确认清空并刷新" : "清空本地存档并刷新"}</span>
          </button>
        </div>

        <p className="mt-4 border-t border-line pt-3 font-mono text-[9.5px] leading-relaxed text-faint">
          localStorage · {storageKey}
          <br />
          回答由服务端 /api/chat 转发模型生成；存档只保存在本机浏览器。
        </p>
      </div>
    </div>
  );
}
