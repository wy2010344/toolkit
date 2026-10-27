/**
 * 单城舒适度日历:12 个月的舒适度热力格 + 最佳旅居时段。
 * 纯展示组件,数据来自 lib/climate/score.ts 的 CityScore。
 */
import type { CityScore } from "@/lib/climate/score";

/** 舒适度 → 颜色(红→黄→绿)。 */
function comfortColor(s: number): string {
  const hue = Math.max(0, Math.min(130, (s - 45) * 2.6)); // 45→红,95→绿
  const light = s >= 78 ? 48 : s >= 65 ? 54 : 60;
  return `hsl(${hue.toFixed(0)} 62% ${light}%)`;
}

export function ComfortCalendar({ score }: { score: CityScore }) {
  const months = score.months;
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-ink">{score.name} · 逐月舒适度</span>
        <span className="text-[11px] text-faint">最佳旅居时段:{score.bestWindow}</span>
      </div>

      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
        {months.map((m) => (
          <div
            key={m.m}
            title={`${m.m}月 均温 ${m.temp.toFixed(1)}℃ · 体感 ${m.feels.toFixed(1)}℃ · 舒适度 ${m.score}`}
            className="flex flex-col items-center justify-center rounded-md py-2 text-white"
            style={{ backgroundColor: comfortColor(m.score) }}
          >
            <span className="text-[11px] font-medium leading-none">{m.m}月</span>
            <span className="mt-1 font-mono text-[13px] font-semibold leading-none">{m.score.toFixed(0)}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] text-faint">
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: comfortColor(88) }} /> 舒适
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: comfortColor(70) }} /> 一般
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: comfortColor(52) }} /> 不宜
        </span>
        <span className="ml-auto">气温:30 年均值 · 体感/湿度/风雨:2023–2025 近年口径</span>
      </div>
    </section>
  );
}
