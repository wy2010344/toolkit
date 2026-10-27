/**
 * 云南等值线图册。
 *
 * 不按行政区划着色,而是把「数据的界线」画出来:等高线、等温线、等降水线、人口等值线、
 * 断裂带与历史震中,以及最重要的一层——**连续宜居度面**。
 *
 * 宜居度不再是 31 个孤立的分数,而是被铺到整幅云南的栅格上:逐月把气象要素插值成面,
 * 气温按直减率扣除地形影响,高温日与霜冻日由站点标定的单调曲线随气温反推,
 * 再用与榜单完全相同的 comfortOf() 逐像元合成 0–100 分,画成等值线 + 分层设色。
 * 于是「哪里适合住」变成一条条可以读数的线,鼠标移到任意位置还能即时读出该点的分项。
 *
 * 底图与等值线全部由 scripts/build-yunnan-atlas.mjs 预生成,断网可用。
 */
"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import {
  BAND_COLORS,
  BORDER,
  CONTOURS,
  FIELD_LEVELS,
  FIELD_LINES,
  FIELD_META,
  PROJ,
  RELIEF_RAMP,
  VIEW,
} from "@/lib/climate/atlas/yunnan";
import { FAULTS, QUAKES } from "@/lib/climate/atlas/faults";
import { loadProbe, type Probe } from "@/lib/climate/atlas/probe";
import { scoreAll, type DimKey } from "@/lib/climate/score";
import type { CityId } from "@/lib/climate/types";
import type { MapPoint } from "./MapIndex";

/* ─────────────────────────── 配色 ─────────────────────────── */

const C = {
  paper: "#f8f4ea",
  line: "#a2937a",
  lineStrong: "#6f6047",
  label: "#40382b",
  city: "#9f2f2d",
  elev: "#7d6b4e",
  temp: "#8f2f1f",
  rain: "#1f4e79",
  pop: "#573c70",
  quake: "#b4452f",
  fault: "#a83b22",
  comfort: "#3f7f55",
};

const GROUP_COLOR: Record<string, string> = {
  comfort: C.comfort,
  temp: C.temp,
  rain: C.rain,
  pop: C.pop,
  quake: C.quake,
  relief: C.elev,
};

/* ─────────────────────────── 投影 ─────────────────────────── */

const D2R = Math.PI / 180;
const P1 = 25 * D2R;
const P2 = 47 * D2R;
const L0 = 105 * D2R;
const NN = (Math.sin(P1) + Math.sin(P2)) / 2;
const CC = Math.cos(P1) ** 2 + 2 * NN * Math.sin(P1);
const RHO0 = Math.sqrt(CC) / NN;

function project(lat: number, lon: number): [number, number] {
  const theta = NN * (lon * D2R - L0);
  const rho = Math.sqrt(CC - 2 * NN * Math.sin(lat * D2R)) / NN;
  return [rho * Math.sin(theta) * PROJ.s + PROJ.tx, PROJ.ty - (RHO0 - rho * Math.cos(theta)) * PROJ.s];
}

/** viewBox 一个单位合多少公里(比例尺用)。 */
const KM_PER_UNIT = 6371 / PROJ.s;

/* ─────────────────────────── 小工具 ─────────────────────────── */

function segPath(segs: number[][]): string {
  let d = "";
  for (const s of segs) {
    d += `M${s[0]} ${s[1]}`;
    for (let i = 2; i < s.length; i += 2) d += `L${s[i]} ${s[i + 1]}`;
  }
  return d;
}

/** 在最长的一条折线上取标注点,角度顺着线的走向。 */
function anchorOf(segs: number[][]) {
  let best: number[] | null = null;
  for (const s of segs) if (!best || s.length > best.length) best = s;
  if (!best || best.length < 16) return null;
  const n = best.length / 2;
  const cum = [0];
  for (let i = 1; i < n; i++)
    cum.push(cum[i - 1] + Math.hypot(best[i * 2] - best[(i - 1) * 2], best[i * 2 + 1] - best[(i - 1) * 2 + 1]));
  const target = cum[n - 1] * 0.42;
  let i = 1;
  while (i < n - 1 && cum[i] < target) i++;
  const ang = (Math.atan2(best[i * 2 + 1] - best[(i - 1) * 2 + 1], best[i * 2] - best[(i - 1) * 2]) * 180) / Math.PI;
  return { x: best[i * 2], y: best[i * 2 + 1], ang: ang > 90 ? ang - 180 : ang < -90 ? ang + 180 : ang };
}

