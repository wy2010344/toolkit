/**
 * 注意力热力图:把 T×T 权重矩阵用单元格颜色深浅展示出来。
 * 黑底模式下的蓝→白渐变 + 鼠标悬停数字，方便直观感受"谁在看谁"。
 */
"use client";

import { useRef, useState, type PointerEvent } from "react";

export function AttentionHeatmap({
  weights,
  tokens,
  label,
}: {
  weights: number[][];
  tokens?: string[];
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ r: number; c: number; v: number } | null>(null);

  const T = weights.length;
  const maxW = Math.max(...weights.flat(), 0.01);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const cell = (e.target as HTMLElement).closest("[data-r]");
    if (!cell) { setHover(null); return; }
    const r = +(cell as HTMLElement).dataset.r!;
    const c = +(cell as HTMLElement).dataset.c!;
    setHover({ r, c, v: weights[r]![c]! });
  };

  return (
    <div className="select-none text-[12px]">
      {label && <div className="mb-2 text-[11px] font-medium text-muted">{label}</div>}
      <div
        ref={ref}
        className="inline-grid gap-px rounded bg-canvas p-1 font-mono text-[10px]"
        style={{ gridTemplateColumns: `repeat(${T}, minmax(18px, 1fr))` }}
        onPointerLeave={() => setHover(null)}
        onPointerMove={onMove}
      >
        {weights.map((row, r) =>
          row.map((v, c) => {
            const intensity = v / maxW;
            const bg = `color-mix(in srgb, var(--color-acc-blue-fg) ${Math.round(intensity * 100)}%, transparent)`;
            const fg = intensity > 0.5 ? "#fff" : "var(--color-ink)";
            return (
              <div
                key={`${r}-${c}`}
                data-r={r}
                data-c={c}
                className="flex h-5 w-5 items-center justify-center rounded-sm transition-opacity"
                style={{ background: bg, color: fg, opacity: v === 0 ? 0.15 : 1 }}
                title={`${r}→${c}: ${v.toFixed(4)}`}
              >
                {v.toFixed(2)}
              </div>
            );
          }),
        )}
      </div>
      {hover && (
        <div className="mt-1 text-[11px] text-faint">
          位置 {hover.r} 关注 位置 {hover.c}：权重 {hover.v.toFixed(4)}
        </div>
      )}
      {tokens && (
        <div className="mt-2 flex gap-1 text-[10px] text-faint">
          {tokens.map((t, i) => (
            <span key={i} className="rounded bg-surface-mute px-1">
              {i}:{t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}