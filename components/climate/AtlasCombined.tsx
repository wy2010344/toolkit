/**
 * 五省拼合视图。
 *
 * 五省图册原本各自装进 900×900 的 viewBox,比例尺各不相同,没法直接并排比较。
 * 这里把每省的局部坐标都换算回同一套阿尔伯斯投影坐标(反映真实相对大小与地理位置),
 * 再把底图、等值线、城市点按同一个仿射变换铺进一张大图。
 * 专题色阶在生成时已按五省统一,所以同一颜色在任何省都代表同一个数值。
 */
"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { AtlasModule } from "@/lib/climate/atlas";
import { FAULTS, QUAKES } from "@/lib/climate/atlas/faults";
import { loadProbe, type Probe } from "@/lib/climate/atlas/probe";
import { HUM_COMFORT_BAND } from "@/lib/climate/env";
import type { DimKey } from "@/lib/climate/score";
import type { CityId } from "@/lib/climate/types";
import type { MapPoint } from "./MapIndex";
import {
  C,
  GROUP_COLOR,
  COMFORT_DIM,
  bandColorOf,
  isMajor,
  makeProject,
  segPath,
  type ProbeRead,
} from "./atlasShared";

/** 拼合图的基准比例尺(取云南的 PROJ.s);其余省按 s 的比值缩放,保证相对大小真实。 */
const BASE_S = 6056.208705352513;

interface Frame {
  m: AtlasModule;
  /** 局部坐标 → 公共坐标的缩放。 */
  k: number;
  x: number;
  y: number;
  size: number;
}

