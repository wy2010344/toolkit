/**
 * 城市规模:把各城的「城区常住人口」与「建成区面积」并排画成条形,
 * 一眼看出哪些是大城市、哪些只是县城。点击某一行会与左侧列表、图册联动。
 *
 * 两项指标量级跨度太大(深圳 1760 万人 / 县城 5 万人),条形用对数刻度,
 * 否则县城会被压成看不见的一条线;数字仍然原样显示。
 */
"use client";

import { useMemo, useState } from "react";
import { CLIMATES } from "@/lib/climate/cities";
import { URBAN } from "@/lib/climate/archive";
import type { CityId } from "@/lib/climate/types";
import { cn } from "@/components/ui";

type SortKey = "pop" | "area";

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

/** 对数刻度:宽度按 log10(1+v) 归一,让 5 万人的县城仍有可读长度。 */
function barPct(v: number, max: number) {
  return (Math.log10(v + 1) / Math.log10(max + 1)) * 100;
}

const fmt = (v: number) => (Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1));

export function ScaleView({ selected, onSelect }: { selected: CityId; onSelect: (id: CityId) => void }) {
  const [sort, setSort] = useState<SortKey>("pop");

  const maxPop = useMemo(() => Math.max(...CLIMATES.map((c) => URBAN[c.id].pop)), []);
  const maxArea = useMemo(() => Math.max(...CLIMATES.map((c) => URBAN[c.id].area)), []);

  const rows = useMemo(
    () =>
      CLIMATES.map((c) => ({ id: c.id, name: c.name, region: c.region, ...URBAN[c.id] })).sort(
        (a, b) => b[sort] - a[sort] || b.pop + b.area - (a.pop + a.area),
      ),
    [sort],
  );

  const biggest = rows[0];

  return (
    <div className="mx-auto max-w-3xl px-5 py-6 sm:px-8">
      <header className="mb-4">
        <h2 className="text-xl font-semibold tracking-tight text-ink">城市规模</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-faint">
          城区常住人口与建成区面积,按「城区」口径比较:深圳城区 {fmt(URBAN.shenzhen.pop)} 万人、建成区{" "}
          {fmt(URBAN.shenzhen.area)} km²,而多数县城只有几万人、几平方公里。当前排序下最大的是
          <span className="mx-1 text-ink">{biggest.name}</span>。
        </p>
        <div className="mt-3">
          <Segmented<SortKey>
            value={sort}
            onChange={setSort}
            options={[
              { v: "pop", label: "按城区人口" },
              { v: "area", label: "按建成区面积" },
            ]}
          />
        </div>
      </header>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <ul className="divide-y divide-line/70">
          {rows.map((r, i) => {
            const isSel = r.id === selected;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onSelect(r.id)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                    isSel ? "bg-acc-orange-bg/40" : "hover:bg-surface-mute/60",
                  )}
                >
                  <span className="w-5 shrink-0 text-right font-mono text-[11px] text-faint">{i + 1}</span>
                  <div className="w-24 shrink-0">
                    <div className="text-[13px] font-medium text-ink">{r.name}</div>
                    <div className="text-[10px] text-faint">{r.region}</div>
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-7 shrink-0 text-[10px] text-faint">人口</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-mute">
                        <div
                          className="h-full rounded-full bg-acc-blue-fg"
                          style={{ width: `${barPct(r.pop, maxPop)}%` }}
                        />
                      </div>
                      <span className="w-16 shrink-0 text-right font-mono text-[11px] text-ink">{fmt(r.pop)} 万</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-7 shrink-0 text-[10px] text-faint">面积</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-mute">
                        <div
                          className="h-full rounded-full bg-acc-green-fg"
                          style={{ width: `${barPct(r.area, maxArea)}%` }}
                        />
                      </div>
                      <span className="w-16 shrink-0 text-right font-mono text-[11px] text-muted">{fmt(r.area)} km²</span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="mt-2.5 text-[10.5px] leading-relaxed text-faint">
        口径:人口为城区常住人口、面积为建成区面积(不是市域总面积);重庆取中心城区、深圳取全市建成区,县城取县城建成区。
        数据为人工整理的 2022–2023 年约值,只用于比较量级,不参与宜居评分。条形为对数刻度,数字为原值。
      </p>
    </div>
  );
}
