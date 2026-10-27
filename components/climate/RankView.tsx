/**
 * 旅居推荐排行:按某一偏好维度(综合 / 避暑 / 避寒 / 多日照 / 少雨 / 怕风)对全部候选城市排序,
 * 左侧榜单 + 右侧选中城市详情(逐月舒适度日历 + 六维指标)。
 */
"use client";

import { useMemo } from "react";
import { CLIMATES } from "@/lib/climate/cities";
import {
  DEFAULT_WEIGHTS,
  DIMENSIONS,
  normalizedWeights,
  rankBy,
  scoreOf,
  type ComfortWeights,
  type DimKey,
} from "@/lib/climate/score";
import type { CityId } from "@/lib/climate/types";
import { cn } from "@/components/ui";
import { ComfortCalendar } from "./ComfortCalendar";

function barColor(v: number) {
  const hue = Math.max(0, Math.min(130, (v - 45) * 2.6));
  return `hsl(${hue.toFixed(0)} 60% 45%)`;
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ v: T; label: string }>;
}) {
  return (
    <div className="inline-flex flex-wrap rounded-lg border border-line bg-surface-mute/60 p-0.5">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            "rounded-[6px] px-2.5 py-1 text-[12px] font-medium transition-colors",
            value === o.v ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 权重滑块的七项要素。 */
const WEIGHT_ITEMS: Array<{ key: keyof ComfortWeights; label: string }> = [
  { key: "thermal", label: "气温舒适" },
  { key: "rain", label: "雨日" },
  { key: "humidity", label: "湿度" },
  { key: "wind", label: "大风" },
  { key: "heat", label: "酷热" },
  { key: "frost", label: "霜冻" },
  { key: "sun", label: "日照" },
];

/** 自定义权重:滑块只调相对比例,右侧显示归一后的真实占比。 */
function WeightPanel({
  weights,
  onChange,
}: {
  weights: ComfortWeights;
  onChange: (w: ComfortWeights) => void;
}) {
  const pct = normalizedWeights(weights);
  const changed = WEIGHT_ITEMS.some((it) => weights[it.key] !== DEFAULT_WEIGHTS[it.key]);
  return (
    <details className="mt-3 rounded-xl border border-line bg-surface">
      <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-2 gap-y-1 px-3 py-2 text-[12px] font-medium text-ink">
        自定义权重
        <span className="text-[10.5px] font-normal text-faint">
          {changed ? "已偏离默认比例,榜单与单城分数随之重算" : "默认:气温 38% · 雨日 20% · 湿度 14% · 风与酷热各 8% · 霜冻与日照各 6%"}
        </span>
      </summary>
      <div className="grid gap-x-5 gap-y-2 px-3 pt-1 sm:grid-cols-2">
        {WEIGHT_ITEMS.map((it) => (
          <label key={it.key} className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-[11px] text-muted">{it.label}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={weights[it.key]}
              onChange={(e) => onChange({ ...weights, [it.key]: Number(e.target.value) })}
              className="h-1 flex-1 cursor-pointer accent-ink"
            />
            <span className="w-9 shrink-0 text-right font-mono text-[11px] text-ink">
              {(pct[it.key] * 100).toFixed(0)}%
            </span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-2.5 pt-1.5">
        <p className="flex-1 text-[10px] leading-relaxed text-faint">
          滑块只是相对比例,系统自动归一,全部调大不影响结果。图册的连续等值面是预生成栅格,仍按默认权重着色,只有榜单与单城 / 日历跟随自定义权重。
        </p>
        <button
          type="button"
          onClick={() => onChange(DEFAULT_WEIGHTS)}
          disabled={!changed}
          className="rounded-md border border-line px-2 py-0.5 text-[11px] text-muted transition-colors hover:text-ink disabled:opacity-40"
        >
          恢复默认
        </button>
      </div>
    </details>
  );
}

const MEDAL = ["bg-acc-yellow-fg text-black", "bg-muted/40 text-ink", "bg-acc-orange-fg/70 text-black"];

function Detail({ id, weights }: { id: CityId; weights: ComfortWeights }) {
  const score = useMemo(() => scoreOf(id, weights), [id, weights]);
  const dims: Array<{ key: DimKey; label: string }> = [
    { key: "overall", label: "综合" },
    { key: "summer", label: "避暑" },
    { key: "winter", label: "避寒" },
    { key: "sunny", label: "多日照" },
    { key: "dry", label: "少雨" },
    { key: "calm", label: "怕风" },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-ink">{score.name}</h3>
          <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">{score.region}</span>
          <span className="font-mono text-[10.5px] text-faint">海拔 {score.elevation} m</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded-md bg-acc-green-bg px-2 py-0.5 text-[11px] font-medium text-acc-green-fg">{score.climateTag}</span>
          <span className="rounded-md bg-acc-blue-bg px-2 py-0.5 text-[11px] font-medium text-acc-blue-fg">{score.rainTag}</span>
          <span className="rounded-md bg-surface-mute px-2 py-0.5 text-[11px] text-muted">舒适月 {score.goodMonths}/12</span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {dims.map((d) => {
            const v = (score as Record<DimKey, number>)[d.key];
            return (
              <div key={d.key} className="rounded-lg border border-line bg-surface-mute/40 px-2.5 py-1.5">
                <div className="text-[10.5px] text-faint">{d.label}</div>
                <div className="mt-0.5 font-mono text-[15px] font-medium text-ink">{v.toFixed(1)}</div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-mute">
                  <div className="h-full rounded-full" style={{ width: `${v}%`, backgroundColor: barColor(v) }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <ComfortCalendar score={score} />
      <p className="text-[10.5px] leading-relaxed text-faint">
        评分模型:月均温用 1995–2024 共 30 年均值;体感、湿度、雨日、日照、大风、高温、霜冻用 2023–2025 近年逐月数据。
        各子项归一到 0–100 后按上方权重合成逐月舒适度,拖动滑块即可改比例(默认气温 0.38、雨日 0.20、湿度 0.14、风 0.08、高温 0.08、霜冻 0.06、日照 0.06)。
      </p>
    </div>
  );
}

export function RankView({
  selected,
  onSelect,
  dim,
  onDim,
  weights,
  onWeights,
}: {
  selected: CityId;
  onSelect: (id: CityId) => void;
  /** 当前偏好维度:与地图上的「宜居」图层共用同一个。 */
  dim: DimKey;
  onDim: (d: DimKey) => void;
  /** 自定义权重:与单城 / 日历共用,保证全站同一套算法。 */
  weights: ComfortWeights;
  onWeights: (w: ComfortWeights) => void;
}) {
  const ranked = useMemo(() => rankBy(dim, weights), [dim, weights]);
  const active = DIMENSIONS.find((d) => d.key === dim)!;

  return (
    <div className="mx-auto max-w-5xl px-5 py-6 sm:px-8">
      <header className="mb-4">
        <h2 className="text-xl font-semibold tracking-tight text-ink">旅居推荐排行</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-faint">
          按你的偏好给 {CLIMATES.length} 城打分排序。当前维度:{active.label}——{active.desc}。点榜单里的城市可看右侧详情。
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-faint">
          这一列分数已经画成了云南全境的连续宜居度面:切到「地图 · 宜居」图层,同一个维度会以等值线加色带呈现,
          鼠标移到任意位置都能读出该点的分项,不止这 {CLIMATES.length} 个点。
        </p>
        <div className="mt-3">
          <Segmented<DimKey>
            value={dim}
            onChange={onDim}
            options={DIMENSIONS.map((d) => ({ v: d.key, label: d.label }))}
          />
        </div>
        <WeightPanel weights={weights} onChange={onWeights} />
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        {/* 榜单 */}
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <ul className="divide-y divide-line/70">
            {ranked.map((c, i) => {
              const v = (c as Record<DimKey, number>)[dim];
              const isSel = c.id === selected;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                      isSel ? "bg-acc-orange-bg/40" : "hover:bg-surface-mute/60",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold",
                        i < 3 ? MEDAL[i] : "bg-surface-mute text-muted",
                      )}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[13px] font-medium text-ink">{c.name}</span>
                        <span className="text-[10px] text-faint">{c.region}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="rounded bg-surface-mute px-1.5 py-px text-[9.5px] text-muted">{c.climateTag}</span>
                        <span className="rounded bg-surface-mute px-1.5 py-px text-[9.5px] text-muted">{c.rainTag}</span>
                      </div>
                    </div>
                    <div className="w-28 shrink-0 sm:w-36">
                      <div className="mb-1 flex items-baseline justify-between">
                        <span className="text-[10px] text-faint">{active.label}</span>
                        <span className="font-mono text-[12px] font-medium text-ink">{v.toFixed(1)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-mute">
                        <div className="h-full rounded-full" style={{ width: `${v}%`, backgroundColor: barColor(v) }} />
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* 选中城市详情 */}
        <div className="lg:sticky lg:top-2 lg:self-start">
          <Detail id={selected} weights={weights} />
        </div>
      </div>
    </div>
  );
}
