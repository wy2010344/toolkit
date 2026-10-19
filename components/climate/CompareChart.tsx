/**
 * 多城气温折线对比图。
 * 每座选中的城市画一条折线(指标可在最高 / 平均 / 最低温之间切换),线尾标注城市名并配图例;
 * y 轴温度范围由外部传入且与单城带图一致,便于同屏横向对照。允许一个城市都不选。
 */
"use client";

import { useState, type MouseEvent } from "react";
import type { MonthlyTemp } from "@/lib/climate/types";

const MONTHS = Array.from({ length: 12 }, (_, i) => `${i + 1}月`);

const W = 760;
const H = 360;
const PAD = { l: 48, r: 92, t: 24, b: 42 };
const INNER_W = W - PAD.l - PAD.r;
const INNER_H = H - PAD.t - PAD.b;
const SLOT = INNER_W / 12;

/** 折线分类配色:按选中顺序取色,保证同屏城市可区分(数据可视化配色,非 UI 语义色)。 */
export const LINE_COLORS = [
  "#1f6c9f",
  "#9a5411",
  "#9f2f2d",
  "#956400",
  "#2f7d4f",
  "#6b4fa0",
  "#b0522f",
  "#2b8a8a",
  "#8a3f7a",
  "#4a5f2f",
  "#a34d6b",
  "#3a6ea5",
  "#7a6a2f",
  "#5a4a8a",
  "#2e7d6b",
];

export type Metric = "max" | "mean" | "min";

export const METRIC_LABEL: Record<Metric, string> = { max: "最高温", mean: "平均温", min: "最低温" };

export interface CompareSeries {
  id: string;
  name: string;
  months: MonthlyTemp[];
}

function pick(m: MonthlyTemp, metric: Metric): number {
  return metric === "max" ? m.max : metric === "min" ? m.min : m.mean;
}

export function CompareChart({
  series,
  domain,
  metric,
}: {
  series: CompareSeries[];
  /** 固定的 y 轴温度范围 [最低, 最高],与单城视图共用。 */
  domain: [number, number];
  metric: Metric;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [lo, hi] = domain;
  const span = hi - lo || 1;

  const xOf = (i: number) => PAD.l + SLOT * (i + 0.5);
  const yOf = (t: number) => PAD.t + INNER_H * (1 - (t - lo) / span);

  const ticks: number[] = [];
  for (let t = lo; t <= hi + 1e-6; t += 5) ticks.push(t);

  // 线尾标签:按终点高度排序后做“向下推挤 + 整体上移”去重叠,避免多城标签叠在一起。
  const labelY = new Array<number>(series.length);
  const order = series
    .map((s, i) => ({ i, y: yOf(pick(s.months[11], metric)) }))
    .sort((a, b) => a.y - b.y);
  for (let k = 1; k < order.length; k++) {
    if (order[k].y - order[k - 1].y < 12) order[k].y = order[k - 1].y + 12;
  }
  const overflow = order.length ? order[order.length - 1].y - (PAD.t + INNER_H) : 0;
  for (const o of order) labelY[o.i] = o.y - Math.max(0, overflow);

  const handleMove = (e: MouseEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    if (box.width === 0) return;
    const x = ((e.clientX - box.left) / box.width) * W;
    if (x < PAD.l || x > PAD.l + INNER_W) {
      setHover(null);
      return;
    }
    setHover(Math.min(11, Math.max(0, Math.floor((x - PAD.l) / SLOT))));
  };

  const readout =
    hover === null
      ? []
      : series
          .map((s, i) => ({ name: s.name, color: LINE_COLORS[i % LINE_COLORS.length], v: pick(s.months[hover], metric) }))
          .sort((a, b) => b.v - a.v);

  return (
    <div className="w-full">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-ink">12 个月{METRIC_LABEL[metric]}折线对比</span>
        <span className="font-mono text-[11px] text-muted">
          {hover === null ? (series.length ? "悬停查看同月数值" : "还未选中城市") : `${hover + 1}月 · 按高到低`}
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
              x2={PAD.l + INNER_W}
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

        {/* 城市折线 + 悬停点 */}
        {series.map((s, i) => {
          const color = LINE_COLORS[i % LINE_COLORS.length];
          const pts = s.months.map((m, k) => `${xOf(k).toFixed(1)},${yOf(pick(m, metric)).toFixed(1)}`).join(" ");
          return (
            <g key={`line-${s.id}`}>
              <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {hover !== null && <circle cx={xOf(hover)} cy={yOf(pick(s.months[hover], metric))} r={3.4} fill={color} />}
            </g>
          );
        })}

        {/* 线尾城市标签 */}
        {series.map((s, i) => {
          const color = LINE_COLORS[i % LINE_COLORS.length];
          const yEnd = yOf(pick(s.months[11], metric));
          const ly = labelY[i];
          return (
            <g key={`label-${s.id}`}>
              <line x1={xOf(11)} y1={yEnd} x2={PAD.l + INNER_W + 6} y2={ly} stroke={color} strokeWidth={1} opacity={0.5} />
              <circle cx={PAD.l + INNER_W + 6} cy={ly} r={2.6} fill={color} />
              <text x={PAD.l + INNER_W + 12} y={ly + 3.5} className="text-[10.5px] font-medium" fill={color}>
                {s.name}
              </text>
            </g>
          );
        })}

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
        {MONTHS.map((lab, i) => (
          <text
            key={lab}
            x={xOf(i)}
            y={H - PAD.b + 18}
            textAnchor="middle"
            className="font-mono text-[10.5px]"
            fill={hover === i ? "var(--foreground)" : "var(--color-faint)"}
          >
            {lab}
          </text>
        ))}

        {/* 空态提示 */}
        {series.length === 0 && (
          <text
            x={PAD.l + INNER_W / 2}
            y={PAD.t + INNER_H / 2}
            textAnchor="middle"
            className="text-[12px]"
            fill="var(--color-faint)"
          >
            在左侧勾选城市开始对比(可以一个都不选)
          </text>
        )}
      </svg>

      {/* 图例 */}
      {series.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {series.map((s, i) => (
            <span key={s.id} className="flex items-center gap-1.5 text-[11px] text-muted">
              <span className="inline-block h-[3px] w-4 rounded-full" style={{ background: LINE_COLORS[i % LINE_COLORS.length] }} />
              {s.name}
            </span>
          ))}
        </div>
      )}

      {/* 悬停读数(按温度从高到低) */}
      {hover !== null && readout.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10.5px] text-muted">
          {readout.map((r) => (
            <span key={r.name} className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />
              {r.name} {r.v.toFixed(1)}°
            </span>
          ))}
        </div>
      )}

      <p className="mt-1.5 text-[10.5px] text-faint">
        y 轴温度范围 {lo}–{hi} ℃ 与单城视图一致;折线颜色见上方图例,线尾标注城市名。
      </p>
    </div>
  );
}
