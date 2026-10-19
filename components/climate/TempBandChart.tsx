/**
 * 单座城市 12 个月气温带图。
 * x 轴固定为 1–12 月;y 轴温度范围由外部传入并保持恒定,换城市时可直接对照。
 * 每个月画一条从最低温到最高温的色带(按该月均温着色),再用折线连出月均温。
 */
"use client";

import { useState, type MouseEvent } from "react";
import type { MonthlyTemp } from "@/lib/climate/types";

const MONTHS = Array.from({ length: 12 }, (_, i) => `${i + 1}月`);

const W = 760;
const H = 360;
const PAD = { l: 48, r: 20, t: 24, b: 42 };
const INNER_W = W - PAD.l - PAD.r;
const INNER_H = H - PAD.t - PAD.b;
const SLOT = INNER_W / 12;

/* 温度色阶:冷蓝 → 暖黄 → 橙 → 红,取值全部来自设计 token。 */
const STOPS: Array<{ t: number; bg: string; fg: string }> = [
  { t: 0, bg: "#e1f3fe", fg: "#1f6c9f" },
  { t: 14, bg: "#fbf3db", fg: "#956400" },
  { t: 24, bg: "#f3e2d6", fg: "#9a5411" },
  { t: 33, bg: "#f9e3e4", fg: "#9f2f2d" },
];

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function mix(a: string, b: string, k: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const r = Math.round(r1 + (r2 - r1) * k);
  const g = Math.round(g1 + (g2 - g1) * k);
  const bl = Math.round(b1 + (b2 - b1) * k);
  return `rgb(${r} ${g} ${bl})`;
}

/** 按温度取色:which 决定取浅色底(bg)还是深色描边(fg)。 */
function ramp(t: number, which: "bg" | "fg"): string {
  const first = STOPS[0];
  const last = STOPS[STOPS.length - 1];
  if (t <= first.t) return first[which];
  if (t >= last.t) return last[which];
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i];
    const b = STOPS[i + 1];
    if (t >= a.t && t <= b.t) return mix(a[which], b[which], (t - a.t) / (b.t - a.t));
  }
  return last[which];
}

export function TempBandChart({
  months,
  domain,
  reference = [],
}: {
  months: MonthlyTemp[];
  /** 固定的 y 轴温度范围 [最低, 最高],切换城市时保持不变。 */
  domain: [number, number];
  /** 其他城市的月均温参考折线。 */
  reference?: MonthlyTemp[][];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [lo, hi] = domain;
  const span = hi - lo || 1;

  const xOf = (i: number) => PAD.l + SLOT * (i + 0.5);
  const yOf = (t: number) => PAD.t + INNER_H * (1 - (t - lo) / span);

  const ticks: number[] = [];
  for (let t = lo; t <= hi + 1e-6; t += 5) ticks.push(t);

  const toPath = (ms: MonthlyTemp[]) =>
    ms.map((m, i) => `${xOf(i).toFixed(1)},${yOf(m.mean).toFixed(1)}`).join(" ");

  const meanPath = toPath(months);
  const hovered = hover === null ? null : months[hover];

  /** 由鼠标横坐标换算到最近的月份索引,用于悬停高亮与读数。 */
  const handleMove = (e: MouseEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    if (box.width === 0) return;
    const x = ((e.clientX - box.left) / box.width) * W;
    if (x < PAD.l || x > W - PAD.r) {
      setHover(null);
      return;
    }
    setHover(Math.min(11, Math.max(0, Math.floor((x - PAD.l) / SLOT))));
  };

  return (
    <div className="w-full">
      {/* 图例 + 悬停读数 */}
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 font-mono text-[10.5px] text-faint">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-3 rounded-[2px] border border-acc-orange-fg/40 bg-acc-orange-bg" />
            高低温差区间
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-3.5 bg-ink" />
            月均温
          </span>
          {reference.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-0.5 w-3.5 bg-line-strong" />
              其他城市
            </span>
          )}
        </div>
        <span className="font-mono text-[11px] text-muted">
          {hovered
            ? `${hovered.m}月 · 高 ${hovered.max.toFixed(1)}° 低 ${hovered.min.toFixed(1)}° 均 ${hovered.mean.toFixed(1)}°`
            : "悬停查看逐月数值"}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded-lg border border-line bg-surface"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* y 轴网格与刻度 */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.l}
              y1={yOf(t)}
              x2={W - PAD.r}
              y2={yOf(t)}
              stroke="var(--color-line)"
              strokeWidth={1}
              strokeDasharray={t === lo ? undefined : "2 4"}
            />
            <text x={PAD.l - 8} y={yOf(t) + 3.5} textAnchor="end" className="font-mono text-[10px]" fill="var(--color-faint)">
              {t}°
            </text>
          </g>
        ))}

        {/* 其他城市参考折线 */}
        {reference.map((ms, i) => (
          <polyline
            key={i}
            points={toPath(ms)}
            fill="none"
            stroke="var(--color-line-strong)"
            strokeWidth={1.1}
            opacity={0.5}
          />
        ))}

        {/* 每月高低温差色带(按均温着色) */}
        {months.map((m, i) => {
          const yTop = yOf(m.max);
          const h = Math.max(2, yOf(m.min) - yTop);
          const w = SLOT * 0.46;
          return (
            <rect
              key={m.m}
              x={xOf(i) - w / 2}
              y={yTop}
              width={w}
              height={h}
              rx={3}
              fill={ramp(m.mean, "bg")}
              stroke={hover === i ? ramp(m.mean, "fg") : "transparent"}
              strokeWidth={hover === i ? 1.5 : 0}
            />
          );
        })}

        {/* 最高 / 最低端点刻度 */}
        {months.map((m, i) => {
          const w = SLOT * 0.46;
          return (
            <g key={m.m} stroke="var(--foreground)" strokeWidth={1} opacity={0.4}>
              <line x1={xOf(i) - w / 2} y1={yOf(m.max)} x2={xOf(i) + w / 2} y2={yOf(m.max)} />
              <line x1={xOf(i) - w / 2} y1={yOf(m.min)} x2={xOf(i) + w / 2} y2={yOf(m.min)} />
            </g>
          );
        })}

        {/* 月均温折线与点 */}
        <polyline points={meanPath} fill="none" stroke="var(--foreground)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {months.map((m, i) => (
          <circle key={m.m} cx={xOf(i)} cy={yOf(m.mean)} r={hover === i ? 4 : 2.6} fill="var(--foreground)" />
        ))}

        {/* 悬停竖向参考线 */}
        {hover !== null && (
          <line
            x1={xOf(hover)}
            y1={PAD.t}
            x2={xOf(hover)}
            y2={PAD.t + INNER_H}
            stroke="var(--color-line-strong)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        {/* x 轴月份标签 */}
        {months.map((m, i) => (
          <text
            key={m.m}
            x={xOf(i)}
            y={H - PAD.b + 18}
            textAnchor="middle"
            className="font-mono text-[10.5px]"
            fill={hover === i ? "var(--foreground)" : "var(--color-faint)"}
          >
            {MONTHS[i]}
          </text>
        ))}

      </svg>

      <p className="mt-1.5 text-[10.5px] text-faint">
        y 轴温度范围 {lo}–{hi} ℃ 固定不变,切换城市时可直接对照高低;色带按该月均温着色。
      </p>
    </div>
  );
}
