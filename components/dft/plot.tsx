/**
 * DFT 模块专用的 SVG 图表积木。
 * 手工画,零依赖:只画“波形折线 / 乘积柱状图 / 频谱柱状图”三类。
 */
"use client";

import { useMemo } from "react";
import { cn } from "@/components/ui";

const C = {
  blue: "var(--color-acc-blue-fg)",
  green: "var(--color-acc-green-fg)",
  red: "var(--color-acc-red-fg)",
  yellow: "var(--color-acc-yellow-fg)",
  ink: "var(--foreground)",
  line: "var(--color-line-strong)",
};

export function fmtNum(v: number, digits = 2): string {
  if (!Number.isFinite(v)) return "–";
  if (Math.abs(v) < Math.pow(10, -digits - 1)) return (0).toFixed(digits);
  return v.toFixed(digits);
}

/** 一段波形折线图:y 自动按最大绝对值归一,含零轴与半程虚线。 */
export function WavePlot({
  pts,
  color = C.blue,
  height = 130,
  label,
}: {
  pts: number[];
  color?: string;
  height?: number;
  label?: string;
}) {
  const { W, H, d, zeroY } = useMemo(() => {
    const W = 560;
    const H = height;
    const pad = 8;
    const max = Math.max(1e-9, ...pts.map((v) => Math.abs(v)));
    const innerW = W - pad * 2;
    const innerH = H - pad * 2;
    const zeroY = pad + innerH / 2;
    const points = pts
      .map((v, n) => {
        const x = pad + (n / (pts.length - 1 || 1)) * innerW;
        const y = zeroY - (v / max) * (innerH / 2) * 0.92;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    return { W, H, d: points, zeroY };
  }, [pts, height]);

  return (
    <div>
      {label && <div className="mb-1 font-mono text-[10.5px] text-faint">{label}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border border-line bg-surface">
        <line x1={8} y1={zeroY} x2={W - 8} y2={zeroY} stroke={C.line} strokeWidth={1} />
        <line
          x1={8}
          y1={zeroY - (H - 16) / 4}
          x2={W - 8}
          y2={zeroY - (H - 16) / 4}
          className="stroke-line"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <line
          x1={8}
          y1={zeroY + (H - 16) / 4}
          x2={W - 8}
          y2={zeroY + (H - 16) / 4}
          className="stroke-line"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <polyline points={d} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** 共振实验的核心可视化:上 = 逐帧乘积(绿正红负),下 = 累积和折线。 */
export function ProductPlot({
  products,
  runningSum,
  total,
  size,
}: {
  products: number[];
  runningSum: number[];
  total: number;
  size: number;
}) {
  const W = 560;
  const topH = 120;
  const botH = 110;
  const H = topH + botH + 26;
  const pad = 8;
  const step = (W - pad * 2) / (size - 1 || 1);

  const maxP = Math.max(1e-9, ...products.map((v) => Math.abs(v)));
  const maxS = Math.max(1e-9, ...runningSum.map((v) => Math.abs(v)));
  const cTop = pad + topH / 2;
  const cBot = pad + topH + 20 + botH / 2;
  const barH = topH / 2 - 8;

  const runPts = runningSum
    .map((v, n) => {
      const x = pad + n * step;
      const y = cBot - (v / maxS) * (botH / 2 - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border border-line bg-surface">
        {/* 上区:逐帧乘积 */}
        <line x1={pad} y1={cTop} x2={W - pad} y2={cTop} stroke={C.line} strokeWidth={1} />
        {products.map((p, n) => {
          const x = pad + n * step;
          const h = (p / maxP) * barH;
          const y = p >= 0 ? cTop - h : cTop;
          return (
            <rect
              key={n}
              x={x + 0.5}
              y={y}
              width={Math.max(1, step * 0.72)}
              height={Math.max(0.5, Math.abs(h))}
              fill={p >= 0 ? C.green : C.red}
              opacity={p >= 0 ? 0.75 : 0.75}
            />
          );
        })}
        <text x={pad + 2} y={pad + 12} className="fill-muted text-[10px]">
          逐帧乘积 x[n] · 探针[n]
        </text>

        {/* 下区:累积和 */}
        <line x1={pad} y1={cBot} x2={W - pad} y2={cBot} stroke={C.line} strokeWidth={1} />
        <polyline points={runPts} fill="none" stroke={C.blue} strokeWidth={2} strokeLinejoin="round" />
        <text x={pad + 2} y={pad + topH + 20 + botH - 6} className="fill-muted text-[10px]">
          累计和 Σ
        </text>
        <circle
          cx={pad + (size - 1) * step}
          cy={cBot - (total / maxS) * (botH / 2 - 8)}
          r={3.2}
          fill={C.blue}
        />
        <text
          x={W - pad - 6}
          y={cBot}
          textAnchor="end"
          className={cn("font-mono text-[10px]", Math.abs(total) > 1e-6 ? "fill-[var(--color-acc-blue-fg)]" : "fill-faint")}
        >
          总计 {fmtNum(total, 3)}
        </text>
      </svg>
      <div className="mt-1 flex gap-3 font-mono text-[10px] text-faint">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-[var(--color-acc-green-fg)]" /> 正(帮忙)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-[var(--color-acc-red-fg)]" /> 负(顶回去)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-3 bg-[var(--color-acc-blue-fg)]" /> 累计和
        </span>
      </div>
    </div>
  );
}

/** 频谱柱状图:每个 k 一根柱,柱高 = 该频道的声量。可点选高亮。 */
export function SpectrumBars({
  amps,
  selected,
  onSelect,
  showHalf = true,
  label,
}: {
  amps: number[];
  selected?: number;
  onSelect?: (k: number) => void;
  showHalf?: boolean;
  label?: string;
}) {
  const W = 560;
  const H = 150;
  const pad = 8;
  const max = Math.max(1e-9, ...amps);
  const ks = useMemo(() => {
    const arr = amps.map((_, k) => k);
    return showHalf ? arr.filter((k) => k <= amps.length / 2) : arr;
  }, [amps, showHalf]);
  const step = (W - pad * 2) / (ks.length - 1 || 1);

  return (
    <div>
      {label && <div className="mb-1 font-mono text-[10.5px] text-faint">{label}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border border-line bg-surface">
        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke={C.line} strokeWidth={1} />
        {ks.map((k) => {
          const v = amps[k]!;
          const h = (v / max) * (H - pad * 2 - 14);
          const x = pad + k * step;
          const sel = k === selected;
          return (
            <g key={k} onClick={() => onSelect?.(k)} className="cursor-pointer" opacity={selected === undefined || sel ? 1 : 0.35}>
              <rect
                x={x - Math.max(2, step * 0.3) + 0.5}
                y={H - pad - h}
                width={Math.max(4, step * 0.6)}
                height={h}
                rx={1}
                fill={sel ? C.yellow : C.blue}
              />
              {k % 4 === 0 && (
                <text x={x} y={H - 3} textAnchor="middle" className="fill-faint text-[8.5px]">
                  {k}
                </text>
              )}
            </g>
          );
        })}
        {selected !== undefined && (
          <text x={W - pad} y={pad + 10} textAnchor="end" className="fill-muted text-[10.5px]">
            k={selected} · 声量 {fmtNum(amps[selected] ?? 0)}
          </text>
        )}
      </svg>
    </div>
  );
}