/* ─────────────────────────── 图层 ─────────────────────────── */

/** 宜居度排在最前:这是整个工具要回答的问题,其余图层都是它的佐证。 */
const GROUPS = [
  { key: "comfort", label: "宜居", fields: ["cOverall", "cSummer", "cWinter", "cSunny", "cDry", "cCalm"] },
  { key: "temp", label: "气温", fields: ["tJan", "tJul", "tYear"] },
  { key: "rain", label: "降水", fields: ["pYear", "pWet", "pDry"] },
  { key: "relief", label: "地势", fields: [] as string[] },
  { key: "pop", label: "人口", fields: ["pop"] },
  { key: "quake", label: "地震", fields: [] as string[] },
];

/** 宜居度图层 → 评分模型的维度键,让地图上的城市点色与榜单排名同源。 */
const COMFORT_DIM: Record<string, DimKey> = {
  cOverall: "overall",
  cSummer: "summer",
  cWinter: "winter",
  cSunny: "sunny",
  cDry: "dry",
  cCalm: "calm",
};

/** 反过来:评分维度 → 宜居度图层。地图与榜单共用一个偏好维度。 */
const DIM_FIELD: Record<DimKey, string> = {
  overall: "cOverall",
  summer: "cSummer",
  winter: "cWinter",
  sunny: "cSunny",
  dry: "cDry",
  calm: "cCalm",
};

/** 把一个数值落到对应色带上(与 PNG 里分档涂色的算法一致)。 */
function bandColorOf(fieldKey: string, v: number): string {
  const levels = FIELD_LEVELS[fieldKey] ?? [];
  const bands = BAND_COLORS[fieldKey] ?? [];
  if (!bands.length) return C.city;
  let b = 0;
  while (b < levels.length && v >= levels[b]) b++;
  return bands[Math.min(b, bands.length - 1)];
}

/** 等高线每 2000 m 加粗一档。 */
const isMajor = (v: number) => v % 2000 === 0;

interface ProbeRead {
  cx: number;
  cy: number;
  flip: boolean;
  v: Record<string, number>;
}

