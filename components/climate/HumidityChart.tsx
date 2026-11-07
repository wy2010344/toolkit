/**
 * 单城 12 个月相对湿度图。
 * 与上方气温带共用 W / PAD / SLOT,x 轴逐月位置完全对齐,方便上下对照「雨季高湿、干季干燥」。
 * y 轴为固定的湿度范围(外部传入),叠 40–65 % 舒适带与其他城市参考线(开关与气温带共用)。
 * 口径:2023–2025 近 3 年逐日 relative_humidity_2m_mean 按月平均,与 30 年气温不可混算。
 */
"use client";

import { useState, type MouseEvent } from "react";
import { HUM_COMFORT_BAND, type MonthlyEnv } from "@/lib/climate/env";

const MONTHS = Array.from({ length: 12 }, (_, i) => `${i + 1}月`);

// W / PAD 与 TempBandChart 保持一致,两张图的月份位置才能逐格对齐。
const W = 760;
const H = 210;
const PAD = { l: 48, r: 20, t: 20, b: 36 };
const INNER_W = W - PAD.l - PAD.r;
const INNER_H = H - PAD.t - PAD.b;
const SLOT = INNER_W / 12;
const TICK_STEP = 10;

export function HumidityChart({
  env,
  domain,
  reference = [],
}: {
  env: MonthlyEnv[];
  /** 固定的 y 轴湿度范围 [最低, 最高],与多城湿度对比共用。 */
  domain: [number, number];
  /** 其他城市的逐月湿度参考线,与气温带共用同一个开关。 */
  reference?: MonthlyEnv[][];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [lo, hi] = domain;
  const span = hi - lo || 1;

  const xOf = (i: number) => PAD.l + SLOT * (i + 0.5);
  const yOf = (v: number) => PAD.t + INNER_H * (1 - (v - lo) / span);
  const baseline = PAD.t + INNER_H;

  const ticks: number[] = [];
  for (let t = lo; t <= hi + 1e-6; t += TICK_STEP) ticks.push(t);

  const toPath = (rows: MonthlyEnv[]) =>
    rows.map((e, i) => `${xOf(i).toFixed(1)},${yOf(e.hum).toFixed(1)}`).join(" ");
  const linePath = toPath(env);
  const areaPath = `${xOf(0).toFixed(1)},${baseline.toFixed(1)} ${linePath} ${xOf(11).toFixed(1)},${baseline.toFixed(1)}`;

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

  const hovered = hover === null ? null : env[hover];

  return (
    <div className="w-full">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-ink">12 个月相对湿度</span>
        <span className="text-[10.5px] text-faint">2023–2025 共 3 年逐月均值 · 与上方气温口径不同</span>
      </div>

      {/* 图例 + 悬停读数 */}
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 font-mono text-[10.5px] text-faint">
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-3.5 bg-foreground" />
            月均湿度
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-3 rounded-[2px] border border-line-strong bg-surface-mute" />
            {HUM_COMFORT_BAND[0]}–{HUM_COMFORT_BAND[1]}% 舒适区间
          </span>
          {reference.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-0.5 w-3.5 bg-line-strong" />
              其他城市
            </span>
          )}
        </div>
        <span className="font-mono text-[11px] text-muted">
          {hovered ? `${hovered.m}月 · 湿度 ${hovered.hum.toFixed(0)}%` : "悬停查看逐月数值"}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded-lg border border-line bg-surface"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* 湿度舒适带 */}
        <rect
          x={PAD.l}
          y={yOf(HUM_COMFORT_BAND[1])}
          width={INNER_W}
          height={yOf(HUM_COMFORT_BAND[0]) - yOf(HUM_COMFORT_BAND[1])}
          fill="var(--foreground)"
          opacity={0.045}
        />
        {HUM_COMFORT_BAND.map((v) => (
          <line
            key={v}
            x1={PAD.l}
            y1={yOf(v)}
            x2={W - PAD.r}
            y2={yOf(v)}
            stroke="var(--color-line-strong)"
            strokeWidth={1}
            strokeDasharray="3 4"
          />
        ))}

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
              {t}%
            </text>
          </g>
        ))}

        {/* 其他城市参考折线 */}
        {reference.map((rows, i) => (
          <polyline
            key={i}
            points={toPath(rows)}
            fill="none"
            stroke="var(--color-line-strong)"
            strokeWidth={1.1}
            opacity={0.5}
          />
        ))}

        {/* 湿度面积 + 折线 */}
        <polygon points={areaPath} fill="var(--color-acc-blue-fg)" opacity={0.13} />
        <polyline points={linePath} fill="none" stroke="var(--foreground)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {env.map((e, i) => (
          <circle key={e.m} cx={xOf(i)} cy={yOf(e.hum)} r={hover === i ? 4 : 2.6} fill="var(--foreground)" />
        ))}

        {/* 悬停竖向参考线 */}
        {hover !== null && (
          <line
            x1={xOf(hover)}
            y1={PAD.t}
            x2={xOf(hover)}
            y2={baseline}
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
      </svg>

      <p className="mt-1.5 text-[10.5px] text-faint">
        y 轴相对湿度 {lo}–{hi} % 固定不变,浅色带为 {HUM_COMFORT_BAND[0]}–{HUM_COMFORT_BAND[1]} % 舒适区间(与宜居度评分模型一致);
        其他城市参考线与上方气温带共用同一开关。湿度为近 3 年口径,与气温 30 年口径不同,不可直接混算。
      </p>
    </div>
  );
}
