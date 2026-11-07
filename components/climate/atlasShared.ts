/**
 * 图册单省视图与拼合视图共用的配色、投影与图层定义。
 */
import type { AtlasModule } from "@/lib/climate/atlas";
import type { DimKey } from "@/lib/climate/score";

/* ─────────────────────────── 配色 ─────────────────────────── */

export const C = {
  paper: "#f8f4ea",
  line: "#a2937a",
  lineStrong: "#6f6047",
  label: "#40382b",
  city: "#9f2f2d",
  elev: "#7d6b4e",
  temp: "#8f2f1f",
  rain: "#1f4e79",
  hum: "#2f6f96",
  pop: "#573c70",
  quake: "#b4452f",
  fault: "#a83b22",
  comfort: "#3f7f55",
};

export const GROUP_COLOR: Record<string, string> = {
  comfort: C.comfort,
  temp: C.temp,
  rain: C.rain,
  hum: C.hum,
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

/** 按各省的 PROJ 参数构造投影函数(投影本体固定,只是缩放/平移不同)。 */
export function makeProject(proj: { s: number; tx: number; ty: number }) {
  return (lat: number, lon: number): [number, number] => {
    const theta = NN * (lon * D2R - L0);
    const rho = Math.sqrt(CC - 2 * NN * Math.sin(lat * D2R)) / NN;
    return [rho * Math.sin(theta) * proj.s + proj.tx, proj.ty - (RHO0 - rho * Math.cos(theta)) * proj.s];
  };
}

/* ─────────────────────────── 小工具 ─────────────────────────── */

export function segPath(segs: number[][]): string {
  let d = "";
  for (const s of segs) {
    d += `M${s[0]} ${s[1]}`;
    for (let i = 2; i < s.length; i += 2) d += `L${s[i]} ${s[i + 1]}`;
  }
  return d;
}

/** 在最长的一条折线上取标注点,角度顺着线的走向。 */
export function anchorOf(segs: number[][]) {
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

/** 把一个数值落到对应色带上(与 PNG 里分档涂色的算法一致)。 */
export function bandColorOf(atlas: AtlasModule | null, fieldKey: string, v: number): string {
  if (!atlas) return C.city;
  const levels = atlas.FIELD_LEVELS[fieldKey] ?? [];
  const bands = atlas.BAND_COLORS[fieldKey] ?? [];
  if (!bands.length) return C.city;
  let b = 0;
  while (b < levels.length && v >= levels[b]) b++;
  return bands[Math.min(b, bands.length - 1)];
}

/* ─────────────────────────── 图层 ─────────────────────────── */

/** 宜居度排在最前:这是整个工具要回答的问题,其余图层都是它的佐证。 */
export const GROUPS = [
  { key: "comfort", label: "宜居", fields: ["cOverall", "cSummer", "cWinter", "cSunny", "cDry", "cCalm"] },
  { key: "temp", label: "气温", fields: ["tJan", "tJul", "tYear"] },
  { key: "rain", label: "降水", fields: ["pYear", "pWet", "pDry"] },
  { key: "hum", label: "湿度", fields: ["hYear", "hWet", "hDry"] },
  { key: "relief", label: "地势", fields: [] as string[] },
  { key: "pop", label: "人口", fields: ["pop"] },
  { key: "quake", label: "地震", fields: [] as string[] },
];

/** 宜居度图层 → 评分模型的维度键,让地图上的城市点色与榜单排名同源。 */
export const COMFORT_DIM: Record<string, DimKey> = {
  cOverall: "overall",
  cSummer: "summer",
  cWinter: "winter",
  cSunny: "sunny",
  cDry: "dry",
  cCalm: "calm",
};

/**
 * 反过来:评分维度 → 宜居度图层。地图与榜单共用一个偏好维度。
 * 物价 / 安全 / 便利没有对应的等值面(它们是离散的城市事实值),置空即可。
 */
export const DIM_FIELD: Partial<Record<DimKey, string>> = {
  overall: "cOverall",
  summer: "cSummer",
  winter: "cWinter",
  sunny: "cSunny",
  dry: "cDry",
  calm: "cCalm",
};

/** 等高线每 2000 m 加粗一档。 */
export const isMajor = (v: number) => v % 2000 === 0;

export interface ProbeRead {
  cx: number;
  cy: number;
  flip: boolean;
  v: Record<string, number>;
}
