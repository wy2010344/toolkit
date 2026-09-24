/**
 * DFT 学习实验室的章节大纲与导航。
 */
"use client";

import {
  ChartBar,
  FadersHorizontal,
  Infinity,
  MusicNotes,
  Pulse,
  Radio,
  Waveform,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/components/ui";

export const DFT_SECTIONS = [
  { id: 0, title: "序曲:一锅声音", sub: "为什么混音难拆开" },
  { id: 1, title: "波的语言", sub: "用几行代码造一条波" },
  { id: 2, title: "同频共振", sub: "点积让同声越叠越响" },
  { id: 3, title: "异频相消", sub: "不同声自动互相抵消" },
  { id: 4, title: "拆开混音", sub: "一台可以听的收音机" },
  { id: 5, title: "相位与复数", sub: "为什么需要两根探针" },
  { id: 6, title: "完整 DFT", sub: "频谱 · 重建 · 实验" },
] as const;

const ICONS = [MusicNotes, Waveform, Radio, Pulse, FadersHorizontal, Infinity, ChartBar];

export function DftSidebar({ active, onSet }: { active: number; onSet: (id: number) => void }) {
  return (
    <aside className="flex w-[240px] shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Waveform size={16} weight="fill" className="text-acc-green-fg" />
        <div>
          <div className="text-[12px] font-semibold text-ink">DFT 听音室</div>
          <div className="text-[10px] text-faint">离散傅里叶,由“同声相应”入门</div>
        </div>
      </div>
      <nav className="flex-1 overflow-auto p-2">
        {DFT_SECTIONS.map((s, i) => {
          const Icon = ICONS[i]!;
          const activeSel = s.id === active;
          return (
            <button
              key={s.id}
              onClick={() => onSet(s.id)}
              className={cn(
                "mb-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                activeSel ? "bg-ink text-white" : "text-ink-soft hover:bg-surface-mute",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-md",
                  activeSel ? "bg-white/15 text-white" : "bg-surface-mute text-muted",
                )}
              >
                <Icon size={13} weight="fill" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-medium">{s.title}</span>
                <span className={cn("block truncate text-[10.5px]", activeSel ? "text-white/60" : "text-faint")}>
                  {s.sub}
                </span>
              </span>
            </button>
          );
        })}
      </nav>
      <div className="border-t border-line p-3 text-[10.5px] leading-relaxed text-faint">
        全程只在浏览器里跑,没有黑魔法:心里只留一个动作——<strong className="text-muted">乘起来,再求和</strong>。
      </div>
    </aside>
  );
}