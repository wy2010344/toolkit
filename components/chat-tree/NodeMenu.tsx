"use client";

import {
  ArrowRight,
  CaretRight,
  Copy,
  Eye,
  EyeSlash,
  LinkBreak,
  ListBullets,
  PaperPlaneTilt,
  PencilSimple,
  Trash,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/components/ui";
import { ContextMenu, type ContextItem, type MenuTarget } from "./ContextMenu";
import type { ChatNode } from "@/lib/chat-tree/types";

export type { MenuTarget } from "./ContextMenu";

export function NodeMenu({
  target,
  node,
  onClose,
  onFollowUp,
  onRevise,
  onToggleVersions,
  versionsExpanded,
  onFollow,
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
  onFollow: (id: string, follow: boolean) => void;
  onHide: (id: string) => void;
  onCollapse: (id: string) => void;
  onCopy: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (!node) return null;
  const id = target.id;
  const versionCount = node.revisions?.length ?? 0;
  const origin = (node.parentRevision ?? 0) + 1;

  const items: ContextItem[] = [
    {
      key: "followUp",
      label: "追问",
      icon: <PaperPlaneTilt size={14} />,
      title: "在这一问下追加子节点",
      onClick: () => onFollowUp(id),
    },
    {
      key: "revise",
      label: "修改这一问",
      icon: <PencilSimple size={14} />,
      title: "填入原问题供改写，发送后产出新版本",
      onClick: () => onRevise(id),
    },
    {
      key: "versions",
      label: versionsExpanded ? "收起版本链" : versionCount > 1 ? "展开版本链" : "展开版本",
      icon: <ListBullets size={14} />,
      title: "旧版与当前提问平级，箭头指向当前版",
      badge: versionCount > 1 ? `${versionCount} 版` : undefined,
      onClick: () => onToggleVersions(id),
      divider: true,
    },
  ];

  // 版本归属是显式的：历史版本下的子树默认留在原版，只有批准才归档到当前版。
  if (node.parentId && node.versionState === "archived") {
    items.push({
      key: "follow",
      label: "跟随到当前版",
      icon: <ArrowRight size={14} />,
      title: "批准整棵子树移到当前版本下；当前版再换版时需要重新批准",
      onClick: () => onFollow(id, true),
      divider: true,
    });
  } else if (node.versionState === "following") {
    items.push({
      key: "unfollow",
      label: `放弃跟随 · 回到 v${origin}`,
      icon: <LinkBreak size={14} />,
      title: "撤销批准，子树回到最初追问时的那一版",
      onClick: () => onFollow(id, false),
      divider: true,
    });
  }

  items.push(
    {
      key: "hide",
      label: node.hidden ? "取消隐藏" : "标记隐藏",
      icon: node.hidden ? <Eye size={14} /> : <EyeSlash size={14} />,
      title: "作用于整棵子树：先灰显，需要时再进一步过滤",
      onClick: () => onHide(id),
      divider: items.length > 0,
    },
    {
      key: "collapse",
      label: node.collapsed ? "展开子树" : "折叠子树",
      icon: <CaretRight size={14} className={cn(node.collapsed && "rotate-90")} />,
      onClick: () => onCollapse(id),
    },
    {
      key: "copy",
      label: "复制回答",
      icon: <Copy size={14} />,
      onClick: () => onCopy(id),
      divider: true,
    },
    {
      key: "remove",
      label: "删除分支",
      icon: <Trash size={14} />,
      onClick: () => onRemove(id),
      danger: true,
      disabled: !node.parentId,
    },
  );

  return <ContextMenu target={target} items={items} onClose={onClose} header={node.prompt} />;
}
