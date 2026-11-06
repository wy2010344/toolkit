/**
 * 多省等值线图册。
 *
 * 不按行政区划着色,而是把「数据的界线」画出来:等高线、等温线、等降水线、人口等值线、
 * 断裂带与历史震中(仅云南),以及最重要的一层——**连续宜居度面**。
 *
 * 宜居度不是孤立的城市分数,而是被铺到整幅省域的栅格上:逐月把气象要素插值成面,
 * 气温按直减率扣除地形影响,高温日与霜冻日由站点标定的单调曲线随气温反推,
 * 再用与榜单完全相同的 comfortOf() 逐像元合成 0–100 分,画成等值线 + 分层设色。
 * 于是「哪里适合住」变成一条条可以读数的线,鼠标移到任意位置还能即时读出该点的分项。
 *
 * 底图与等值线全部由 scripts/build-atlas.mjs 预生成,每省一套,断网可用。
 */
"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { AtlasModule, AtlasProvince } from "@/lib/climate/atlas";
import { ATLAS_PROVINCES, loadAtlasData } from "@/lib/climate/atlas";
import { FAULTS, QUAKES } from "@/lib/climate/atlas/faults";
import { loadProbe, type Probe } from "@/lib/climate/atlas/probe";
import { scoreAll, DIMENSIONS, type DimKey } from "@/lib/climate/score";
import type { CityId } from "@/lib/climate/types";
import type { MapPoint } from "./MapIndex";
import { AtlasCombined } from "./AtlasCombined";
import {
  C,
  COMFORT_DIM,
  DIM_FIELD,
  GROUPS,
  GROUP_COLOR,
  anchorOf,
  bandColorOf,
  isMajor,
  makeProject,
  segPath,
  type ProbeRead,
} from "./atlasShared";

