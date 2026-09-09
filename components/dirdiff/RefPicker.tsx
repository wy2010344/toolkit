"use client";

import { useEffect, useRef, useState } from "react";
import { Command } from "cmdk";
import {
  CaretDown,
  Check,
  GitBranch,
  MagnifyingGlass,
  Tag,
} from "@phosphor-icons/react/dist/ssr";
import { cn, Spinner } from "@/components/ui";
import type { GitRef } from "@/lib/dirdiff/types";

function fmtDate(unix: number | undefined): string {
  if (!unix) return "";
  const d = new Date(unix * 1000);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60_000);
  if (diff < 60_000) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function RefPicker({
  refs,
  current,
  root,
  busy,
  onPick,
}: {
  refs: GitRef[];
  current: string | null;
  root?: string;
  busy: boolean;
  onPick: (ref: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        setOpen(false);
        e.stopPropagation();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const branches = refs.filter((r) => r.type === "branch");
  const tags = refs.filter((r) => r.type === "tag");

  return (
    <div ref={wrapRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => !busy && setOpen((o) => !o)}
        className={cn(
          "flex h-6 w-full min-w-0 items-center gap-1.5 rounded border border-line bg-surface px-1.5 transition-colors",
          open && "border-line-strong ring-2 ring-ink/10",
          !busy && "hover:bg-surface-mute",
        )}
        title={`${root ?? ""} · 切换分支 / 标签(git checkout)`}
      >
        {busy ? (
          <Spinner className="h-3 w-3 shrink-0 text-muted" />
        ) : (
          <GitBranch size={11} className="shrink-0 text-faint" />
        )}
        <span className={cn("min-w-0 flex-1 truncate text-left font-mono text-[11px]", current ? "text-muted" : "text-faint")}>
          {current ?? "已分离 HEAD"}
        </span>
        <span className="shrink-0 font-mono text-[9px] text-faint">
          {refs.length}
        </span>
        <CaretDown size={10} className="shrink-0 text-faint" />
      </button>

      {open && (
        <div className="absolute top-full right-0 left-0 z-50 mt-1.5 overflow-hidden rounded-md border border-line bg-surface shadow-xl shadow-ink/10">
          <Command className="flex flex-col" shouldFilter>
            <div className="flex items-center gap-1.5 border-b border-line px-2">
              <MagnifyingGlass size={12} className="shrink-0 text-faint" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="输入以筛选…"
                className="h-7 w-full min-w-0 bg-transparent font-mono text-[11px] text-ink outline-none placeholder:text-faint"
              />
            </div>
            <Command.List className="max-h-64 overflow-y-auto p-1">
              <Command.Empty className="px-2 py-4 text-center font-mono text-[11px] text-faint">
                没有匹配的分支 / 标签
              </Command.Empty>

              {branches.length > 0 && (
                <Command.Group
                  heading="分支"
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[9.5px] [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-faint [&_[cmdk-group-heading]]:uppercase"
                >
                  {branches.map((r) => (
                    <RefItem key={r.name} item={r} current={current} onPick={onPick} onClose={() => setOpen(false)} />
                  ))}
                </Command.Group>
              )}

              {tags.length > 0 && (
                <Command.Group
                  heading="标签"
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[9.5px] [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-faint [&_[cmdk-group-heading]]:uppercase"
                >
                  {tags.map((r) => (
                    <RefItem key={r.name} item={r} current={current} onPick={onPick} onClose={() => setOpen(false)} />
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </div>
      )}
    </div>
  );
}

function RefItem({
  item,
  current,
  onPick,
  onClose,
}: {
  item: GitRef;
  current: string | null;
  onPick: (ref: string) => void;
  onClose: () => void;
}) {
  const isCurrent = item.name === current;
  return (
    <Command.Item
      value={item.name}
      onSelect={() => {
        if (!isCurrent) onPick(item.name);
        onClose();
      }}
      className={cn(
        "flex min-w-0 cursor-pointer items-center gap-1.5 rounded-sm px-2 py-1 text-left transition-colors aria-selected:bg-ink/10",
        isCurrent && "bg-ink/5",
      )}
    >
      <span className={cn("shrink-0", item.type === "branch" ? "text-acc-blue-fg/70" : "text-acc-yellow-fg/70")}>
        {item.type === "branch" ? <GitBranch size={11} /> : <Tag size={11} />}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-ink">{item.name}</span>
      {isCurrent && <Check size={12} className="shrink-0 text-acc-green-fg" weight="bold" />}
      <span className="shrink-0 font-mono text-[9.5px] text-faint">
        {item.oid ? `#${item.oid}` : ""}
        {item.date ? ` · ${fmtDate(item.date)}` : ""}
      </span>
    </Command.Item>
  );
}