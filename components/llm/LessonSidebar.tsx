/**
 * 课程大纲与导航条。8 节课按"从文本到模型"的认知顺序排列。
 */
"use client";

import { BookmarkSimple, Books, MapTrifold } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/components/ui";

export const LESSONS = [
  { id: 0, title: "架构总览", sub: "交互式解剖图 · 逐个击破" },
  { id: -1, title: "术语表", sub: "专业术语的人话版" },
  { id: 1, title: "文本如何变成数字", sub: "分词器 Tokenizer" },
  { id: 2, title: "把词变成向量", sub: "嵌入 Embedding" },
  { id: 3, title: "让模型分清先后", sub: "旋转位置编码 RoPE" },
  { id: 4, title: "注意力从零开始", sub: "缩放点积注意力" },
  { id: 5, title: "多双眼睛看世界", sub: "多头注意力" },
  { id: 6, title: "Transformer 块", sub: "残差 · 归一化 · SwiGLU" },
  { id: 7, title: "训练:梯度下降", sub: "反向传播 · AdamW" },
  { id: 8, title: "生成:自回归采样", sub: "温度 · 下一步" },
] as const;

export function LessonSidebar({
  active,
  onSet,
}: {
  active: number;
  onSet: (id: number) => void;
}) {
  return (
    <aside className="flex w-[236px] shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Books size={16} weight="fill" className="text-acc-blue-fg" />
        <div>
          <div className="text-[12px] font-semibold text-ink">LLM 入门路线</div>
          <div className="text-[10px] text-faint">总览 + 8 课时,由零到一</div>
        </div>
      </div>
      <nav className="flex-1 overflow-auto p-2">
        {LESSONS.map((l) => {
          const activeSel = l.id === active;
          return (
            <button
              key={l.id}
              onClick={() => onSet(l.id)}
              className={cn(
                "mb-1 flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                activeSel ? "bg-ink text-white" : "text-ink-soft hover:bg-surface-mute",
              )}
            >
              <span
                className={cn(
                  "mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px]",
                  activeSel ? "bg-white/15 text-white" : "bg-surface-mute text-muted",
                )}
              >
                {l.id === -1 ? (
                  <BookmarkSimple size={12} weight="fill" className={activeSel ? "text-white" : "text-muted"} />
                ) : l.id === 0 ? (
                  <MapTrifold size={12} weight="fill" className={activeSel ? "text-white" : "text-muted"} />
                ) : (
                  l.id
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-medium">{l.title}</span>
                <span className={cn("block truncate text-[10.5px]", activeSel ? "text-white/60" : "text-faint")}>
                  {l.sub}
                </span>
              </span>
            </button>
          );
        })}
      </nav>
      <div className="border-t border-line p-3 text-[10.5px] leading-relaxed text-faint">
        所有数字都跑在你的浏览器里。改一行代码、点一下按钮,就能看到变化。
      </div>
    </aside>
  );
}