export function YunnanAtlas({
  points,
  selectedId,
  onSelect,
  dim,
  onDim,
}: {
  points: MapPoint[];
  selectedId: CityId;
  onSelect: (id: CityId) => void;
  /** 当前偏好维度:与推荐榜单共用,保证两边说的是同一件事。 */
  dim: DimKey;
  onDim: (d: DimKey) => void;
}) {
  /**
   * 手动选中的图层;null 表示跟随偏好维度(宜居层)。
   * 宜居层不另存状态,直接由 dim 推导:偏好一改,地图与榜单立刻同步,不会出现两边不一致的中间帧。
   */
  const [manual, setManual] = useState<string | null>(null);
  const sel = manual ?? DIM_FIELD[dim];
  const [showElev, setShowElev] = useState(true);
  const [probe, setProbe] = useState<ProbeRead | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const contRef = useRef<HTMLDivElement | null>(null);
  const probeRef = useRef<Probe | null>(null);

  // 探针数据单独取,不影响首屏。
  useEffect(() => {
    let alive = true;
    loadProbe()
      .then((p) => {
        if (alive) probeRef.current = p;
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const group = sel === "quake" || sel === "relief" ? sel : (FIELD_META[sel]?.group ?? "comfort");
  const meta = sel === "quake" || sel === "relief" ? null : FIELD_META[sel];
  const color = GROUP_COLOR[group] ?? C.comfort;
  const activeLines = useMemo(() => (FIELD_META[sel] ? (FIELD_LINES[sel] ?? []) : []), [sel]);
  const bandColors = meta ? (BAND_COLORS[sel] ?? []) : [];

  const cityScores = useMemo(() => {
    const m: Partial<Record<CityId, Record<DimKey, number>>> = {};
    for (const s of scoreAll())
      m[s.id] = { overall: s.overall, summer: s.summer, winter: s.winter, sunny: s.sunny, dry: s.dry, calm: s.calm };
    return m;
  }, []);

  /** 当前图层对应的评分维度(非宜居图层为 undefined)。 */
  const layerDim = COMFORT_DIM[sel];
  const showScore = layerDim != null;

  const elevPaths = useMemo(
    () =>
      CONTOURS.map((l) => ({
        v: l.v,
        d: segPath(l.segs),
        w: isMajor(l.v) ? 0.8 : 0.45,
        o: isMajor(l.v) ? 0.66 : 0.4,
      })),
    [],
  );

  const fieldPaths = useMemo(
    () => activeLines.map((l) => ({ v: l.v, d: segPath(l.segs), anchor: anchorOf(l.segs) })),
    [activeLines],
  );

  const faultPaths = useMemo(
    () =>
      FAULTS.map((f) => ({
        name: f.name,
        d: f.pts
          .map(([lon, lat]) => project(lat, lon))
          .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`)
          .join(""),
      })),
    [],
  );

  /** 城市标注:贪心避让,放不下就不标;选中的城市优先。 */
  const cityLabels = useMemo(() => {
    const boxes: Array<{ x: number; y: number; w: number; h: number }> = [];
    const hit = (b: { x: number; y: number; w: number; h: number }) =>
      boxes.some((q) => b.x < q.x + q.w && q.x < b.x + b.w && b.y < q.y + q.h && q.y < b.y + b.h);
    const out: Array<{ id: CityId; name: string; score: string | null; x: number; y: number; end: boolean; on: boolean }> = [];
    const order = [...points].sort((a, b) => Number(b.id === selectedId) - Number(a.id === selectedId));
    for (const p of order) {
      const [x, y] = project(p.lat, p.lon);
      const sc = showScore && layerDim ? cityScores[p.id]?.[layerDim] : undefined;
      const score = sc != null ? sc.toFixed(1) : null;
      const w = p.name.length * 10.5 + 4 + (score ? 30 : 0);
      const cands: Array<[number, number, boolean]> = [
        [x + 6, y, false],
        [x - 6 - w, y, true],
        [x + 6, y - 12, false],
        [x - 6 - w, y - 12, true],
        [x + 6, y + 12, false],
        [x - 6 - w, y + 12, true],
      ];
      let placed = false;
      for (const [bx, by, end] of cands) {
        const box = { x: bx, y: by - 8, w, h: 11 };
        if (hit(box)) continue;
        boxes.push(box);
        out.push({ id: p.id, name: p.name, score, x: end ? bx + w : bx, y: by, end, on: p.id === selectedId });
        placed = true;
        break;
      }
      if (!placed && p.id === selectedId) out.push({ id: p.id, name: p.name, score, x: x + 6, y, end: false, on: true });
    }
    return out;
  }, [points, selectedId, showScore, layerDim, cityScores]);

  const scaleW = 100 / KM_PER_UNIT;
  const showRelief = group === "relief" || group === "quake";

  /** 鼠标移到图上任意位置,读出该点的气候。 */
  const onMove = (e: ReactMouseEvent<SVGSVGElement>) => {
    const p = probeRef.current;
    const svg = svgRef.current;
    const cont = contRef.current;
    if (!p || !svg || !cont) return;
    const rect = svg.getBoundingClientRect();
    const cr = cont.getBoundingClientRect();
    const scale = Math.min(rect.width / VIEW.w, rect.height / VIEW.h);
    const ox = (rect.width - VIEW.w * scale) / 2;
    const oy = (rect.height - VIEW.h * scale) / 2;
    const vx = (e.clientX - rect.left - ox) / scale;
    const vy = (e.clientY - rect.top - oy) / scale;
    if (vx < 0 || vy < 0 || vx > VIEW.w || vy > VIEW.h) {
      setProbe(null);
      return;
    }
    const gx = Math.min(p.meta.w - 1, Math.floor(((vx / VIEW.w) * p.meta.cw) / p.meta.cell));
    const gy = Math.min(p.meta.h - 1, Math.floor(((vy / VIEW.h) * p.meta.ch) / p.meta.cell));
    const v = p.at(gx, gy);
    if (!v || !v.inMask) {
      setProbe(null);
      return;
    }
    const cx = e.clientX - cr.left;
    const cy = e.clientY - cr.top;
    setProbe({ cx, cy, flip: cx > cr.width - 190, v });
  };

  const probeLabel = layerDim ? FIELD_META[sel].label : "综合宜居";
  const probeValue = probe ? (layerDim ? probe.v[layerDim] : probe.v.cOverall) : 0;

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: C.paper }}>
      {/* 图题与专题切换 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-4 py-2" style={{ borderColor: C.line }}>
        <h2 className="text-[13px] font-semibold" style={{ color: C.label }}>
          云南 · 等值线图册
        </h2>
        <div className="flex items-center gap-2">
          {GROUPS.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => setManual(g.key === "comfort" ? null : (g.fields[0] ?? g.key))}
              className="rounded-[5px] px-2 py-0.5 text-[12px] font-medium transition-colors"
              style={group === g.key ? { background: C.label, color: C.paper } : { color: C.lineStrong }}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1" style={{ borderLeft: `1px solid ${C.line}`, paddingLeft: 10 }}>
          {GROUPS.find((g) => g.key === group)?.fields.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                // 宜居层的子项由偏好维度决定(地图与榜单共用),其余图层才需要手动记录。
                const d = COMFORT_DIM[f];
                if (d) onDim(d);
                else setManual(f);
              }}
              className="rounded-[4px] px-1.5 py-0.5 text-[11px] transition-colors"
              style={sel === f ? { background: color, color: "#fff" } : { color: C.lineStrong, border: `1px solid ${C.line}` }}
            >
              {FIELD_META[f].label}
            </button>
          ))}
        </div>

        <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[11px]" style={{ color: C.lineStrong }}>
          <input type="checkbox" checked={showElev} onChange={(e) => setShowElev(e.target.checked)} className="h-3 w-3 accent-current" />
          等高线 400 m
        </label>
      </div>

      <div ref={contRef} className="relative min-h-0 flex-1">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
          className="h-full w-full"
          preserveAspectRatio="xMidYMid meet"
          onMouseMove={onMove}
          onMouseLeave={() => setProbe(null)}
        >
          <defs>
            <clipPath id="yn-clip">
              <path d={BORDER} />
            </clipPath>
          </defs>

          {/* 省外只留很淡的地势做参照 */}
          <image
            href="/atlas/yunnan-relief.png"
            x={0}
            y={0}
            width={VIEW.w}
            height={VIEW.h}
            preserveAspectRatio="none"
            style={{ opacity: 0.15, filter: "grayscale(0.7)" }}
          />

          {/* 省内:地势层用晕渲底图,其余专题用分层设色图 */}
          <g clipPath="url(#yn-clip)">
            <image
              href={showRelief ? "/atlas/yunnan-relief.png" : `/atlas/field-${sel}.png`}
              x={0}
              y={0}
              width={VIEW.w}
              height={VIEW.h}
              preserveAspectRatio="none"
            />
          </g>

          {/* 等高线 */}
          {showElev && (
            <g clipPath="url(#yn-clip)" fill="none" stroke={C.elev} strokeLinejoin="round" strokeLinecap="round">
              {elevPaths.map((p) => (
                <path key={p.v} d={p.d} strokeWidth={p.w} strokeOpacity={p.o} />
              ))}
            </g>
          )}

          {/* 断裂带 */}
          {group === "quake" && (
            <g clipPath="url(#yn-clip)" fill="none" stroke={C.fault} strokeWidth={2.2} strokeDasharray="8 4.5" strokeLinecap="round" opacity={0.85}>
              {faultPaths.map((f) => (
                <path key={f.name} d={f.d} />
              ))}
            </g>
          )}

          {/* 专题等值线 */}
          <g clipPath="url(#yn-clip)" fill="none" stroke={color} strokeLinejoin="round" strokeLinecap="round">
            {fieldPaths.map((p) => (
              <path key={p.v} d={p.d} strokeWidth={1.9} strokeOpacity={0.95} />
            ))}
          </g>

          {/* 等值线读数 */}
          <g fontSize={9.5} fill={color} fontWeight={600} style={{ paintOrder: "stroke" }} stroke={C.paper} strokeWidth={2.8} strokeLinejoin="round">
            {fieldPaths.map((p) =>
              p.anchor ? (
                <text
                  key={p.v}
                  x={p.anchor.x}
                  y={p.anchor.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${p.anchor.ang.toFixed(1)} ${p.anchor.x} ${p.anchor.y})`}
                >
                  {p.v}
                </text>
              ) : null,
            )}
          </g>

          {/* 震中 */}
          {group === "quake" && (
            <g clipPath="url(#yn-clip)">
              {QUAKES.map((q) => {
                const [x, y] = project(q.lat, q.lon);
                const r = Math.max(2.8, (q.m - 5.2) * 3.8);
                return (
                  <g key={`${q.y}${q.place}`}>
                    <circle cx={x} cy={y} r={r} fill={C.quake} fillOpacity={0.34} stroke={C.quake} strokeWidth={1} />
                    <circle cx={x} cy={y} r={1} fill={C.quake} />
                    <title>{`${q.y} 年 ${q.place} M${q.m.toFixed(1)}`}</title>
                  </g>
                );
              })}
            </g>
          )}

          <path d={BORDER} fill="none" stroke={C.lineStrong} strokeWidth={1.4} strokeLinejoin="round" />

          {/* 城市 */}
          <g>
            {points.map((p) => {
              const [x, y] = project(p.lat, p.lon);
              const on = p.id === selectedId;
              const sc = showScore && layerDim ? cityScores[p.id]?.[layerDim] : undefined;
              const fill = sc != null ? bandColorOf(sel, sc) : C.city;
              return (
                <g key={p.id} style={{ cursor: "pointer" }} onClick={() => onSelect(p.id)}>
                  {on && <circle cx={x} cy={y} r={8} fill="none" stroke={fill} strokeWidth={1.3} opacity={0.6} />}
                  <circle cx={x} cy={y} r={on ? 4 : 2.6} fill={fill} stroke={C.paper} strokeWidth={1.2} />
                  <circle cx={x} cy={y} r={9} fill="transparent" />
                  <title>
                    {`${p.name}${sc != null ? ` · ${sc.toFixed(1)} 分` : ""} · 海拔 ${p.elevation} m`}
                  </title>
                </g>
              );
            })}
          </g>

          <g fontSize={9} style={{ paintOrder: "stroke" }} stroke={C.paper} strokeWidth={2.6} strokeLinejoin="round">
            {cityLabels.map((l) => (
              <text
                key={l.id}
                x={l.x}
                y={l.y}
                textAnchor={l.end ? "end" : "start"}
                dominantBaseline="middle"
                fontWeight={l.on ? 700 : 400}
                fill={l.on ? C.city : C.label}
                style={{ cursor: "pointer" }}
                onClick={() => onSelect(l.id)}
              >
                {l.name}
                {l.score ? <tspan fill={C.comfort} fontWeight={600}>{`  ${l.score}`}</tspan> : null}
              </text>
            ))}
          </g>
        </svg>

        {/* 探针读数:鼠标移到图上任意位置 */}
        {probe && (
          <div
            className="pointer-events-none absolute z-10 rounded-md border px-2 py-1.5 shadow-md"
            style={{
              left: probe.cx,
              top: probe.cy,
              transform: `translate(${probe.flip ? "-100%" : "12px"}, -50%)`,
              background: `${C.paper}f5`,
              borderColor: C.line,
            }}
          >
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-[16px] font-semibold" style={{ color: C.comfort }}>
                {probeValue.toFixed(0)}
              </span>
              <span className="text-[10px]" style={{ color: C.label }}>
                分 · {probeLabel}
              </span>
            </div>
            <div className="mt-0.5 whitespace-nowrap font-mono text-[9.5px]" style={{ color: C.lineStrong }}>
              海拔 {Math.round(probe.v.elev)} m · 1 月 {probe.v.tJan.toFixed(1)}℃ · 7 月 {probe.v.tJul.toFixed(1)}℃
            </div>
            <div className="mt-0.5 whitespace-nowrap font-mono text-[9.5px]" style={{ color: C.lineStrong }}>
              避暑 {probe.v.cSummer.toFixed(0)} · 避寒 {probe.v.cWinter.toFixed(0)} · 少雨 {probe.v.cDry.toFixed(0)}
            </div>
          </div>
        )}

        {/* 图例 */}
        <div
          className="absolute left-3 top-3 w-[182px] rounded-md border px-2.5 py-2 shadow-sm"
          style={{ background: `${C.paper}f2`, borderColor: C.line }}
        >
          <div className="text-[10px] font-semibold" style={{ color: C.label }}>
            图例 · {meta ? meta.label : group === "quake" ? "地震" : "地势"}
          </div>

          {/* 分层设色条 */}
          {meta && bandColors.length > 0 && (
            <div className="mt-1.5">
              <div className="flex h-3 w-full overflow-hidden rounded-[2px]" style={{ border: `1px solid ${C.line}` }}>
                {bandColors.map((c, i) => (
                  <span key={i} className="flex-1" style={{ background: c }} />
                ))}
              </div>
              <div className="relative mt-1 h-3">
                {(FIELD_LEVELS[sel] ?? []).map((v, i) => (
                  <span
                    key={v}
                    className="absolute -translate-x-1/2 font-mono text-[9px]"
                    style={{ left: `${((i + 1) / bandColors.length) * 100}%`, color: C.lineStrong }}
                  >
                    {v}
                  </span>
                ))}
              </div>
              <div className="text-right font-mono text-[9px]" style={{ color: C.lineStrong }}>
                {meta.unit}
              </div>
            </div>
          )}

          {group === "comfort" && (
            <div className="mt-1.5 flex items-center gap-1.5" style={{ color: C.lineStrong }}>
              <svg width="16" height="10" className="shrink-0">
                <circle cx="8" cy="5" r="3.4" fill={bandColorOf(sel, (FIELD_META[sel]?.min ?? 0) + (FIELD_META[sel]?.step ?? 5))} stroke={C.paper} strokeWidth="1" />
              </svg>
              <span className="text-[9.5px]">圆点与数字 = 该城本维度得分</span>
            </div>
          )}

          {group === "relief" && (
            <div className="mt-1.5">
              <div className="flex h-3 w-full overflow-hidden rounded-[2px]" style={{ border: `1px solid ${C.line}` }}>
                {RELIEF_RAMP.map((s) => (
                  <span key={s.e} className="flex-1" style={{ background: s.color }} />
                ))}
              </div>
              <div className="mt-0.5 flex justify-between font-mono text-[9px]" style={{ color: C.lineStrong }}>
                <span>0</span>
                <span>2000</span>
                <span>4000</span>
                <span>6000 m</span>
              </div>
            </div>
          )}

          {group === "quake" && (
            <ul className="mt-1.5 space-y-1">
              {[6, 7, 8].map((m) => (
                <li key={m} className="flex items-center gap-2">
                  <svg width="20" height="14" className="shrink-0">
                    <circle cx="10" cy="7" r={Math.min(6, Math.max(2.8, (m - 5.2) * 3.8))} fill={C.quake} fillOpacity={0.34} stroke={C.quake} />
                  </svg>
                  <span className="font-mono text-[9.5px]" style={{ color: C.label }}>
                    M{m}
                  </span>
                </li>
              ))}
              <li className="flex items-center gap-2">
                <svg width="20" height="10" className="shrink-0">
                  <line x1="1" y1="5" x2="19" y2="5" stroke={C.fault} strokeWidth="2.2" strokeDasharray="6 3" />
                </svg>
                <span className="text-[9.5px]" style={{ color: C.label }}>
                  断裂带(示意)
                </span>
              </li>
            </ul>
          )}

          {showElev && (
            <div className="mt-1.5 flex items-center gap-1.5 border-t pt-1.5" style={{ borderColor: C.line }}>
              <svg width="18" height="8" className="shrink-0">
                <line x1="0" y1="4" x2="18" y2="4" stroke={C.elev} strokeWidth="0.9" strokeOpacity={0.6} />
              </svg>
              <span className="text-[9.5px]" style={{ color: C.label }}>
                等高线 400 m
              </span>
            </div>
          )}

          <div className="mt-2 border-t pt-1.5" style={{ borderColor: C.line }}>
            <svg width={scaleW} height="10" className="block">
              <line x1="0" y1="4" x2={scaleW} y2="4" stroke={C.lineStrong} strokeWidth="1" />
              <line x1="0" y1="1" x2="0" y2="7" stroke={C.lineStrong} strokeWidth="1" />
              <line x1={scaleW} y1="1" x2={scaleW} y2="7" stroke={C.lineStrong} strokeWidth="1" />
            </svg>
            <div className="font-mono text-[9px]" style={{ color: C.lineStrong }}>
              0 —— 100 km
            </div>
          </div>
        </div>
      </div>

      <div className="border-t px-4 py-1.5 text-[10px] leading-relaxed" style={{ borderColor: C.line, color: C.lineStrong }}>
        {group === "comfort" ? (
          <>
            宜居度面与右侧榜单同一套模型:逐月把均温、湿度、雨日、日照、大风插值成栅格(气温按 0.65 ℃/100 m 直减率扣除地形影响),
            「&gt;30 ℃ 天数」「霜冻天数」由站点标定的单调曲线随当地气温反推,再逐像元合成 0–100 分。移动鼠标可读出任意位置的读数。
          </>
        ) : (
          <>
            等温线由 {points.length} 个站点的 1995–2024 年月均温插值,并按气温直减率扣除地形趋势的影响;等降水线用 2023–2025 年逐月降水(ERA5)插值,
            口径比多年均值偏湿;人口为 16 个州市驻地 2020 年人口规模的插值。断裂带为示意走向,不作防灾依据。
          </>
        )}
      </div>
    </div>
  );
}
