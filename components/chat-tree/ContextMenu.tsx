"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/components/ui";

/** 右键菜单的定位信息：屏幕坐标 + 打开时所属面板的可视区（用于把菜单夹在屏内）。 */
export interface MenuTarget {
  id: string;
  x: number;
  y: number;
  bounds: { left: number; top: number; right: number; bottom: number };
}

export interface ContextItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  /** 说明文字走原生 tooltip，不再挤占菜单宽度。 */
  title?: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
  /** 右侧的紧凑角标，如版本数；默认不显示。 */
  badge?: string;
}

export function ContextMenu({
  target,
  items,
  onClose,
  width = 208,
  header,
}: {
  target: MenuTarget;
  items: ContextItem[];
  onClose: () => void;
  width?: number;
  header?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // capture 阶段监听，先于节点自身的点击逻辑关掉菜单。
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const height = items.length * 34 + 44 + (header ? 26 : 0);
  const bounds = target.bounds;
  const left = Math.max(bounds.left + 8, Math.min(target.x, bounds.right - width - 8));
  const top = Math.max(bounds.top + 8, Math.min(target.y, bounds.bottom - height - 8));

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-50 overflow-hidden rounded-xl border border-line bg-surface py-1.5 shadow-[0_18px_48px_-16px_rgba(0,0,0,0.5)]"
      style={{ left, top, width }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {header && (
        <div className="truncate border-b border-line px-3 pb-1.5 pt-0.5 text-[10px] text-faint" title={header}>
          {header}
        </div>
      )}
      {items.map((item) => (
        <div key={item.key}>
          {item.divider && <div className="my-1 h-px bg-line" />}
          <button
            type="button"
            role="menuitem"
            title={item.title}
            disabled={item.disabled}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className={cn(
              "flex w-full items-center gap-2.5 px-3 py-[7px] text-left text-[12px] transition-colors disabled:opacity-35",
              item.danger ? "text-acc-red-fg hover:bg-acc-red-bg" : "text-ink hover:bg-surface-mute",
            )}
          >
            <span className={cn("shrink-0", item.danger ? "text-acc-red-fg" : "text-muted")}>{item.icon}</span>
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.badge && <span className="shrink-0 font-mono text-[9.5px] text-faint">{item.badge}</span>}
          </button>
        </div>
      ))}
    </div>
  );
}