export function Atlas({
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
  /** 视图模式:五省拼合,或聚焦某省。默认拼合,方便横向比较。 */
  const [mode, setMode] = useState<"all" | AtlasProvince>("all");
  /** 已加载的单省数据;与当前模式不一致时视为加载中,避免短暂串图。 */
  const [loaded, setLoaded] = useState<{ key: AtlasProvince; mod: AtlasModule } | null>(null);
  /** 拼合视图需要的五省数据。 */
  const [allMods, setAllMods] = useState<AtlasModule[] | null>(null);

  /**
   * 手动选中的图层;null 表示跟随偏好维度(宜居层)。
   * 宜居层不另存状态,直接由 dim 推导:偏好一改,地图与榜单立刻同步,不会出现两边不一致的中间帧。
   */
  const [manual, setManual] = useState<string | null>(null);
  /** 物价 / 安全 / 便利没有等值面,此时仍停在综合宜居层。 */
  const sel = manual ?? DIM_FIELD[dim] ?? "cOverall";
  /** 偏好维度没有对应等值面时,在图题旁说明当前图册仍画气候面。 */
  const noRaster = manual === null && DIM_FIELD[dim] === undefined;
  const dimLabel = DIMENSIONS.find((d) => d.key === dim)?.label ?? "";
  const [showElev, setShowElev] = useState(true);
  const [probe, setProbe] = useState<ProbeRead | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const contRef = useRef<HTMLDivElement | null>(null);
  const probeRef = useRef<Probe | null>(null);

  // 单省数据按需加载;拼合视图才把五份一起取下来。
  useEffect(() => {
    if (mode === "all") return;
    let alive = true;
    probeRef.current = null;
    loadAtlasData(mode)
      .then((m) => {
        if (alive) setLoaded({ key: mode, mod: m });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== "all" || allMods) return;
    let alive = true;
    Promise.all(ATLAS_PROVINCES.map((p) => loadAtlasData(p.key)))
      .then((ms) => {
        if (alive) setAllMods(ms);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [mode, allMods]);

  const atlas = mode !== "all" && loaded && loaded.key === mode ? loaded.mod : null;

  // 探针数据随省切换,单独取,不影响首屏。
  useEffect(() => {
    if (!atlas) return;
    let alive = true;
    const url = atlas.ASSETS.probe;
    loadProbe(url)
      .then((p) => {
        if (!alive) return;
        probeRef.current = p;
        setProbe(null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [atlas]);

  const project = useMemo(() => (atlas ? makeProject(atlas.PROJ) : null), [atlas]);
  const view = atlas?.VIEW ?? { w: 900, h: 900 };
  /** 单省或拼合(取第一省)的元信息源;两省色阶已统一,元信息只需要一份。 */
  const refAtlas = mode === "all" ? (allMods?.[0] ?? null) : atlas;
  const group = sel === "quake" || sel === "relief" ? sel : (refAtlas?.FIELD_META[sel]?.group ?? "comfort");
  const meta = sel === "quake" || sel === "relief" ? null : (refAtlas?.FIELD_META[sel] ?? null);
  const color = GROUP_COLOR[group] ?? C.comfort;
  const activeLines = useMemo(
    () => (refAtlas && refAtlas.FIELD_META[sel] ? (refAtlas.FIELD_LINES[sel] ?? []) : []),
    [refAtlas, sel],
  );
  const bandColors = meta ? (refAtlas?.BAND_COLORS[sel] ?? []) : [];
  const hasQuakes = mode === "all" ? (allMods?.some((m) => m.HAS_QUAKES) ?? false) : (atlas?.HAS_QUAKES ?? false);
  const groups = useMemo(() => GROUPS.filter((g) => g.key !== "quake" || hasQuakes), [hasQuakes]);

  const cityScores = useMemo(() => {
    const m: Partial<Record<CityId, Partial<Record<DimKey, number>>>> = {};
    for (const s of scoreAll())
      m[s.id] = { overall: s.overall, summer: s.summer, winter: s.winter, sunny: s.sunny, dry: s.dry, calm: s.calm };
    return m;
  }, []);

  /** 图册只标注本省城市,避免邻省点位把版面挤满。 */
  const provincePoints = useMemo(() => (atlas ? points.filter((p) => p.region === atlas.NAME) : []), [points, atlas]);

  /** 当前图层对应的评分维度(非宜居图层为 undefined)。 */
  const layerDim = COMFORT_DIM[sel];
  const showScore = layerDim != null;

  const elevPaths = useMemo(
    () =>
      (atlas?.CONTOURS ?? []).map((l) => ({
        v: l.v,
        d: segPath(l.segs),
        w: isMajor(l.v) ? 0.8 : 0.45,
        o: isMajor(l.v) ? 0.66 : 0.4,
      })),
    [atlas],
  );

  const fieldPaths = useMemo(
    () => activeLines.map((l) => ({ v: l.v, d: segPath(l.segs), anchor: anchorOf(l.segs) })),
    [activeLines],
  );

  const faultPaths = useMemo(
    () =>
      atlas?.HAS_QUAKES && project
        ? FAULTS.map((f) => ({
            name: f.name,
            d: f.pts
              .map(([lon, lat]) => project(lat, lon))
              .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`)
              .join(""),
          }))
        : [],
    [atlas, project],
  );

  /** 城市标注:贪心避让,放不下就不标;选中的城市优先。 */
  const cityLabels = useMemo(() => {
    if (!project) return [];
    const boxes: Array<{ x: number; y: number; w: number; h: number }> = [];
    const hit = (b: { x: number; y: number; w: number; h: number }) =>
      boxes.some((q) => b.x < q.x + q.w && q.x < b.x + b.w && b.y < q.y + q.h && q.y < b.y + b.h);
    const out: Array<{ id: CityId; name: string; score: string | null; x: number; y: number; end: boolean; on: boolean }> = [];
    for (const p of provincePoints) {
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
  }, [provincePoints, selectedId, showScore, layerDim, cityScores, project]);

  const scaleW = atlas ? (100 * atlas.PROJ.s) / 6371 : 0;
  const showRelief = group === "relief" || group === "quake";
  const clipId = `atlas-clip-${atlas?.KEY ?? "loading"}`;

  /** 鼠标移到图上任意位置,读出该点的气候。 */
  const onMove = (e: ReactMouseEvent<SVGSVGElement>) => {
    const p = probeRef.current;
    const svg = svgRef.current;
    const cont = contRef.current;
    if (!p || !svg || !cont || !project) return;
    const rect = svg.getBoundingClientRect();
    const cr = cont.getBoundingClientRect();
    const scale = Math.min(rect.width / view.w, rect.height / view.h);
    const ox = (rect.width - view.w * scale) / 2;
    const oy = (rect.height - view.h * scale) / 2;
    const vx = (e.clientX - rect.left - ox) / scale;
    const vy = (e.clientY - rect.top - oy) / scale;
    if (vx < 0 || vy < 0 || vx > view.w || vy > view.h) {
      setProbe(null);
      return;
    }
    const gx = Math.min(p.meta.w - 1, Math.floor(((vx / view.w) * p.meta.cw) / p.meta.cell));
    const gy = Math.min(p.meta.h - 1, Math.floor(((vy / view.h) * p.meta.ch) / p.meta.cell));
    const v = p.at(gx, gy);
    if (!v || !v.inMask) {
      setProbe(null);
      return;
    }
    const cx = e.clientX - cr.left;
    const cy = e.clientY - cr.top;
    setProbe({ cx, cy, flip: cx > cr.width - 190, v });
  };

  const probeLabel = layerDim ? (atlas?.FIELD_META[sel]?.label ?? "") : "综合宜居";
  /**
   * 探针二进制里存的是 cOverall / cSummer 这类字段键,而 layerDim 是评分模型的维度键
   * (overall / summer ...),两者不是一套命名,直接用 layerDim 索引会拿到 undefined。
   * 所以当前图层直接按 sel(字段键)取;非宜居图层再回落到综合分。
   */
  const probeValue = probe ? (probe.v[sel] ?? probe.v.cOverall ?? 0) : 0;

  if (mode === "all" ? !allMods : !atlas || !project) {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: C.paper, color: C.lineStrong }}>
        <span className="text-[12px]">图册加载中…</span>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: C.paper }}>
      {/* 图题与专题切换 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-4 py-2" style={{ borderColor: C.line }}>
        <h2 className="text-[13px] font-semibold" style={{ color: C.label }}>
          {mode === "all" ? "五省 · 等值线拼合图册" : `${atlas!.NAME} · 等值线图册`}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMode("all")}
            className="rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium transition-colors"
            style={mode === "all" ? { background: C.lineStrong, color: C.paper } : { color: C.lineStrong }}
          >
            五省拼合
          </button>
          {ATLAS_PROVINCES.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setMode(p.key)}
              className="rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium transition-colors"
              style={p.key === mode ? { background: C.lineStrong, color: C.paper } : { color: C.lineStrong }}
            >
              {p.name}
            </button>
          ))}
        </div>
        {noRaster && (
          <span className="text-[10.5px] leading-tight" style={{ color: C.lineStrong }}>
            「{dimLabel}」无等值面,图册仍显示综合宜居
          </span>
        )}
        <div className="flex items-center gap-2">
          {groups.map((g) => (
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
          {groups.find((g) => g.key === group)?.fields.map((f) => (
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
              {refAtlas?.FIELD_META[f]?.label ?? f}
            </button>
          ))}
        </div>

        <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[11px]" style={{ color: C.lineStrong }}>
          <input type="checkbox" checked={showElev} onChange={(e) => setShowElev(e.target.checked)} className="h-3 w-3 accent-current" />
          等高线 400 m
        </label>
      </div>

      {mode === "all" && allMods ? (
        <AtlasCombined
          mods={allMods}
          points={points}
          selectedId={selectedId}
          onSelect={onSelect}
          sel={sel}
          group={group}
          showElev={showElev}
          cityScores={cityScores}
        />
      ) : atlas && project ? (
      <div ref={contRef} className="relative min-h-0 flex-1">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${view.w} ${view.h}`}
          className="h-full w-full"
          preserveAspectRatio="xMidYMid meet"
          onMouseMove={onMove}
          onMouseLeave={() => setProbe(null)}
        >
          <defs>
            <clipPath id={clipId}>
              <path d={atlas.BORDER} />
            </clipPath>
          </defs>

          {/* 省外只留很淡的地势做参照 */}
          <image
            href={atlas.ASSETS.relief}
            x={0}
            y={0}
            width={view.w}
            height={view.h}
            preserveAspectRatio="none"
            style={{ opacity: 0.15, filter: "grayscale(0.7)" }}
          />

          {/* 省内:地势层用晕渲底图,其余专题用分层设色图 */}
          <g clipPath={`url(#${clipId})`}>
            <image
              href={showRelief ? atlas.ASSETS.relief : atlas.ASSETS.field(sel)}
              x={0}
              y={0}
              width={view.w}
              height={view.h}
              preserveAspectRatio="none"
            />
          </g>

          {/* 等高线 */}
          {showElev && (
            <g clipPath={`url(#${clipId})`} fill="none" stroke={C.elev} strokeLinejoin="round" strokeLinecap="round">
              {elevPaths.map((p) => (
                <path key={p.v} d={p.d} strokeWidth={p.w} strokeOpacity={p.o} />
              ))}
            </g>
          )}

          {/* 断裂带 */}
          {group === "quake" && (
            <g clipPath={`url(#${clipId})`} fill="none" stroke={C.fault} strokeWidth={2.2} strokeDasharray="8 4.5" strokeLinecap="round" opacity={0.85}>
              {faultPaths.map((f) => (
                <path key={f.name} d={f.d} />
              ))}
            </g>
          )}

          {/* 专题等值线 */}
          <g clipPath={`url(#${clipId})`} fill="none" stroke={color} strokeLinejoin="round" strokeLinecap="round">
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
            <g clipPath={`url(#${clipId})`}>
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

          <path d={atlas.BORDER} fill="none" stroke={C.lineStrong} strokeWidth={1.4} strokeLinejoin="round" />

          {/* 城市 */}
          <g>
            {provincePoints.map((p) => {
              const [x, y] = project(p.lat, p.lon);
              const on = p.id === selectedId;
              const sc = showScore && layerDim ? cityScores[p.id]?.[layerDim] : undefined;
              const fill = sc != null ? bandColorOf(atlas, sel, sc) : C.city;
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
                {(atlas.FIELD_LEVELS[sel] ?? []).map((v, i) => (
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
                <circle cx="8" cy="5" r="3.4" fill={bandColorOf(atlas, sel, (atlas.FIELD_META[sel]?.min ?? 0) + (atlas.FIELD_META[sel]?.step ?? 5))} stroke={C.paper} strokeWidth="1" />
              </svg>
              <span className="text-[9.5px]">圆点与数字 = 该城本维度得分</span>
            </div>
          )}

          {group === "relief" && (
            <div className="mt-1.5">
              <div className="flex h-3 w-full overflow-hidden rounded-[2px]" style={{ border: `1px solid ${C.line}` }}>
                {atlas.RELIEF_RAMP.map((s) => (
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
      ) : null}

      <div className="border-t px-4 py-1.5 text-[10px] leading-relaxed" style={{ borderColor: C.line, color: C.lineStrong }}>
        {group === "comfort" ? (
          <>
            {mode === "all" ? "五省拼合图共用同一套宜居模型与同一套色阶," : ""}
            宜居度面与右侧榜单同一套模型:逐月把均温、湿度、雨日、日照、大风插值成栅格(气温按 0.65 ℃/100 m 直减率扣除地形影响),
            「&gt;30 ℃ 天数」「霜冻天数」由站点标定的单调曲线随当地气温反推,再逐像元合成 0–100 分。移动鼠标可读出任意位置的读数。
          </>
        ) : (
          <>
            等温线由 {refAtlas?.STATION_COUNT} 个站点的 1995–2024 年月均温插值,并按气温直减率扣除地形趋势的影响;等降水线用 2023–2025 年逐月降水(ERA5)插值,
            口径比多年均值偏湿;人口为 {refAtlas?.PREFECTURE_COUNT} 个州市驻地 2020 年人口规模的插值。
            {refAtlas?.HAS_QUAKES ? "断裂带为示意走向,不作防灾依据。" : ""}
          </>
        )}
      </div>
    </div>
  );
}
