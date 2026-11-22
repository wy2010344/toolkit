"use client";

import { useEffect } from "react";
import { X } from "@phosphor-icons/react/dist/ssr";

interface Group {
  title: string;
  rows: [string, string][];
}

const GROUPS: Group[] = [
  {
    title: "画布",
    rows: [
      ["拖拽 / 单指", "平移画布"],
      ["滚轮 / 双指", "以指针为中心缩放"],
      ["双击空白", "适配全部节点"],
      ["点节点", "右侧查看回答与追问链"],
    ],
  },
  {
    title: "节点 · 右键菜单",
    rows: [
      ["追问", "在当前节点下长出子节点"],
      ["修改这一问", "自动填入原问题供改写，产出新版本"],
      ["展开版本", "旧版与当前提问平级展开，箭头串到当前版"],
      ["隐藏 / 折叠 / 删除", "隐藏作用于整棵子树"],
    ],
  },
  {
    title: "快捷键",
    rows: [
      ["↑ / ↓", "父节点 / 第一个子节点"],
      ["← / →", "上一个 / 下一个兄弟"],
      ["+ / - / 0", "放大 / 缩小 / 适配"],
      ["F", "聚焦当前追问链"],
      ["H", "过滤隐藏分支"],
      ["V", "展开 / 收起当前节点的版本"],
      ["Esc", "关闭菜单 / 清除搜索"],
    ],
  },
  {
    title: "图例",
    rows: [
      ["实线高亮", "从开场到当前节点的追问链"],
      ["灰色子树", "隐藏影响整棵分支，可再过滤"],
      ["虚线暖色节点", "平级的历史版本，卡片上写的是那一版的问题"],
      ["箭头", "从旧版指向下一版，直到当前版本"],
    ],
  },
];

export function HelpNav({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div
        role="dialog"
        aria-label="功能导航"
        onClick={(e) => e.stopPropagation()}
        className="ct-dialog max-h-[86vh] w-full max-w-[620px] overflow-y-auto rounded-2xl p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">功能导航</h2>
            <p className="mt-0.5 text-[11px] text-faint">对话树怎么玩 · 按需查看，不再贴在界面上</p>
          </div>
          <button
            type="button"
            aria-label="关闭功能导航"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface-mute hover:text-ink"
          >
            <X size={15} weight="bold" />
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {GROUPS.map((g) => (
            <section key={g.title} className="ct-tile rounded-xl p-3">
              <h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-faint">{g.title}</h3>
              <dl className="space-y-1.5">
                {g.rows.map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-2">
                    <dt className="shrink-0 font-mono text-[10.5px] text-ink">{k}</dt>
                    <dd className="text-right text-[10.5px] leading-snug text-muted">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
