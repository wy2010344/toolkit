"use client";

import { useEffect, useRef } from "react";
import {
  CaretRight,
  Copy,
  Eye,
  EyeSlash,
  ListBullets,
  PaperPlaneTilt,
  PencilSimple,
  Trash,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/components/ui";
import type { ChatNode } from "@/lib/chat-tree/types";

/** 右键菜单的定位信息：屏幕坐标 + 目标节点 + 打开时的画布可视区（用于夹住菜单）。 */
export interface MenuTarget {
  id: string;
  x: number;
  y: number;
  bounds: { left: number; top: number; right: number; bottom: number };
}

interface Item {
  key: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
}

export function NodeMenu({
  target,
  node,
  onClose,
  onFollowUp,
  onRevise,
  onToggleVersions,
  versionsExpanded,
  onHide,
  onCollapse,
  onCopy,
  onRemove,
}: {
  target: MenuTarget;
  node: ChatNode | null;
  onClose: () => void;
  onFollowUp: (id: string) => void;
  onRevise: (id: string) => void;
  onToggleVersions: (id: string) => void;
  versionsExpanded: boolean;
  onHide: (id: string) => void;
  onCollapse: (id: string) => void;
  onCopy: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = target.id;

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // capture 阶段监听，先于节点的点击逻辑关掉菜单。
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!node) return null;

  const versionCount = node.revisions?.length ?? 0;

  const items: Item[] = [
    { key: "followUp", label: "追问", hint: "在此节点下追加", icon: <PaperPlaneTilt size={14} />, onClick: () => onFollowUp(id) },
    { key: "revise", label: "修改这一问", hint: "填入原问题供改写", icon: <PencilSimple size={14} />, onClick: () => onRevise(id) },
    {
      key: "versions",
      label: versionsExpanded ? "收起版本伪分支" : versionCount > 1 ? `展开版本 · ${versionCount} 版` : "展开版本",
      hint: versionCount > 1 ? "平级版本链 · 可逐版查看" : "当前仅 1 版",
      icon: <ListBullets size={14} />,
      onClick: () => onToggleVersions(id),
      divider: true,
    },
    {
      key: "hide",
      label: node.hidden ? "取消隐藏" : "标记隐藏",
      hint: node.hidden ? undefined : "整棵子树变灰",
      icon: node.hidden ? <Eye size={14} /> : <EyeSlash size={14} />,
      onClick: () => onHide(id),
    },
    {
      key: "collapse",
      label: node.collapsed ? "展开子树" : "折叠子树",
      icon: <CaretRight size={14} className={cn(node.collapsed && "rotate-90")} />,
      onClick: () => onCollapse(id),
      divider: true,
    },
    { key: "copy", label: "复制回答", icon: <Copy size={14} />, onClick: () => onCopy(id) },
    {
      key: "remove",
      label: "删除分支",
      icon: <Trash size={14} />,
      onClick: () => onRemove(id),
      danger: true,
      disabled: !node.parentId,
    },
  ];

  // 先把菜单按内置尺寸夹进画布可视区。
  const MENU_W = 208;
  const MENU_H = items.length * 34 + 44;
  const bounds = target.bounds;
  let left = target.x;
  let top = target.y;
  left = Math.min(left, bounds.right - MENU_W - 8);
  top = Math.min(top, bounds.bottom - MENU_H - 8);
  left = Math.max(left, bounds.left + 8);
  top = Math.max(top, bounds.top + 8);

  return (
    <div
      ref={ref}
      className="fixed z-50 w-52 overflow-hidden rounded-xl border border-line bg-surface py-1.5 shadow-[0_18px_48px_-16px_rgba(0,0,0,0.5)]"
      style={{ left, top }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="truncate border-b border-line px-3 pb-1.5 pt-0.5 text-[10px] text-faint" title={node.prompt}>
        {node.prompt}
      </div>
      {items.map((it) => (
        <div key={it.key}>
          {it.divider && <div className="my-1 h-px bg-line" />}
          <button
            type="button"
            disabled={it.disabled}
            onClick={() => {
              it.onClick();
              onClose();
            }}
            className={cn(
              "flex w-full items-center gap-2.5 px-3 py-[7px] text-left text-[12px] transition-colors disabled:opacity-35",
              it.danger ? "text-acc-red-fg hover:bg-acc-red-bg" : "text-ink hover:bg-surface-mute",
            )}
          >
            <span className={cn("shrink-0", it.danger ? "text-acc-red-fg" : "text-muted")}>{it.icon}</span>
            <span className="min-w-0 flex-1 truncate">{it.label}</span>
            {it.hint && <span className="shrink-0 text-[9.5px] text-faint">{it.hint}</span>}
          </button>
        </div>
      ))}
    </div>
  );
}
