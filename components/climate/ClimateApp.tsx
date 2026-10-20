/**
 * 旅居气候对比主界面。
 * 三种视图:
 *   ① 单城温度带 —— 选一座城市,看 12 个月最低温→最高温的色带与月均温折线;
 *   ② 多城折线对比 —— 勾选任意多座城市(可一个都不选),同屏叠折线,指标可切换最高 / 平均 / 最低温;
 *   ③ 地图索引 —— 在底图上定位全部城市,可切换底图并叠加行政区域边界。
 * 温度带与折线的 y 轴范围由全部城市一次性算出并固定,两视图共用,切换时可直接横向对照。
 */
"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { CLIMATES, climateOf } from "@/lib/climate/cities";
import { ARCHIVES, ARCHIVE_FIELDS } from "@/lib/climate/archive";
import { computeStats } from "@/lib/climate/stats";
import type { CityId, MonthlyTemp } from "@/lib/climate/types";
import { Toggle, cn } from "@/components/ui";
import { TempBandChart } from "./TempBandChart";
import { CompareChart, LINE_COLORS, type CompareSeries, type Metric } from "./CompareChart";
import type { MapPoint } from "./MapIndex";

/** 地图视图按需加载:Leaflet 依赖 window,不参与预渲染。 */
const MapIndex = dynamic(() => import("./MapIndex").then((m) => m.MapIndex), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-[12px] text-faint">地图加载中…</div>,
});

/** 从全部城市数据推出统一的 y 轴范围(向外取整到 5 的倍数)。 */
const DOMAIN: [number, number] = (() => {
  const vals = CLIMATES.flatMap((c) => c.months.flatMap((m) => [m.min, m.max]));
  const lo = Math.floor((Math.min(...vals) - 1) / 5) * 5;
  const hi = Math.ceil((Math.max(...vals) + 1) / 5) * 5;
  return [lo, hi];
})();

type ViewMode = "band" | "compare" | "map";

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

/** 轻量分段控件(视图切换 / 指标切换共用)。 */
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

