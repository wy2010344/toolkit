/**
 * 旅居气候对比主界面:左侧城市列表,右侧单城 12 个月气温带图 + 指标 + 数值表。
 * y 轴温度范围由全部城市一次性算出并固定,切换城市时不重算,方便横向对照。
 */
"use client";

import { useMemo, useState } from "react";
import { CLIMATES } from "@/lib/climate/cities";
import { computeStats } from "@/lib/climate/stats";
import type { CityId, MonthlyTemp } from "@/lib/climate/types";
import { Toggle, cn } from "@/components/ui";
import { TempBandChart } from "./TempBandChart";

/** 从全部城市数据推出统一的 y 轴范围(向外取整到 5 的倍数)。 */
const DOMAIN: [number, number] = (() => {
  const vals = CLIMATES.flatMap((c) => c.months.flatMap((m) => [m.min, m.max]));
  const lo = Math.floor((Math.min(...vals) - 1) / 5) * 5;
  const hi = Math.ceil((Math.max(...vals) + 1) / 5) * 5;
  return [lo, hi];
})();

/** 城市行里的小型月均温折线,使用同一个 y 轴范围,便于列表内快速比较。 */
function Spark({ months, domain }: { months: MonthlyTemp[]; domain: [number, number] }) {
  const [lo, hi] = domain;
  const span = hi - lo || 1;
  const pts = months
    .map((m, i) => `${((i / 11) * 60).toFixed(1)},${(18 - ((m.mean - lo) / span) * 18).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox="0 0 60 18" className="h-[18px] w-[60px] shrink-0" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinejoin="round" />
    </svg>
  );
}

export function ClimateApp() {
  const [selected, setSelected] = useState<CityId>("kunming");
  const [showRef, setShowRef] = useState(true);

  const city = CLIMATES.find((c) => c.id === selected) ?? CLIMATES[0];
  const stats = useMemo(() => computeStats(city.months), [city]);
  const refs = useMemo(
    () => (showRef ? CLIMATES.filter((c) => c.id !== city.id).map((c) => c.months) : []),
    [city, showRef],
  );

  const chips = [
    { label: "全年均温", value: `${stats.annualMean.toFixed(1)}°` },
    { label: "最热月", value: `${stats.hottest.m}月 ${stats.hottest.mean.toFixed(1)}°` },
    { label: "最冷月", value: `${stats.coldest.m}月 ${stats.coldest.mean.toFixed(1)}°` },
    { label: "月均温极差", value: `${stats.annualRange.toFixed(1)}°` },
    { label: "平均昼夜温差", value: `${stats.diurnalRange.toFixed(1)}°` },
  ];

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-canvas">
      {/* 左侧城市列表 */}
      <aside className="flex w-44 shrink-0 flex-col border-r border-line bg-surface sm:w-56">
        <div className="border-b border-line px-4 py-3">
          <h1 className="text-[13px] font-semibold text-ink">旅居气候对比</h1>
          <p className="mt-0.5 text-[11px] text-faint">1995–2024 共 30 年逐月均值</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          {CLIMATES.map((c) => {
            const active = c.id === selected;
            return (
              <button
                key={c.id}
                onClick={() => setSelected(c.id)}
                className={cn(
                  "mb-1 flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
                  active
                    ? "border-line-strong bg-canvas"
                    : "border-transparent hover:bg-surface-mute",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[13px] font-medium text-ink">{c.name}</span>
                    <span className="text-[10px] text-faint">{c.region}</span>
                  </div>
                  <div className="font-mono text-[10px] text-faint">海拔 {c.elevation} m</div>
                </div>
                <span className={active ? "text-acc-orange-fg" : "text-faint"}>
                  <Spark months={c.months} domain={DOMAIN} />
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* 右侧详情 */}
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-5 py-6 sm:px-8">
          <header className="mb-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight text-ink">{city.name}</h2>
              <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">{city.region}</span>
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-faint">{city.note}</p>
            <p className="mt-1 font-mono text-[11px] text-faint">
              {city.lat.toFixed(2)}°N · {city.lon.toFixed(2)}°E · 海拔 {city.elevation} m
            </p>
          </header>

          <section className="rounded-xl border border-line bg-surface p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <span className="text-[13px] font-medium text-ink">12 个月气温变化</span>
              <Toggle label="显示其他城市参考线" checked={showRef} onChange={setShowRef} />
            </div>
            <TempBandChart months={city.months} domain={DOMAIN} reference={refs} />
          </section>

          <section className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {chips.map((c) => (
              <div key={c.label} className="rounded-lg border border-line bg-surface px-3 py-2">
                <div className="text-[10.5px] text-faint">{c.label}</div>
                <div className="mt-0.5 font-mono text-[15px] font-medium text-ink">{c.value}</div>
              </div>
            ))}
          </section>

          <section className="mt-4 overflow-hidden rounded-xl border border-line bg-surface">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-line text-[10.5px] text-faint">
                  <th className="px-3 py-2 text-left font-medium">月份</th>
                  <th className="px-3 py-2 text-right font-medium">最高温</th>
                  <th className="px-3 py-2 text-right font-medium">最低温</th>
                  <th className="px-3 py-2 text-right font-medium">平均温</th>
                  <th className="px-3 py-2 text-right font-medium">昼夜温差</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {city.months.map((m) => (
                  <tr key={m.m} className="border-b border-line/60 last:border-0 hover:bg-surface-mute/60">
                    <td className="px-3 py-1.5 text-left font-sans text-muted">{m.m}月</td>
                    <td className="px-3 py-1.5 text-right text-ink">{m.max.toFixed(1)}°</td>
                    <td className="px-3 py-1.5 text-right text-muted">{m.min.toFixed(1)}°</td>
                    <td className="px-3 py-1.5 text-right font-medium text-ink">{m.mean.toFixed(1)}°</td>
                    <td className="px-3 py-1.5 text-right text-faint">{(m.max - m.min).toFixed(1)}°</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <p className="mt-4 text-[10.5px] leading-relaxed text-faint">
            数据:Open-Meteo 历史天气接口(ERA5 再分析),1995–2024 年逐日气温按自然月求平均;各地取市区代表点,海拔越高通常越凉。
          </p>
        </div>
      </main>
    </div>
  );
}