export function AtlasCombined({
  mods,
  points,
  selectedId,
  onSelect,
  sel,
  group,
  showElev,
  cityScores,
}: {
  mods: AtlasModule[];
  points: MapPoint[];
  selectedId: CityId;
  onSelect: (id: CityId) => void;
  sel: string;
  group: string;
  showElev: boolean;
  cityScores: Partial<Record<CityId, Partial<Record<DimKey, number>>>>;
}) {
  const layout = useMemo(() => {
    const raw = mods.map((m) => {
      const k = BASE_S / m.PROJ.s;
      return { m, k, x: -k * m.PROJ.tx, y: -k * m.PROJ.ty, size: m.VIEW.w * k };
    });
    const minX = Math.min(...raw.map((f) => f.x));
    const minY = Math.min(...raw.map((f) => f.y));
    const maxX = Math.max(...raw.map((f) => f.x + f.size));
    const maxY = Math.max(...raw.map((f) => f.y + f.size));
    return {
      frames: raw.map((f) => ({ ...f, x: f.x - minX, y: f.y - minY })) as Frame[],
      view: { w: maxX - minX, h: maxY - minY },
    };
  }, [mods]);

  const { frames, view } = layout;

  const projects = useMemo(() => {
    const out: Record<string, (lat: number, lon: number) => [number, number]> = {};
    for (const f of frames) {
      const local = makeProject(f.m.PROJ);
      out[f.m.KEY] = (lat, lon) => {
        const [x, y] = local(lat, lon);
        return [x * f.k + f.x, y * f.k + f.y];
      };
    }
    return out;
  }, [frames]);

  const [probe, setProbe] = useState<ProbeRead | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const contRef = useRef<HTMLDivElement | null>(null);
  const probesRef = useRef<Record<string, Probe>>({});

  // 五省的探针都取下来,鼠标落在哪一省就用哪一份。
  useEffect(() => {
    let alive = true;
    Promise.all(
      frames.map((f) =>
        loadProbe(f.m.ASSETS.probe)
          .then((p) => [f.m.KEY, p] as const)
          .catch(() => null),
      ),
    ).then((list) => {
      if (!alive) return;
      const m: Record<string, Probe> = {};
      for (const e of list) if (e) m[e[0]] = e[1];
      probesRef.current = m;
      setProbe(null);
    });
    return () => {
      alive = false;
    };
  }, [frames]);

  const groupColor = GROUP_COLOR[group] ?? C.comfort;
  const activeMeta = sel === "quake" || sel === "relief" ? null : frames[0]?.m.FIELD_META[sel] ?? null;
  const showRelief = group === "relief" || group === "quake";

  const elevPaths = useMemo(
    () =>
      frames.map((f) => ({
        key: f.m.KEY,
        transform: `translate(${f.x} ${f.y}) scale(${f.k})`,
        clip: `atlas-all-clip-${f.m.KEY}`,
        paths: (f.m.CONTOURS ?? []).map((l) => ({
          v: l.v,
          d: segPath(l.segs),
          w: isMajor(l.v) ? 0.8 : 0.45,
          o: isMajor(l.v) ? 0.66 : 0.4,
        })),
      })),
    [frames],
  );

  const fieldPaths = useMemo(
    () =>
      frames.map((f) => ({
        key: f.m.KEY,
        transform: `translate(${f.x} ${f.y}) scale(${f.k})`,
        clip: `atlas-all-clip-${f.m.KEY}`,
        paths: (f.m.FIELD_LINES[sel] ?? []).map((l) => ({ v: l.v, d: segPath(l.segs) })),
      })),
    [frames, sel],
  );

  const allPoints = useMemo(
    () => frames.flatMap((f) => points.filter((p) => p.region === f.m.NAME).map((p) => ({ p, key: f.m.KEY }))),
    [frames, points],
  );

  const showScore = COMFORT_DIM[sel] != null;
  const layerDim = COMFORT_DIM[sel];

  /** 城市标注:贪心避让,选中的城市优先。 */
  const cityLabels = useMemo(() => {
    const boxes: Array<{ x: number; y: number; w: number; h: number }> = [];
    const hit = (b: { x: number; y: number; w: number; h: number }) =>
      boxes.some((q) => b.x < q.x + q.w && q.x < b.x + b.w && b.y < q.y + q.h && q.y < b.y + b.h);
    const out: Array<{ id: CityId; name: string; score: string | null; x: number; y: number; end: boolean; on: boolean }> = [];
    for (const { p, key } of allPoints) {
      const project = projects[key];
      if (!project) continue;
      const [x, y] = project(p.lat, p.lon);
      const sc = showScore && layerDim ? cityScores[p.id]?.[layerDim] : undefined;
      const score = sc != null ? sc.toFixed(1) : null;
      const w = p.name.length * 9.5 + 4 + (score ? 27 : 0);
      const cands: Array<[number, number, boolean]> = [
        [x + 5, y, false],
        [x - 5 - w, y, true],
        [x + 5, y - 11, false],
        [x - 5 - w, y - 11, true],
        [x + 5, y + 11, false],
        [x - 5 - w, y + 11, true],
      ];
      let placed = false;
      for (const [bx, by, end] of cands) {
        const box = { x: bx, y: by - 7, w, h: 10 };
        if (hit(box)) continue;
        boxes.push(box);
        out.push({ id: p.id, name: p.name, score, x: end ? bx + w : bx, y: by, end, on: p.id === selectedId });
        placed = true;
        break;
      }
      if (!placed && p.id === selectedId) out.push({ id: p.id, name: p.name, score, x: x + 5, y, end: false, on: true });
    }
    return out;
  }, [allPoints, projects, selectedId, showScore, layerDim, cityScores]);

  /** 鼠标移到拼合图上任意位置,先判断落在哪一省,再读该省探针。 */
  const onMove = (e: ReactMouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    const cont = contRef.current;
    if (!svg || !cont) return;
    const rect = svg.getBoundingClientRect();
    const scale = Math.min(rect.width / view.w, rect.height / view.h);
    const ox = (rect.width - view.w * scale) / 2;
    const oy = (rect.height - view.h * scale) / 2;
    const vx = (e.clientX - rect.left - ox) / scale;
    const vy = (e.clientY - rect.top - oy) / scale;
    if (vx < 0 || vy < 0 || vx > view.w || vy > view.h) {
      setProbe(null);
      return;
    }
    for (const f of frames) {
      const lx = (vx - f.x) / f.k;
      const ly = (vy - f.y) / f.k;
      if (lx < 0 || ly < 0 || lx > f.m.VIEW.w || ly > f.m.VIEW.h) continue;
      const p = probesRef.current[f.m.KEY];
      if (!p) continue;
      const gx = Math.min(p.meta.w - 1, Math.floor(((lx / f.m.VIEW.w) * p.meta.cw) / p.meta.cell));
      const gy = Math.min(p.meta.h - 1, Math.floor(((ly / f.m.VIEW.h) * p.meta.ch) / p.meta.cell));
      const v = p.at(gx, gy);
      if (!v || !v.inMask) {
        setProbe(null);
        return;
      }
      const cx = e.clientX - cont.getBoundingClientRect().left;
      const cy = e.clientY - cont.getBoundingClientRect().top;
      setProbe({ cx, cy, flip: cx > cont.getBoundingClientRect().width - 190, v });
      return;
    }
    setProbe(null);
  };

  /** 当前专题在探针里有值就用它自己的单位 / 标签,否则回落到综合宜居分。 */
  const hasFieldValue = probe ? probe.v[sel] !== undefined : false;
  const probeValue = probe ? (hasFieldValue ? probe.v[sel] : (probe.v.cOverall ?? 0)) : 0;
  const probeLabel = hasFieldValue ? (activeMeta?.label ?? "综合宜居") : "综合宜居";
  const probeUnit = hasFieldValue ? (activeMeta?.unit ?? "分") : "分";
  const probeDecimals = probeUnit === "℃" ? 1 : 0;

  const levels = frames[0]?.m.FIELD_LEVELS[sel] ?? [];
  const bands = frames[0]?.m.BAND_COLORS[sel] ?? [];
  const scaleW = (100 * BASE_S) / 6371;

  return (
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
          {frames.map((f) => (
            <clipPath key={f.m.KEY} id={`atlas-all-clip-${f.m.KEY}`}>
              <path d={f.m.BORDER} transform={`translate(${f.x} ${f.y}) scale(${f.k})`} />
            </clipPath>
          ))}
        </defs>

        {/* 底图:地势层用晕渲底图,其余专题用分层设色图 */}
        {frames.map((f) => (
          <g key={f.m.KEY} clipPath={`url(#atlas-all-clip-${f.m.KEY})`}>
            <image
              href={showRelief ? f.m.ASSETS.relief : f.m.ASSETS.field(sel)}
              x={0}
              y={0}
              width={f.m.VIEW.w}
              height={f.m.VIEW.h}
              preserveAspectRatio="none"
              transform={`translate(${f.x} ${f.y}) scale(${f.k})`}
            />
          </g>
        ))}

        {/* 等高线 */}
        {showElev && (
          <g fill="none" stroke={C.elev} strokeLinejoin="round" strokeLinecap="round">
            {elevPaths.map((g) => (
              <g key={g.key} clipPath={`url(#${g.clip})`} transform={g.transform}>
                {g.paths.map((p) => (
                  <path key={p.v} d={p.d} strokeWidth={p.w} strokeOpacity={p.o} />
                ))}
              </g>
            ))}
          </g>
        )}

        {/* 断裂带(仅云南有数据) */}
        {group === "quake" &&
          frames
            .filter((f) => f.m.HAS_QUAKES)
            .map((f) => {
              const project = projects[f.m.KEY];
              return (
                <g key={f.m.KEY} clipPath={`url(#atlas-all-clip-${f.m.KEY})`}>
                  <g fill="none" stroke={C.fault} strokeWidth={2.2 * f.k} strokeDasharray="8 4.5" strokeLinecap="round" opacity={0.85}>
                    {FAULTS.map((fa) => (
                      <path key={fa.name} d={fa.pts.map(([lon, lat]) => project(lat, lon)).map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("")} />
                    ))}
                  </g>
                </g>
              );
            })}

        {/* 专题等值线 */}
        <g fill="none" stroke={groupColor} strokeLinejoin="round" strokeLinecap="round">
          {fieldPaths.map((g) => (
            <g key={g.key} clipPath={`url(#${g.clip})`} transform={g.transform}>
              {g.paths.map((p) => (
                <path key={p.v} d={p.d} strokeWidth={1.9} strokeOpacity={0.92} />
              ))}
            </g>
          ))}
        </g>

        {/* 震中(仅云南) */}
        {group === "quake" &&
          frames
            .filter((f) => f.m.HAS_QUAKES)
            .map((f) => {
              const project = projects[f.m.KEY];
              return (
                <g key={f.m.KEY} clipPath={`url(#atlas-all-clip-${f.m.KEY})`}>
                  {QUAKES.map((q) => {
                    const [x, y] = project(q.lat, q.lon);
                    const r = Math.max(2.8, (q.m - 5.2) * 3.8) * f.k;
                    return (
                      <g key={`${q.y}${q.place}`}>
                        <circle cx={x} cy={y} r={r} fill={C.quake} fillOpacity={0.34} stroke={C.quake} strokeWidth={1} />
                        <circle cx={x} cy={y} r={1.4} fill={C.quake} />
                        <title>{`${q.y} 年 ${q.place} M${q.m.toFixed(1)}`}</title>
                      </g>
                    );
                  })}
                </g>
              );
            })}

        {/* 省界 */}
        {frames.map((f) => (
          <path
            key={f.m.KEY}
            d={f.m.BORDER}
            transform={`translate(${f.x} ${f.y}) scale(${f.k})`}
            fill="none"
            stroke={C.lineStrong}
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
        ))}

        {/* 省名 */}
        <g fontSize={13} fontWeight={600} letterSpacing="0.18em" fill={C.lineStrong} opacity={0.5} style={{ paintOrder: "stroke" }} stroke={C.paper} strokeWidth={2.4}>
          {frames.map((f) => {
            const nums = f.m.BORDER.match(/[-+]?\d*\.?\d+/g) ?? [];
            let sx = 0;
            let sy = 0;
            let n = 0;
            for (let i = 0; i + 1 < nums.length; i += 2) {
              sx += Number(nums[i]);
              sy += Number(nums[i + 1]);
              n++;
            }
            if (!n) return null;
            return (
              <text key={f.m.KEY} x={f.x + (sx / n) * f.k} y={f.y + (sy / n) * f.k} textAnchor="middle" dominantBaseline="middle">
                {f.m.NAME}
              </text>
            );
          })}
        </g>

        {/* 城市 */}
        <g>
          {allPoints.map(({ p, key }) => {
            const project = projects[key];
            if (!project) return null;
            const [x, y] = project(p.lat, p.lon);
            const on = p.id === selectedId;
            const sc = showScore && layerDim ? cityScores[p.id]?.[layerDim] : undefined;
            const fill = sc != null ? bandColorOf(frames.find((f) => f.m.KEY === key)?.m ?? null, sel, sc) : C.city;
            return (
              <g key={p.id} style={{ cursor: "pointer" }} onClick={() => onSelect(p.id)}>
                {on && <circle cx={x} cy={y} r={9} fill="none" stroke={fill} strokeWidth={1.4} opacity={0.65} />}
                <circle cx={x} cy={y} r={on ? 4 : 2.8} fill={fill} stroke={C.paper} strokeWidth={1.2} />
                <circle cx={x} cy={y} r={9} fill="transparent" />
                <title>{`${p.name}${sc != null ? ` · ${sc.toFixed(1)} 分` : ""} · 海拔 ${p.elevation} m`}</title>
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

      {/* 探针读数 */}
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
            <span className="font-mono text-[16px] font-semibold" style={{ color: groupColor }}>
              {probeValue.toFixed(probeDecimals)}
            </span>
            <span className="text-[10px]" style={{ color: C.label }}>
              {probeUnit} · {probeLabel}
            </span>
          </div>
          <div className="mt-0.5 whitespace-nowrap font-mono text-[9.5px]" style={{ color: C.lineStrong }}>
            海拔 {Math.round(probe.v.elev)} m · 1 月 {probe.v.tJan.toFixed(1)}℃ · 7 月 {probe.v.tJul.toFixed(1)}℃
          </div>
          <div className="mt-0.5 whitespace-nowrap font-mono text-[9.5px]" style={{ color: C.lineStrong }}>
            避暑 {probe.v.cSummer.toFixed(0)} · 避寒 {probe.v.cWinter.toFixed(0)} · 少雨 {probe.v.cDry.toFixed(0)}
          </div>
          {probe.v.hYear !== undefined && (
            <div className="mt-0.5 whitespace-nowrap font-mono text-[9.5px]" style={{ color: C.hum }}>
              湿度 年 {Math.round(probe.v.hYear)}% · 雨季 {Math.round(probe.v.hWet ?? 0)}% · 干季 {Math.round(probe.v.hDry ?? 0)}%
            </div>
          )}
        </div>
      )}

      {/* 图例(五省共用一套色阶) */}
      <div
        className="absolute left-3 top-3 w-[196px] rounded-md border px-2.5 py-2 shadow-sm"
        style={{ background: `${C.paper}f2`, borderColor: C.line }}
      >
        <div className="text-[10px] font-semibold" style={{ color: C.label }}>
          图例 · {activeMeta ? activeMeta.label : group === "quake" ? "地震" : "地势"}
        </div>

        {activeMeta && bands.length > 0 && (
          <div className="mt-1.5">
            <div className="flex h-3 w-full overflow-hidden rounded-[2px]" style={{ border: `1px solid ${C.line}` }}>
              {bands.map((c, i) => (
                <span key={i} className="flex-1" style={{ background: c }} />
              ))}
            </div>
            <div className="mt-0.5 flex justify-between font-mono text-[9px]" style={{ color: C.lineStrong }}>
              <span>{levels[0]}</span>
              <span>{levels[levels.length - 1]}</span>
            </div>
            <div className="text-right font-mono text-[9px]" style={{ color: C.lineStrong }}>
              {activeMeta.unit}
            </div>
          </div>
        )}

        {group === "comfort" && (
          <div className="mt-1.5 flex items-center gap-1.5" style={{ color: C.lineStrong }}>
            <svg width="16" height="10" className="shrink-0">
              <circle cx="8" cy="5" r="3.4" fill={C.comfort} stroke={C.paper} strokeWidth="1" />
            </svg>
            <span className="text-[9.5px]">圆点与数字 = 该城本维度得分</span>
          </div>
        )}

        {group === "hum" && (
          <div className="mt-1.5 text-[9.5px] leading-tight" style={{ color: C.lineStrong }}>
            {HUM_COMFORT_BAND[0]}–{HUM_COMFORT_BAND[1]}% 为舒适度模型的最佳湿度区间
          </div>
        )}

        {group === "relief" && (
          <div className="mt-1.5">
            <div className="flex h-3 w-full overflow-hidden rounded-[2px]" style={{ border: `1px solid ${C.line}` }}>
              {frames[0]?.m.RELIEF_RAMP.map((s) => (
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
                断裂带(示意,仅云南)
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
  );
}