export function ClimateApp() {
  const [view, setView] = useState<ViewMode>("band");
  const [selected, setSelected] = useState<CityId>("kunming");
  const [picked, setPicked] = useState<CityId[]>(["kunming", "chongqing", "shenzhen"]);
  const [metric, setMetric] = useState<Metric>("mean");
  const [showRef, setShowRef] = useState(true);

  const city = climateOf(selected);
  const stats = useMemo(() => computeStats(city.months), [city]);
  const refs = useMemo(
    () => (showRef ? CLIMATES.filter((c) => c.id !== city.id).map((c) => c.months) : []),
    [city, showRef],
  );

  // 对比序列按 CLIMATES 顺序取,保证同一城市配色稳定。
  const series: CompareSeries[] = useMemo(
    () => CLIMATES.filter((c) => picked.includes(c.id)).map((c) => ({ id: c.id, name: c.name, months: c.months })),
    [picked],
  );
  const colorIndexOf = (id: CityId) => series.findIndex((s) => s.id === id);

  // 地图点位:配色与折线视图一致,都按 CLIMATES 顺序取色。
  const points: MapPoint[] = useMemo(
    () =>
      CLIMATES.map((c, i) => ({
        id: c.id,
        name: c.name,
        region: c.region,
        lat: c.lat,
        lon: c.lon,
        elevation: c.elevation,
        janMean: c.months[0].mean,
        julMean: c.months[6].mean,
        color: LINE_COLORS[i % LINE_COLORS.length],
      })),
    [],
  );

  const togglePick = (id: CityId) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const chips = [
    { label: "全年均温", value: `${stats.annualMean.toFixed(1)}°` },
    { label: "最热月", value: `${stats.hottest.m}月 ${stats.hottest.mean.toFixed(1)}°` },
    { label: "最冷月", value: `${stats.coldest.m}月 ${stats.coldest.mean.toFixed(1)}°` },
    { label: "月均温极差", value: `${stats.annualRange.toFixed(1)}°` },
    { label: "平均昼夜温差", value: `${stats.diurnalRange.toFixed(1)}°` },
    { label: "宜居月数", value: `${stats.livableMonths} 个月` },
    { label: "避暑指数", value: `${stats.summerIndex.toFixed(1)}°` },
    { label: "避寒指数", value: `${stats.winterIndex.toFixed(1)}°` },
  ];

  const archive = ARCHIVES[city.id];

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-canvas">
      {/* 左侧:视图切换 + 城市列表 */}
      <aside className="flex w-44 shrink-0 flex-col border-r border-line bg-surface sm:w-56">
        <div className="border-b border-line px-4 py-3">
          <h1 className="text-[13px] font-semibold text-ink">旅居气候对比</h1>
          <p className="mt-0.5 text-[11px] text-faint">{CLIMATES.length} 城 · 1995–2024 共 30 年逐月均值</p>
          <div className="mt-2">
            <Segmented<ViewMode>
              value={view}
              onChange={setView}
              options={[
                { v: "band", label: "单城" },
                { v: "compare", label: "折线" },
                { v: "map", label: "地图" },
              ]}
            />
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          {CLIMATES.map((c) => {
            const active = view === "compare" ? picked.includes(c.id) : c.id === selected;
            const ci = colorIndexOf(c.id);
            return (
              <button
                key={c.id}
                onClick={() => (view === "compare" ? togglePick(c.id) : setSelected(c.id))}
                className={cn(
                  "mb-1 flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
                  active ? "border-line-strong bg-canvas" : "border-transparent hover:bg-surface-mute",
                )}
              >
                {view === "compare" && (
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border",
                      active ? "border-transparent bg-ink text-white" : "border-line-strong",
                    )}
                  >
                    {active && <Check size={10} weight="bold" />}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[13px] font-medium text-ink">{c.name}</span>
                    <span className="text-[10px] text-faint">{c.region}</span>
                  </div>
                  <div className="font-mono text-[10px] text-faint">海拔 {c.elevation} m</div>
                </div>
                <span
                  className={cn("shrink-0", view === "band" && active ? "text-acc-orange-fg" : "text-faint")}
                  style={view === "compare" && ci >= 0 ? { color: LINE_COLORS[ci % LINE_COLORS.length] } : undefined}
                >
                  <Spark months={c.months} domain={DOMAIN} />
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* 右侧 */}
      <main className={cn("min-w-0 flex-1", view === "map" ? "overflow-hidden" : "overflow-y-auto")}>
        {view === "map" ? (
          <MapIndex points={points} selectedId={selected} onSelect={setSelected} />
        ) : (
        <div className="mx-auto max-w-3xl px-5 py-6 sm:px-8">
          {view === "band" ? (
            <>
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

              <section className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {chips.map((c) => (
                  <div key={c.label} className="rounded-lg border border-line bg-surface px-3 py-2">
                    <div className="text-[10.5px] text-faint">{c.label}</div>
                    <div className="mt-0.5 font-mono text-[15px] font-medium text-ink">{c.value}</div>
                  </div>
                ))}
              </section>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-faint">
                宜居月数 = 月均温落在 15–25 ℃ 的月份数;避暑指数 = 6–8 月平均月均温(越低越凉);避寒指数 = 12、1、2 月平均月均温(越高越暖)。
              </p>

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

              <section className="mt-4 overflow-hidden rounded-xl border border-line bg-surface p-4">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[13px] font-medium text-ink">城市档案</span>
                  <span className="text-[10.5px] text-faint">人工整理 · 可能滞后 · 仅供参考</span>
                </div>
                <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {ARCHIVE_FIELDS.map((f) => (
                    <div key={f.key} className="rounded-lg border border-line bg-surface-mute/40 px-3 py-2">
                      <dt className="text-[10.5px] text-faint">{f.label}</dt>
                      <dd className="mt-0.5 text-[12px] leading-relaxed text-ink">{archive[f.key]}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <p className="mt-4 text-[10.5px] leading-relaxed text-faint">
                数据:Open-Meteo 历史天气接口(ERA5 再分析),1995–2024 年逐日气温按自然月求平均;各地取市区代表点,海拔越高通常越凉。
              </p>
            </>
          ) : (
            <>
              <header className="mb-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold tracking-tight text-ink">多城折线对比</h2>
                  <Segmented<Metric>
                    value={metric}
                    onChange={setMetric}
                    options={[
                      { v: "max", label: "最高温" },
                      { v: "mean", label: "平均温" },
                      { v: "min", label: "最低温" },
                    ]}
                  />
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-faint">
                  在左侧勾选城市同屏对比,可多选也可一个都不选;每条折线线尾标注城市名,并可在上方切换指标。
                </p>
              </header>

              <section className="rounded-xl border border-line bg-surface p-4">
                <CompareChart series={series} domain={DOMAIN} metric={metric} />
              </section>

              <p className="mt-4 text-[10.5px] leading-relaxed text-faint">
                数据:Open-Meteo 历史天气接口(ERA5 再分析),1995–2024 年逐日气温按自然月求平均;各地取市区代表点,海拔越高通常越凉。
              </p>
            </>
          )}
        </div>
        )}
      </main>
    </div>
  );
}
