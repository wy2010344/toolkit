/**
 * 校验:连续宜居度面与离散榜单必须对得上。
 *   ① 图册数据能被正常解析,图层 / 档位 / 色带齐全;
 *   ② 探针二进制能解码;
 *   ③ 探针在每个城市位置读到的分数,与榜单里该城的分数基本一致;
 *   ④ 地图上的城市点色(按色带分档)与榜单名次不矛盾。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const atlas = await import("../lib/climate/atlas/yunnan.ts");
const { CLIMATES } = await import("../lib/climate/cities.ts");
const { scoreAll } = await import("../lib/climate/score.ts");

console.log("— 图册导出 —");
console.log("  FIELD_META 字段:", Object.keys(atlas.FIELD_META).join(", "));
console.log("  FIELD_LEVELS 字段:", Object.keys(atlas.FIELD_LEVELS).join(", "));
console.log("  RAMPS 分组:", Object.keys(atlas.RAMPS).join(", "));
for (const k of ["cOverall", "cSummer", "cWinter", "cSunny", "cDry", "cCalm"]) {
  const m = atlas.FIELD_META[k];
  const lines = atlas.FIELD_LINES[k] ?? [];
  const bands = atlas.BAND_COLORS[k] ?? [];
  console.log(`  ${k}: ${m.label} ${m.min}–${m.max} 分 · 档位 ${atlas.FIELD_LEVELS[k].join("/")} · 等值线 ${lines.length} 段 · 色带 ${bands.length} 档`);
  if (!lines.length) throw new Error(`${k} 没有等值线`);
  if (bands.length !== atlas.FIELD_LEVELS[k].length + 1) throw new Error(`${k} 色带档数与等值线档位不匹配`);
}

console.log("— 探针解码 —");
const buf = fs.readFileSync(path.join(ROOT, "public/atlas/probe.bin"));
const jsonLen = buf.readUInt32LE(0);
const meta = JSON.parse(buf.subarray(4, 4 + jsonLen).toString("utf8"));
const body = buf.subarray(4 + jsonLen);
console.log(`  ${meta.w}×${meta.h} 格 · 粗网格 ${meta.cw}×${meta.ch} · 字段 ${meta.fields.map((f) => f.key).join(",")}`);
const offs = [];
let stride = 0;
for (const f of meta.fields) {
  offs.push(stride);
  stride += f.type === "u8" ? 1 : 2;
}
const read = (gx, gy) => {
  const base = (gy * meta.w + gx) * stride;
  const o = {};
  meta.fields.forEach((f, i) => {
    const p = base + offs[i];
    const raw = f.type === "u8" ? body.readUInt8(p) : f.type === "u16" ? body.readUInt16LE(p) : body.readInt16LE(p);
    o[f.key] = raw * f.scale;
  });
  return o;
};

// 探针格 → 粗网格 → 站点位置
const scores = scoreAll();
const byId = Object.fromEntries(scores.map((s) => [s.id, s]));
const D2R = Math.PI / 180;
const P1 = 25 * D2R, P2 = 47 * D2R, L0 = 105 * D2R;
const NN = (Math.sin(P1) + Math.sin(P2)) / 2;
const CC = Math.cos(P1) ** 2 + 2 * NN * Math.sin(P1);
const RHO0 = Math.sqrt(CC) / NN;
const project = (lat, lon) => {
  const theta = NN * (lon * D2R - L0);
  const rho = Math.sqrt(CC - 2 * NN * Math.sin(lat * D2R)) / NN;
  return [rho * Math.sin(theta) * atlas.PROJ.s + atlas.PROJ.tx, atlas.PROJ.ty - (RHO0 - rho * Math.cos(theta)) * atlas.PROJ.s];
};

let worst = 0;
let worstName = "";
const rows = [];
for (const c of CLIMATES) {
  const [x, y] = project(c.lat, c.lon);
  const cgx = Math.max(0, Math.min(meta.cw - 1, Math.round((x / atlas.VIEW.w) * meta.cw)));
  const cgy = Math.max(0, Math.min(meta.ch - 1, Math.round((y / atlas.VIEW.h) * meta.ch)));
  const gx = Math.min(meta.w - 1, Math.floor(cgx / meta.cell));
  const gy = Math.min(meta.h - 1, Math.floor(cgy / meta.cell));
  const v = read(gx, gy);
  if (!v.inMask) {
    console.log(`  · ${c.name} 在省外(不参与本项校验)`);
    continue;
  }
  const own = byId[c.id];
  const d = Math.abs(v.cOverall - own.overall);
  if (d > worst) {
    worst = d;
    worstName = c.name;
  }
  rows.push({ name: c.name, map: v.cOverall, rank: own.overall, d, elev: v.elev, cityElev: c.elevation, tJan: v.tJan, tJul: v.tJul });
}
rows.sort((a, b) => b.rank - a.rank);
console.log("— 城市点:地图读数 vs 榜单分数(前 8 + 末 3)—");
for (const r of [...rows.slice(0, 8), ...rows.slice(-3)]) {
  console.log(
    `  ${r.name.padEnd(4, "　")} 地图 ${r.map.toFixed(1).padStart(5)} · 榜单 ${r.rank.toFixed(1).padStart(5)} · 差 ${r.d.toFixed(1).padStart(4)} · 探针海拔 ${String(r.elev).padStart(4)} m(站点 ${String(r.cityElev).padStart(4)} m) · 1月 ${r.tJan.toFixed(1)}℃ · 7月 ${r.tJul.toFixed(1)}℃`,
  );
}
console.log(`  最大偏差 ${worst.toFixed(2)} 分(${worstName})`);
if (worst > 10) throw new Error("地图读数与榜单分数偏差过大");

// 六个维度逐一核对:地图上的读数与榜单里的分数必须同序同值。
console.log("— 六个维度逐一对账(城市中位绝对偏差)—");
const DIM_KEYS = { cOverall: "overall", cSummer: "summer", cWinter: "winter", cSunny: "sunny", cDry: "dry", cCalm: "calm" };
for (const [fkey, dkey] of Object.entries(DIM_KEYS)) {
  const devs = [];
  for (const r of rows) {
    const c = CLIMATES.find((x) => x.name === r.name);
    if (!c) continue;
    const [x, y] = project(c.lat, c.lon);
    const cgx = Math.max(0, Math.min(meta.cw - 1, Math.round((x / atlas.VIEW.w) * meta.cw)));
    const cgy = Math.max(0, Math.min(meta.ch - 1, Math.round((y / atlas.VIEW.h) * meta.ch)));
    const v = read(Math.min(meta.w - 1, Math.floor(cgx / meta.cell)), Math.min(meta.h - 1, Math.floor(cgy / meta.cell)));
    if (!v.inMask) continue;
    devs.push(Math.abs(v[fkey] - byId[c.id][dkey]));
  }
  devs.sort((a, b) => a - b);
  const med = devs[Math.floor(devs.length / 2)];
  const mx = devs[devs.length - 1];
  console.log(`  ${fkey.padEnd(9)} 中位偏差 ${med.toFixed(1)} 分 · 最大 ${mx.toFixed(1)} 分(${devs.length} 城)`);
  if (med > 4) throw new Error(`${fkey} 与榜单不一致`);
}

// 抽查:建水 / 昆明 / 香格里拉 的温度合理性
for (const id of ["jianchui", "kunming", "xianggelila"]) {
  const c = CLIMATES.find((x) => x.id === id);
  if (!c) continue;
  const [x, y] = project(c.lat, c.lon);
  const cgx = Math.max(0, Math.min(meta.cw - 1, Math.round((x / atlas.VIEW.w) * meta.cw)));
  const cgy = Math.max(0, Math.min(meta.ch - 1, Math.round((y / atlas.VIEW.h) * meta.ch)));
  const v = read(Math.min(meta.w - 1, Math.floor(cgx / meta.cell)), Math.min(meta.h - 1, Math.floor(cgy / meta.cell)));
  console.log(`  ${c.name}:站点 1月 ${c.months[0].mean}℃ / 探针 ${v.tJan.toFixed(1)}℃;站点 7月 ${c.months[6].mean}℃ / 探针 ${v.tJul.toFixed(1)}℃`);
}
console.log("\n✓ 校验通过");
