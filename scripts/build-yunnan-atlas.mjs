/**
 * 生成云南「等值线图册」的底图与等值线数据。
 *
 * 和上一版全国图册不同,这里不以行政区划为单位着色,而是画「数据的分界线」:
 *   ① 等高线 —— 400 m 一档,直接对 DEM 做 marching squares;
 *   ② 等温线 —— 用 30 个站点的一月/七月/年均气温做反距离加权插值,并按气温直减率
 *      扣除高程影响,再叠加 DEM 高程场,于是等温线会沿河谷与山脊弯折,和真实等温线一致;
 *   ③ 等降水线 —— 同样的插值,分全年 / 雨季(5–10 月)/ 干季(11–4 月);
 *   ④ 人口等值线 —— 16 个州市驻地的人口规模插值。
 * 站点数据直接读项目里的 TS 模块,不另抄一份。
 *
 * 输出:
 *   lib/climate/atlas/yunnan.ts        —— 边界、等高线、各专题等值线(已投影 + 简化)
 *   public/atlas/yunnan-relief.png     —— 分层设色 + 晕渲的底图
 *
 * 用法:node --experimental-strip-types --import ./scripts/ts-register.mjs scripts/build-yunnan-atlas.mjs
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = path.join(ROOT, ".tmp-atlas");
const GEOJSON = path.join(CACHE, "china_prov.json");
const OUT_TS = path.join(ROOT, "lib/climate/atlas/yunnan.ts");
const OUT_IMG = path.join(ROOT, "public/atlas/yunnan-relief.png");

const { CLIMATES } = await import("../lib/climate/cities.ts");
const { MONTHLY_ENV } = await import("../lib/climate/env.ts");
const { comfortOf, scoreOf } = await import("../lib/climate/score.ts");

const D2R = Math.PI / 180;

/* ─────────────────────────── 投影 ─────────────────────────── */

const PHI1 = 25 * D2R;
const PHI2 = 47 * D2R;
const LON0 = 105 * D2R;
const NN = (Math.sin(PHI1) + Math.sin(PHI2)) / 2;
const CC = Math.cos(PHI1) ** 2 + 2 * NN * Math.sin(PHI1);
const RHO0 = Math.sqrt(CC) / NN;

function albers(lon, lat) {
  const theta = NN * (lon * D2R - LON0);
  const rho = Math.sqrt(CC - 2 * NN * Math.sin(lat * D2R)) / NN;
  return [rho * Math.sin(theta), RHO0 - rho * Math.cos(theta)];
}

function albersInv(x, y) {
  const dy = RHO0 - y;
  const rho = Math.hypot(x, dy);
  const theta = Math.atan2(x, dy);
  const sinPhi = (CC - (rho * NN) ** 2) / (2 * NN);
  return [(theta / NN) * (180 / Math.PI) + 105, Math.asin(Math.max(-1, Math.min(1, sinPhi))) * (180 / Math.PI)];
}

/* ─────────────────────────── 小工具 ─────────────────────────── */

const n1 = (v) => Math.round(v * 10) / 10;

/** Douglas–Peucker。会先清掉相邻重复点与闭合环末尾的重复点,否则基准线段会退化成零长度。 */
function simplify(pts, tol) {
  const src = [];
  for (const p of pts) {
    const q = src[src.length - 1];
    if (!q || Math.abs(p[0] - q[0]) > 1e-12 || Math.abs(p[1] - q[1]) > 1e-12) src.push(p);
  }
  while (src.length > 2) {
    const a = src[0];
    const b = src[src.length - 1];
    if (Math.abs(a[0] - b[0]) <= 1e-12 && Math.abs(a[1] - b[1]) <= 1e-12) src.pop();
    else break;
  }
  if (src.length < 4) return src;
  const keep = new Uint8Array(src.length);
  keep[0] = 1;
  keep[src.length - 1] = 1;
  const stack = [[0, src.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    if (b - a < 2) continue;
    const [ax, ay] = src[a];
    const [bx, by] = src[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len < 1e-12) continue;
    let best = -1;
    let bestD = tol;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((src[i][0] - ax) * dy - (src[i][1] - ay) * dx) / len;
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best > 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  const out = [];
  for (let i = 0; i < src.length; i++) if (keep[i]) out.push(src[i]);
  return out;
}

/* ─────────────────────────── PNG ─────────────────────────── */

function decodePNG(buf) {
  let pos = 8;
  const idat = [];
  let w = 0, h = 0, depth = 0, colorType = 0, interlace = 0;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      depth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!ch || depth !== 8 || interlace) throw new Error(`不支持的 PNG: depth=${depth} color=${colorType}`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(w * h * ch);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const cur = Buffer.from(raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride));
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0;
      const b = prev[i];
      const c = i >= ch ? prev[i - ch] : 0;
      let v = cur[i];
      if (ft === 1) v = (v + a) & 255;
      else if (ft === 2) v = (v + b) & 255;
      else if (ft === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (ft === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
      cur[i] = v;
    }
    cur.copy(out, y * stride);
    prev = cur;
  }
  return { w, h, ch, data: out };
}

const CRC = (() => {
  const t = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, c]);
}

/** 索引色 PNG:调色板第 0 项透明,其余不透明。 */
function encodeIndexed(w, h, idx, palette) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 3;
  const plte = Buffer.alloc(palette.length * 3);
  palette.forEach((c, i) => {
    plte[i * 3] = c[0];
    plte[i * 3 + 1] = c[1];
    plte[i * 3 + 2] = c[2];
  });
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w + 1)] = 0;
    idx.copy(raw, y * (w + 1) + 1, y * w, (y + 1) * w);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("PLTE", plte),
    chunk("tRNS", Buffer.from([0])),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ─────────────────────────── DEM ─────────────────────────── */

const TILE = 256;
const DEM_Z = 8;
const lon2tile = (lon, z) => ((lon + 180) / 360) * 2 ** z;
const lat2tile = (lat, z) => ((1 - Math.log(Math.tan(lat * D2R) + 1 / Math.cos(lat * D2R)) / Math.PI) / 2) * 2 ** z;

async function loadMosaic(bbox) {
  const metaFile = path.join(CACHE, `dem-z${DEM_Z}.json`);
  const binFile = path.join(CACHE, `dem-z${DEM_Z}.bin`);
  if (fs.existsSync(metaFile) && fs.existsSync(binFile)) {
    const meta = JSON.parse(fs.readFileSync(metaFile, "utf8"));
    return { meta, elev: new Float32Array(fs.readFileSync(binFile).buffer.slice(0)) };
  }
  const X0 = Math.floor(lon2tile(bbox.west - 0.3, DEM_Z));
  const X1 = Math.floor(lon2tile(bbox.east + 0.3, DEM_Z));
  const Y0 = Math.floor(lat2tile(bbox.north + 0.3, DEM_Z));
  const Y1 = Math.floor(lat2tile(bbox.south - 0.3, DEM_Z));
  const nx = X1 - X0 + 1;
  const ny = Y1 - Y0 + 1;
  const w = nx * TILE;
  const h = ny * TILE;
  const elev = new Float32Array(w * h).fill(-9999);
  console.log(`  抓取 DEM 瓦片 ${nx}×${ny} = ${nx * ny} 张(z${DEM_Z})`);

  const jobs = [];
  for (let ty = 0; ty < ny; ty++) for (let tx = 0; tx < nx; tx++) jobs.push([tx, ty]);
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (jobs.length) {
        const [tx, ty] = jobs.shift();
        const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${DEM_Z}/${X0 + tx}/${Y0 + ty}.png`;
        // S3 偶尔直接掐断连接,重试几次比整批失败划算
        let buf = null;
        for (let attempt = 0; attempt < 4 && !buf; attempt++) {
          try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            buf = Buffer.from(await res.arrayBuffer());
          } catch (e) {
            if (attempt === 3) throw new Error(`DEM 瓦片失败 ${url}: ${e.message}`);
            await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          }
        }
        const img = decodePNG(buf);
        const ox = tx * TILE;
        const oy = ty * TILE;
        for (let py = 0; py < TILE; py++)
          for (let px = 0; px < TILE; px++) {
            const o = (py * img.w + px) * img.ch;
            elev[(oy + py) * w + ox + px] = img.data[o] * 256 + img.data[o + 1] + img.data[o + 2] / 256 - 32768;
          }
      }
    }),
  );
  const meta = { X0, Y0, w, h, z: DEM_Z };
  fs.writeFileSync(binFile, Buffer.from(elev.buffer));
  fs.writeFileSync(metaFile, JSON.stringify(meta));
  return { meta, elev };
}

/** 从拼好的 Mercator 栅格里双线性取高程。 */
function sampler(meta, elev) {
  return (lon, lat) => {
    const gx = lon2tile(lon, DEM_Z) * TILE - meta.X0 * TILE;
    const gy = lat2tile(lat, DEM_Z) * TILE - meta.Y0 * TILE;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    if (x0 < 0 || y0 < 0 || x0 + 1 >= meta.w || y0 + 1 >= meta.h) return null;
    const fx = gx - x0;
    const fy = gy - y0;
    const i0 = y0 * meta.w + x0;
    const i1 = i0 + meta.w;
    return (
      elev[i0] * (1 - fx) * (1 - fy) +
      elev[i0 + 1] * fx * (1 - fy) +
      elev[i1] * (1 - fx) * fy +
      elev[i1 + 1] * fx * fy
    );
  };
}

/* ─────────────────────────── marching squares ─────────────────────────── */

/** 返回该等值线在网格坐标下的线段集合。 */
function isoSegments(grid, w, h, level) {
  const segs = [];
  for (let j = 0; j < h - 1; j++) {
    for (let i = 0; i < w - 1; i++) {
      const a = grid[j * w + i];
      const b = grid[j * w + i + 1];
      const d = grid[(j + 1) * w + i];
      const c = grid[(j + 1) * w + i + 1];
      if (a < -1000 || b < -1000 || c < -1000 || d < -1000) continue;
      const lo = Math.min(a, b, c, d);
      const hi = Math.max(a, b, c, d);
      if (level <= lo || level > hi) continue;

      const code = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
      if (code === 0 || code === 15) continue;
      const fr = (va, vb) => {
        const t = (level - va) / (vb - va);
        return t < 0 ? 0 : t > 1 ? 1 : t;
      };
      const top = [i + fr(a, b), j];
      const right = [i + 1, j + fr(b, c)];
      const bottom = [i + fr(d, c), j + 1];
      const left = [i, j + fr(a, d)];

      switch (code) {
        case 1: case 14: segs.push([left, bottom]); break;
        case 2: case 13: segs.push([bottom, right]); break;
        case 3: case 12: segs.push([left, right]); break;
        case 4: case 11: segs.push([right, top]); break;
        case 6: case 9: segs.push([top, bottom]); break;
        case 7: case 8: segs.push([left, top]); break;
        case 5:
          if ((a + b + c + d) / 4 > level) segs.push([left, top], [bottom, right]);
          else segs.push([left, bottom], [top, right]);
          break;
        case 10:
          if ((a + b + c + d) / 4 > level) segs.push([top, right], [left, bottom]);
          else segs.push([top, left], [right, bottom]);
          break;
      }
    }
  }
  return segs;
}

/** 把零散线段串成尽量长的折线。 */
function chain(segs) {
  const TOL = 0.02;
  const key = (p) => `${Math.round(p[0] / TOL)},${Math.round(p[1] / TOL)}`;
  const ends = new Map();
  segs.forEach((s, i) => {
    for (const p of s) {
      const k = key(p);
      const arr = ends.get(k);
      if (arr) arr.push(i);
      else ends.set(k, [i]);
    }
  });
  const used = new Uint8Array(segs.length);
  const lines = [];

  const step = (from, dir) => {
    let cur = from;
    for (;;) {
      const k = key(cur);
      const cand = ends.get(k);
      if (!cand) break;
      let next = -1;
      for (const i of cand) {
        if (used[i]) continue;
        next = i;
        break;
      }
      if (next < 0) break;
      used[next] = 1;
      const s = segs[next];
      cur = key(s[0]) === k ? s[1] : s[0];
      if (dir > 0) lines[lines.length - 1].push(cur);
      else lines[lines.length - 1].unshift(cur);
    }
  };

  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    lines.push([segs[i][0], segs[i][1]]);
    step(segs[i][1], 1);
    step(segs[i][0], -1);
  }
  return lines.filter((l) => l.length > 1);
}

/* ─────────────────────────── 主流程 ─────────────────────────── */

// 省界 GeoJSON(阿里 DataV GeoAtlas):缺失时自动下载并缓存。
if (!fs.existsSync(GEOJSON)) {
  fs.mkdirSync(CACHE, { recursive: true });
  const url = "https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json";
  console.log("  下载省界 GeoJSON …");
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`省界数据下载失败:HTTP ${res.status}`);
  fs.writeFileSync(GEOJSON, await res.text());
}

const gj = JSON.parse(fs.readFileSync(GEOJSON, "utf8"));
const yn = gj.features.find((f) => String(f.properties.adcode) === "530000");
if (!yn) throw new Error("边界数据里找不到云南省");

const polys = yn.geometry.type === "Polygon" ? [yn.geometry.coordinates] : yn.geometry.coordinates;
const rings = polys.map((p) => p.map((r) => r.map(([lon, lat]) => [lon, lat])));

// 图幅范围:云南轮廓外扩一点,留出邻省的山脉做参照
let bb = { west: 1e9, east: -1e9, south: 1e9, north: -1e9 };
for (const poly of rings)
  for (const [lon, lat] of poly[0]) {
    bb.west = Math.min(bb.west, lon);
    bb.east = Math.max(bb.east, lon);
    bb.south = Math.min(bb.south, lat);
    bb.north = Math.max(bb.north, lat);
  }
const PAD = 0.55;
bb = { west: bb.west - PAD, east: bb.east + PAD, south: bb.south - PAD, north: bb.north + PAD };

// 投影范围
let ab = { minX: 1e9, maxX: -1e9, minY: 1e9, maxY: -1e9 };
for (const poly of rings)
  for (const [lon, lat] of poly[0]) {
    const [x, y] = albers(lon, lat);
    ab.minX = Math.min(ab.minX, x);
    ab.maxX = Math.max(ab.maxX, x);
    ab.minY = Math.min(ab.minY, y);
    ab.maxY = Math.max(ab.maxY, y);
  }

const MARGIN = 18;
const VIEW = { w: 900, h: 900 };
const s = Math.min(
  (VIEW.w - 2 * MARGIN) / (ab.maxX - ab.minX),
  (VIEW.h - 2 * MARGIN) / (ab.maxY - ab.minY),
);
const tx = (VIEW.w - (ab.maxX - ab.minX) * s) / 2 - ab.minX * s;
const ty = (VIEW.h - (ab.maxY - ab.minY) * s) / 2 + ab.maxY * s;
const toXY = ([x, y]) => [x * s + tx, ty - y * s];
const project = (lon, lat) => toXY(albers(lon, lat));

// 栅格尺寸按图幅比例
const RW = 820;
const RH = Math.round((RW * VIEW.h) / VIEW.w);

const { meta, elev } = await loadMosaic(bb);
const sample = sampler(meta, elev);

console.log(`  重投影 ${RW}×${RH} …`);
const grid = new Float32Array(RW * RH).fill(-9999);
for (let py = 0; py < RH; py++) {
  const vy = ((py + 0.5) / RH) * VIEW.h;
  const Y = (ty - vy) / s;
  for (let px = 0; px < RW; px++) {
    const vx = ((px + 0.5) / RW) * VIEW.w;
    const X = (vx - tx) / s;
    const [lon, lat] = albersInv(X, Y);
    const v = sample(lon, lat);
    if (v != null) grid[py * RW + px] = v;
  }
}

/* 晕渲 */
const ZEN = 45 * D2R;
const AZ = 315 * D2R;
// 图幅东西向约 (bb.east-bb.west) 度,按 111 km/度 估算
const widthKm = (bb.east - bb.west) * 111;
const cellM = (widthKm * 1000) / RW;
const shade = new Float32Array(RW * RH).fill(1);
for (let py = 1; py < RH - 1; py++) {
  for (let px = 1; px < RW - 1; px++) {
    const k = py * RW + px;
    const e = grid[k];
    if (e <= 0) continue;
    const eL = grid[k - 1], eR = grid[k + 1], eU = grid[k - RW], eD = grid[k + RW];
    if (eL < -1000 || eR < -1000 || eU < -1000 || eD < -1000) continue;
    const dzdx = (eR - eL) / (2 * cellM);
    const dzdy = (eD - eU) / (2 * cellM);
    const slope = Math.atan(Math.hypot(dzdx, dzdy));
    const aspect = Math.atan2(dzdy, -dzdx);
    let v = Math.cos(ZEN) * Math.cos(slope) + Math.sin(ZEN) * Math.sin(slope) * Math.cos(AZ - aspect);
    if (v < 0) v = 0;
    shade[k] = 0.5 + 0.82 * Math.pow(v, 0.85);
  }
}

/* 分层设色 */
const HYPSO = [
  [0, [150, 186, 148]],
  [400, [178, 205, 150]],
  [800, [208, 216, 158]],
  [1200, [232, 220, 166]],
  [1600, [240, 212, 156]],
  [2000, [236, 198, 142]],
  [2400, [226, 180, 128]],
  [3000, [211, 158, 118]],
  [3600, [193, 136, 106]],
  [4200, [172, 141, 150]],
  [5000, [198, 190, 200]],
];
const SHADES = 12;
const SHADE_LO = 0.52;
const SHADE_HI = 1.34;
const palette = [[0, 0, 0]];
for (const [, c] of HYPSO) {
  for (let i = 0; i < SHADES; i++) {
    const f = SHADE_LO + ((SHADE_HI - SHADE_LO) * i) / (SHADES - 1);
    palette.push([
      Math.min(255, Math.round(c[0] * f)),
      Math.min(255, Math.round(c[1] * f)),
      Math.min(255, Math.round(c[2] * f)),
    ]);
  }
}
const bandOf = (e) => {
  let b = 0;
  for (let i = 1; i < HYPSO.length; i++) if (e >= HYPSO[i][0]) b = i;
  return b;
};
const idx = Buffer.alloc(RW * RH);
for (let k = 0; k < RW * RH; k++) {
  const e = grid[k];
  if (e <= 0) continue;
  const lv = Math.round(((shade[k] - SHADE_LO) / (SHADE_HI - SHADE_LO)) * (SHADES - 1));
  idx[k] = 1 + bandOf(e) * SHADES + Math.max(0, Math.min(SHADES - 1, lv));
}
fs.mkdirSync(path.dirname(OUT_IMG), { recursive: true });
const png = encodeIndexed(RW, RH, idx, palette);
fs.writeFileSync(OUT_IMG, png);
console.log(`✓ yunnan-relief.png ${RW}×${RH} · ${(png.length / 1024).toFixed(0)} KB`);

/* 云南掩膜:扫描线填充,用来把等值线裁在省内 */
const mask = new Uint8Array(RW * RH);
{
  const edges = [];
  for (const poly of rings)
    for (const ring of poly) {
      const pts = ring.map(([lon, lat]) => {
        const [x, y] = project(lon, lat);
        return [(x / VIEW.w) * RW, (y / VIEW.h) * RH];
      });
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        if (a[1] !== b[1]) edges.push([a, b]);
      }
    }
  for (let py = 0; py < RH; py++) {
    const yc = py + 0.5;
    const xs = [];
    for (const [a, b] of edges) {
      const y0 = Math.min(a[1], b[1]);
      const y1 = Math.max(a[1], b[1]);
      if (yc < y0 || yc >= y1) continue;
      xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const x0 = Math.max(0, Math.ceil(xs[i] - 0.5));
      const x1 = Math.min(RW - 1, Math.floor(xs[i + 1] - 0.5));
      for (let px = x0; px <= x1; px++) mask[py * RW + px] = 1;
    }
  }
}

/* 边界 path */
const borderD = rings
  .map((poly) =>
    poly
      .map((ring) => {
        const pts = simplify(ring.map(([lon, lat]) => project(lon, lat)), 0.12);
        return pts.length < 3 ? "" : "M" + pts.map(([x, y]) => `${n1(x)} ${n1(y)}`).join("L") + "Z";
      })
      .join(""),
  )
  .join("");

/* 等值线抽取 */
const gw = RW;
const gh = RH;

/* 平滑过的 DEM:只在省内取平均,否则省界那一圈会被邻省的低地拉低,
 * 等温线就会在边上假降。等温线还原高程与宜居度面都用它,保证两处口径一致。 */
const gridProv = new Float32Array(gw * gh);
for (let k = 0; k < gw * gh; k++) gridProv[k] = mask[k] ? grid[k] : -9999;
const demDs = downsample(gridProv, gw, gh, 20, null);
const demSmooth = upsample(demDs.data, demDs.w, demDs.h, gw, gh);

/** 3×3 均值模糊。DEM 是 600 m 级栅格,直接按 1 km 步长点采样会有混叠,
 *  等高线会碎成一堆小环,所以取等值线前先低通一次。 */
function blur(src, w, h, passes = 1) {
  let cur = src;
  for (let p = 0; p < passes; p++) {
    const out = new Float32Array(cur);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const k = y * w + x;
        if (cur[k] < -1000) continue;
        let sum = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const v = cur[k + dy * w + dx];
            if (v > -1000) {
              sum += v;
              n++;
            }
          }
        out[k] = sum / n;
      }
    }
    cur = out;
  }
  return cur;
}

/** 按整数倍做块平均降采样,顺便把掩膜一起降下来(取块内多数)。 */
function downsample(src, w, h, f, maskSrc) {
  const W = Math.floor(w / f);
  const H = Math.floor(h / f);
  const data = new Float32Array(W * H).fill(-9999);
  const m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let sum = 0;
      let n = 0;
      let inside = 0;
      for (let dy = 0; dy < f; dy++) {
        for (let dx = 0; dx < f; dx++) {
          const k = (y * f + dy) * w + x * f + dx;
          const v = src[k];
          if (v > -1000) {
            sum += v;
            n++;
          }
          if (maskSrc && maskSrc[k]) inside++;
        }
      }
      data[y * W + x] = n ? sum / n : -9999;
      m[y * W + x] = inside * 2 > f * f ? 1 : 0;
    }
  }
  return { data, mask: m, w: W, h: H };
}

/** 双线性放大(把降采样后的地形趋势还原到细网格)。 */
function upsample(src, w, h, W, H) {
  const out = new Float32Array(W * H).fill(-9999);
  for (let y = 0; y < H; y++) {
    const fy = ((y + 0.5) / H) * h - 0.5;
    const y0 = Math.max(0, Math.min(h - 1, Math.floor(fy)));
    const y1 = Math.min(h - 1, y0 + 1);
    const ty = Math.max(0, Math.min(1, fy - y0));
    for (let x = 0; x < W; x++) {
      const fx = ((x + 0.5) / W) * w - 0.5;
      const x0 = Math.max(0, Math.min(w - 1, Math.floor(fx)));
      const x1 = Math.min(w - 1, x0 + 1);
      const tx = Math.max(0, Math.min(1, fx - x0));
      const a = src[y0 * w + x0], b = src[y0 * w + x1];
      const c = src[y1 * w + x0], d = src[y1 * w + x1];
      const v = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
      out[y * W + x] = v;
    }
  }
  return out;
}

/** 把网格值转成 viewBox 坐标下的折线集合(可选:只保留省内)。 */
function contourOf(field, w, h, level, { clip = true, tol = 0.35, maskArr = mask } = {}) {
  const segs = isoSegments(field, w, h, level);
  if (!segs.length) return [];
  const lines = chain(segs);
  const out = [];
  for (const line of lines) {
    const pts = [];
    let inside = false;
    for (const [gx, gy] of line) {
      const px = Math.round(gx);
      const py = Math.round(gy);
      if (px >= 0 && px < w && py >= 0 && py < h && maskArr[py * w + px]) inside = true;
      pts.push([(gx / w) * VIEW.w, (gy / h) * VIEW.h]);
    }
    if (clip && !inside) continue;
    // 太短的碎环在省域图上只是噪点,直接丢掉
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (len < 14) continue;
    const simp = simplify(pts, tol);
    if (simp.length < 2) continue;
    out.push(simp.flatMap(([x, y]) => [n1(x), n1(y)]));
  }
  return out;
}

/** 高程场:先低通再裁到省内,等值线就自然止于省界。 */
const elevSmooth = blur(grid, gw, gh, 1);
const elevClipped = new Float32Array(elevSmooth);
for (let k = 0; k < elevClipped.length; k++) if (!mask[k]) elevClipped[k] = -9999;

const ELEV_STEP = 400;
/** 站点场抽线前先降采样到这个倍数的粗网格。 */
const FIELD_SCALE = 4;
let emin = Infinity;
let emax = -Infinity;
for (let k = 0; k < elevClipped.length; k++) {
  const v = elevClipped[k];
  if (v > 0) {
    if (v < emin) emin = v;
    if (v > emax) emax = v;
  }
}
const elevLevels = [];
for (let lv = Math.ceil(emin / ELEV_STEP) * ELEV_STEP; lv <= emax; lv += ELEV_STEP) elevLevels.push(lv);
console.log(`  等高线 ${elevLevels.length} 档(${emin.toFixed(0)}–${emax.toFixed(0)} m)`);

const contours = [];
for (const lv of elevLevels) {
  const segs = contourOf(elevClipped, gw, gh, lv, { tol: 0.55 });
  if (segs.length) contours.push({ v: lv, segs });
}

/* 站点场插值 */
const stations = CLIMATES.map((c) => {
  const env = MONTHLY_ENV[c.id] ?? [];
  const monthly = env.map((e) => e.precip);
  const year = monthly.reduce((a, b) => a + b, 0);
  const wet = monthly.slice(4, 10).reduce((a, b) => a + b, 0);
  return {
    id: c.id,
    name: c.name,
    lat: c.lat,
    lon: c.lon,
    elev: c.elevation,
    tJan: c.months[0].mean,
    tJul: c.months[6].mean,
    tYear: c.months.reduce((a, m) => a + m.mean, 0) / 12,
    pYear: year,
    pWet: wet,
    pDry: year - wet,
    // 逐月要素:连续宜居度面要用
    tM: c.months.map((m) => m.mean),
    tMax: c.months.map((m) => m.max),
    tMin: c.months.map((m) => m.min),
    hum: env.map((e) => e.hum),
    rainD: env.map((e) => e.rainDays),
    sun: env.map((e) => e.sun),
    windD: env.map((e) => e.windyDays),
    hot30: env.map((e) => e.hot30),
    frost: env.map((e) => e.frost),
  };
});

/** 16 个州市驻地的人口规模(万人,2020 年七普)。 */
const PREFECTURES = [
  { name: "昆明", lat: 25.04, lon: 102.71, pop: 846 },
  { name: "曲靖", lat: 25.49, lon: 103.8, pop: 576 },
  { name: "昭通", lat: 27.34, lon: 103.72, pop: 509 },
  { name: "红河", lat: 23.36, lon: 103.38, pop: 447 },
  { name: "文山", lat: 23.37, lon: 104.24, pop: 350 },
  { name: "大理", lat: 25.61, lon: 100.27, pop: 334 },
  { name: "保山", lat: 25.11, lon: 99.16, pop: 243 },
  { name: "楚雄", lat: 25.04, lon: 101.55, pop: 240 },
  { name: "普洱", lat: 22.78, lon: 100.97, pop: 240 },
  { name: "临沧", lat: 23.89, lon: 100.09, pop: 226 },
  { name: "玉溪", lat: 24.35, lon: 102.54, pop: 225 },
  { name: "德宏", lat: 24.43, lon: 98.58, pop: 132 },
  { name: "西双版纳", lat: 22.01, lon: 100.8, pop: 130 },
  { name: "丽江", lat: 26.86, lon: 100.23, pop: 125 },
  { name: "怒江", lat: 25.85, lon: 98.85, pop: 55 },
  { name: "迪庆", lat: 27.83, lon: 99.7, pop: 39 },
];

/**
 * 多要素反距离加权:一次遍历同时插值多个场,站点权重只算一遍。
 * picks 是若干 (站点) => 数值 的取值函数,返回等长的场数组。
 * power=2 时权重直接取 1/d²(免掉逐点的 pow 调用)。
 * w / h / maskArr 允许在粗网格上做同一套插值。
 */
function idwMulti(points, picks, { blend = 0, power = 2, w = gw, h = gh, maskArr = mask } = {}) {
  const n = picks.length;
  const out = picks.map(() => new Float32Array(w * h).fill(-9999));
  // 先把站点坐标换算到网格坐标,避免逐像元重复投影
  const pts = points.map((p) => {
    const [x, y] = project(p.lon, p.lat);
    return { x: (x / VIEW.w) * w, y: (y / VIEW.h) * h, v: picks.map((f) => f(p)) };
  });
  const sv = new Float64Array(n);
  const fast = Math.abs(power - 2) < 1e-9;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const k = py * w + px;
      if (!maskArr[k]) continue;
      sv.fill(0);
      let sw = 0;
      let exact = null;
      for (const p of pts) {
        const d2 = (px - p.x) ** 2 + (py - p.y) ** 2;
        if (d2 < 0.5) {
          exact = p.v;
          break;
        }
        const wt = fast ? 1 / d2 : 1 / Math.pow(d2, power / 2);
        sw += wt;
        for (let i = 0; i < n; i++) sv[i] += wt * p.v[i];
      }
      for (let i = 0; i < n; i++) out[i][k] = exact ? exact[i] : sv[i] / sw;
    }
  }
  if (blend) {
    // 轻度平滑,避免插值面出现同心环
    for (let i = 0; i < n; i++) {
      const tmp = out[i];
      const res = new Float32Array(tmp);
      for (let py = 1; py < h - 1; py++)
        for (let px = 1; px < w - 1; px++) {
          const k = py * w + px;
          if (tmp[k] < -1000) continue;
          let sum = 0;
          let cnt = 0;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const v = tmp[k + dy * w + dx];
              if (v > -1000) {
                sum += v;
                cnt++;
              }
            }
          res[k] = tmp[k] * (1 - blend) + (sum / cnt) * blend;
        }
      out[i] = res;
    }
  }
  return out;
}

/** 单要素版本。 */
function idw(points, pick, opts = {}) {
  return idwMulti(points, [pick], opts)[0];
}

/** 气温:先按直减率换算到海平面插值,再按 DEM 高程还原,等温线才会沿地形弯折。 */
function tempField(pick, lapse = 0.0065) {
  const sl = idw(stations, (p) => pick(p) + lapse * p.elev, { power: 2.0, blend: 0.35 });
  // 还原高程用平滑过的 DEM:等温线该跟着山系走,但不该跟着每个山头抖
  const out = new Float32Array(gw * gh).fill(-9999);
  for (let k = 0; k < out.length; k++) {
    if (sl[k] < -1000) continue;
    out[k] = sl[k] - lapse * demSmooth[k];
  }
  // 气温场再抹一遍,把零碎的闭合小环收掉
  const soft = blur(out, gw, gh, 2);
  for (let k = 0; k < soft.length; k++) if (out[k] < -1000) soft[k] = -9999;
  return soft;
}

/**
 * 由站点标定的单调曲线:横轴是站点上的某个量(如月最高温),纵轴是另一个量(如 >30℃ 天数)。
 * 网格上先拿到横轴的值,再用这条曲线换算纵轴,于是「高温日数」这类计数
 * 会自动随地形(海拔)变化,而不是在山地里仍照抄邻近低地站点的数字。
 *
 * 拟合用 PAVA(池邻违规法)做保序回归:站点配对里有噪声时,压成一条单调不减的曲线,
 * 保证「越热 → 高温日越多」「越冷 → 霜冻日越多」这类方向不会被打乱。
 */
function monotoneCurve(pairs) {
  // 同一个横轴上的多个站点先合并取均值
  const m = new Map();
  for (const [x, y] of pairs) {
    const e = m.get(x);
    if (e) {
      e[0]++;
      e[1] += y;
    } else m.set(x, [1, y]);
  }
  const pts = [...m.entries()].map(([x, [n, s]]) => [x, s / n]).sort((a, b) => a[0] - b[0]);
  if (!pts.length) return () => 0;

  // PAVA:把违反单调性的相邻块合并成块均值
  const blocks = [];
  for (const [x, y] of pts) {
    blocks.push({ xs: [x], ys: [y], n: 1 });
    while (blocks.length >= 2) {
      const a = blocks[blocks.length - 2];
      const b = blocks[blocks.length - 1];
      const ma = a.ys.reduce((s, v) => s + v, 0) / a.n;
      const mb = b.ys.reduce((s, v) => s + v, 0) / b.n;
      if (ma <= mb) break;
      a.xs.push(...b.xs);
      a.ys.push(...b.ys);
      a.n += b.n;
      blocks.pop();
    }
  }
  const xs = [];
  const ys = [];
  for (const b of blocks) {
    const mv = b.ys.reduce((s, v) => s + v, 0) / b.n;
    for (let i = 0; i < b.n; i++) {
      xs.push(b.xs[i]);
      ys.push(mv);
    }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
    let lo = 0;
    let hi = xs.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] <= x) lo = mid;
      else hi = mid;
    }
    const t = (x - xs[lo]) / (xs[hi] - xs[lo] || 1);
    return ys[lo] + (ys[hi] - ys[lo]) * t;
  };
}

/** 取一个「整」的间隔,让等值线条数落在 5–9 之间。 */
function niceStep(min, max, candidates) {
  const span = max - min;
  for (const c of candidates) if (span / c <= 8) return c;
  return candidates[candidates.length - 1];
}

function levelsFor(field, step) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let k = 0; k < field.length; k++) {
    const v = field[k];
    if (v < -1000) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const out = [];
  for (let lv = Math.ceil(lo / step) * step; lv <= hi; lv += step) out.push(Math.round(lv * 100) / 100);
  return out;
}

/**
 * 站点场的预处理:先低通,再按专题降到一个更粗的网格(站点稀疏时把单站的尖峰摊开),
 * 然后插值回抽线用的 205 网格。等值线因此是舒展的曲线,而不是绕着每个站点转圈。
 */
function fieldGrid(field, coarse) {
  const base = blur(field, gw, gh, 3);
  const mid = downsample(base, gw, gh, FIELD_SCALE, mask);
  if (coarse <= FIELD_SCALE) return mid;
  const lo = downsample(base, gw, gh, coarse, mask);
  return { data: upsample(lo.data, lo.w, lo.h, mid.w, mid.h), mask: mid.mask, w: mid.w, h: mid.h };
}

function buildField(key, field, step, coarse, dsOverride) {
  const levels = levelsFor(field, step);
  const ds = dsOverride ?? fieldGrid(field, coarse);
  const segs = [];
  for (const lv of levels) {
    const lines = contourOf(ds.data, ds.w, ds.h, lv, { tol: 0.4, maskArr: ds.mask });
    if (lines.length) segs.push({ v: lv, segs: lines });
  }
  console.log(`  ${key}: ${levels.length} 档 · ${segs.reduce((a, b) => a + b.segs.length, 0)} 条`);
  return segs;
}

/* 分层设色的色带 */
const RAMPS = {
  temp: ["#2f5f9e", "#5d8ab8", "#9dc0d8", "#e6e0cf", "#efc793", "#dc8a5b", "#b8452f"],
  rain: ["#e6eef0", "#c6dce6", "#9dc3d6", "#6b9fbe", "#3f76a0", "#1d4a73"],
  pop: ["#e9e0ea", "#d3c2da", "#bda5c9", "#a184b3", "#7f6098", "#5b3f76"],
  // 宜居度:低分偏暖褐(不宜),高分偏墨绿(宜居),中间过黄。
  comfort: ["#9c4b3f", "#bf7048", "#d69f63", "#d7c98c", "#b3c57c", "#7aa467", "#3f7f55"],
};

const hex2rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function rampAt(stops, t) {
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(Math.floor(x), stops.length - 2);
  const f = x - i;
  const a = hex2rgb(stops[i]);
  const b = hex2rgb(stops[i + 1]);
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/**
 * 把等值线之间的区域按档位涂色,并把晕渲乘进去,得到一张「分层设色 + 晕渲」的专题图。
 * 这样等值线之间的色带和线上的读数是一套东西,不用另算。
 */
function writeFieldImage(f, field, dsOverride) {
  const ds = dsOverride ?? fieldGrid(field, f.coarse);
  const W = 410;
  const H = 410;
  const up = upsample(ds.data, ds.w, ds.h, W, H);
  const levels = levelsFor(field, f.step);
  const bands = levels.length + 1;
  const stops = RAMPS[f.group];

  const palette = [[0, 0, 0]];
  const bandColors = [];
  for (let b = 0; b < bands; b++) {
    const c = rampAt(stops, bands <= 1 ? 0.5 : b / (bands - 1));
    bandColors.push(`#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`);
    for (let s = 0; s < SHADES; s++) {
      // 晕渲只做轻微调制,别把色带压暗到分不出档
      const m = 0.84 + 0.3 * (s / (SHADES - 1));
      palette.push([
        Math.min(255, Math.round(c[0] * m)),
        Math.min(255, Math.round(c[1] * m)),
        Math.min(255, Math.round(c[2] * m)),
      ]);
    }
  }

  const idx = Buffer.alloc(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = y * W + x;
      if (!ds.mask[(y >> 1) * ds.w + (x >> 1)]) continue;
      const v = up[k];
      if (v < -1000) continue;
      let b = 0;
      while (b < levels.length && v >= levels[b]) b++;
      b = Math.min(b, bands - 1);
      const sv = shade[(y * 2) * RW + x * 2];
      const sl = Math.max(0, Math.min(SHADES - 1, Math.round(((sv - SHADE_LO) / (SHADE_HI - SHADE_LO)) * (SHADES - 1))));
      idx[k] = 1 + b * SHADES + sl;
    }
  }

  const file = path.join(ROOT, `public/atlas/field-${f.key}.png`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, encodeIndexed(W, H, idx, palette));
  return bandColors;
}

const tJan = tempField((p) => p.tJan);
const tJul = tempField((p) => p.tJul);
const tYear = tempField((p) => p.tYear);
const pYear = idw(stations, (p) => p.pYear, { power: 1.6, blend: 0.45 });
const pWet = idw(stations, (p) => p.pWet, { power: 1.6, blend: 0.45 });
const pDry = idw(stations, (p) => p.pDry, { power: 1.6, blend: 0.45 });
const pop = idw(PREFECTURES, (p) => p.pop, { power: 1.8, blend: 0.5 });

const range = (f) => {
  let lo = Infinity;
  let hi = -Infinity;
  for (let k = 0; k < f.length; k++) {
    const v = f[k];
    if (v < -1000) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
};

const T_STEPS = [1, 2, 2.5, 5];
const P_STEPS = [100, 200, 250, 500];
const POP_STEPS = [25, 50, 100, 200, 400];

/* ─────────────────────── 连续宜居度面 ─────────────────────── */

/**
 * 把「宜居度」从 31 个离散分数变成整幅云南上的连续场——用户要的是连续的地图,
 * 而不是一列城市的分数。
 *
 * 做法:
 *   ① 逐月把气象要素(均温 / 湿度 / 雨日 / 日照 / 大风)插值成栅格;
 *   ② 气温先按直减率换到海平面插值、再按 DEM 还原,于是等温面沿山谷山脊弯折;
 *   ③ 「>30℃ 天数」「霜冻天数」是计数,不是地形的线性函数,直接插值会把高山上
 *      的数字照抄成邻近低地站点的值。它们真正由气温水平决定,所以用站点标定的
 *      单调曲线由该地气温反推,计数就随海拔自动变化;
 *   ④ 逐像元调用 lib/climate/score.ts 的 comfortOf()——与榜单同一个函数,
 *      所以地图上的连续面和榜单上的离散分数必然一致,不会各说各话。
 */

const LAPSE = 0.0065;
const CW = Math.floor(gw / FIELD_SCALE);
const CH = Math.floor(gh / FIELD_SCALE);
const demCoarse = downsample(demSmooth, gw, gh, FIELD_SCALE, mask);
const maskC = demCoarse.mask;
const demC = demCoarse.data;

/* ① 逐月要素场。气温先换算到海平面,插值完再按高程还原。 */
const tempPicks = [];
for (const key of ["tM", "tMax", "tMin"])
  for (let m = 0; m < 12; m++) tempPicks.push((p) => p[key][m] + LAPSE * p.elev);
const envPicks = [];
for (const key of ["hum", "rainD", "sun", "windD"])
  for (let m = 0; m < 12; m++) envPicks.push((p) => p[key][m]);

const tempRaw = idwMulti(stations, tempPicks, { power: 2.0, blend: 0.35, w: CW, h: CH, maskArr: maskC });
const envRaw = idwMulti(stations, envPicks, { power: 1.8, blend: 0.45, w: CW, h: CH, maskArr: maskC });

/* ② 气温还原高程(和图上的等温线用同一份平滑 DEM)。 */
const restoreTemp = (f) => {
  const out = new Float32Array(f.length).fill(-9999);
  for (let k = 0; k < f.length; k++) {
    if (f[k] < -1000 || demC[k] < -1000) continue;
    out[k] = f[k] - LAPSE * demC[k];
  }
  return out;
};
const tM = [];
const tMax = [];
const tMin = [];
for (let m = 0; m < 12; m++) {
  tM.push(restoreTemp(tempRaw[m]));
  tMax.push(restoreTemp(tempRaw[12 + m]));
  tMin.push(restoreTemp(tempRaw[24 + m]));
}
const hum = envRaw.slice(0, 12);
const rainD = envRaw.slice(12, 24);
const sunH = envRaw.slice(24, 36);
const windD = envRaw.slice(36, 48);

/* ③ 计数类要素由气温反推。 */
const hotCurve = monotoneCurve(stations.flatMap((p) => p.tMax.map((t, m) => [t, p.hot30[m]])));
const frostCurve = monotoneCurve(stations.flatMap((p) => p.tMin.map((t, m) => [-t, p.frost[m]])));
const mapField = (f, fn) => {
  const out = new Float32Array(f.length).fill(-9999);
  for (let k = 0; k < f.length; k++) {
    if (f[k] < -1000) continue;
    out[k] = fn(f[k]);
  }
  return out;
};
const hot30 = tMax.map((f) => mapField(f, (v) => hotCurve(v)));
const frost = tMin.map((f) => mapField(f, (v) => frostCurve(-v)));

/* ④ 逐像元求舒适度。 */
const COMFORT_KEYS = ["cOverall", "cSummer", "cWinter", "cSunny", "cDry", "cCalm"];
const comfort = Object.fromEntries(COMFORT_KEYS.map((k) => [k, new Float32Array(CW * CH).fill(-9999)]));
const r1 = (v) => Math.round(v * 10) / 10;
const sc = new Array(12);
for (let gy = 0; gy < CH; gy++) {
  for (let gx = 0; gx < CW; gx++) {
    const k = gy * CW + gx;
    if (!maskC[k]) continue;
    let ok = true;
    let sum = 0;
    let sSun = 0;
    let sRain = 0;
    let sWind = 0;
    for (let m = 0; m < 12; m++) {
      const t = tM[m][k];
      const h = hum[m][k];
      const rd = rainD[m][k];
      const su = sunH[m][k];
      const wd = windD[m][k];
      if (t < -1000 || h < -1000 || rd < -1000 || su < -1000 || wd < -1000) {
        ok = false;
        break;
      }
      const c = comfortOf({
        temp: t,
        hum: h,
        rainDays: rd,
        sun: su,
        windyDays: wd,
        hot30: hot30[m][k],
        frost: frost[m][k],
      });
      sc[m] = c.score;
      sum += c.score;
      sSun += c.sun;
      sRain += c.rain;
      sWind += c.wind;
    }
    if (!ok) continue;
    comfort.cOverall[k] = r1(sum / 12);
    comfort.cSummer[k] = r1((sc[5] + sc[6] + sc[7]) / 3);
    comfort.cWinter[k] = r1((sc[11] + sc[0] + sc[1]) / 3);
    comfort.cSunny[k] = r1(sSun / 12);
    comfort.cDry[k] = r1(sRain / 12);
    comfort.cCalm[k] = r1(sWind / 12);
  }
}

/* 把城市所在的那一格钉成该城自己的分数——地图上的点色与榜单里的名次必须对得上。 */
for (const st of stations) {
  const [x, y] = project(st.lon, st.lat);
  const gx = Math.max(0, Math.min(CW - 1, Math.round((x / VIEW.w) * CW)));
  const gy = Math.max(0, Math.min(CH - 1, Math.round((y / VIEW.h) * CH)));
  const k = gy * CW + gx;
  if (!maskC[k]) continue;
  const own = scoreOf(st.id);
  comfort.cOverall[k] = own.overall;
  comfort.cSummer[k] = own.summer;
  comfort.cWinter[k] = own.winter;
  comfort.cSunny[k] = own.sunny;
  comfort.cDry[k] = own.dry;
  comfort.cCalm[k] = own.calm;
}

for (const k of COMFORT_KEYS) {
  const [lo, hi] = range(comfort[k]);
  console.log(`  宜居·${k}: ${lo.toFixed(1)}–${hi.toFixed(1)} 分`);
}

/* ─────────── 探针数据:在地图上任意位置读数 ─────────── */

const PW = Math.ceil(CW / 2);
const PH = Math.ceil(CH / 2);
const PROBE_FIELDS = [
  { key: "inMask", type: "u8", scale: 1, label: "", unit: "" },
  { key: "cOverall", type: "u8", scale: 1, label: "综合宜居", unit: "分" },
  { key: "cSummer", type: "u8", scale: 1, label: "避暑", unit: "分" },
  { key: "cWinter", type: "u8", scale: 1, label: "避寒", unit: "分" },
  { key: "cSunny", type: "u8", scale: 1, label: "多日照", unit: "分" },
  { key: "cDry", type: "u8", scale: 1, label: "少雨", unit: "分" },
  { key: "cCalm", type: "u8", scale: 1, label: "怕风", unit: "分" },
  { key: "elev", type: "u16", scale: 1, label: "海拔", unit: "m" },
  { key: "tJan", type: "i16", scale: 0.1, label: "1 月均温", unit: "℃" },
  { key: "tJul", type: "i16", scale: 0.1, label: "7 月均温", unit: "℃" },
];
const PROBE_BYTES = { u8: 1, u16: 2, i16: 2 };
{
  const size = PW * PH * PROBE_FIELDS.reduce((s, f) => s + PROBE_BYTES[f.type], 0);
  const bin = Buffer.alloc(size);
  let off = 0;
  // 按格交错存放(每格内依次是各字段),读取端一格一格顺序扫即可。
  for (let gy = 0; gy < PH; gy++) {
    for (let gx = 0; gx < PW; gx++) {
      const cx = Math.min(CW - 1, gx * 2);
      const cy = Math.min(CH - 1, gy * 2);
      const k = cy * CW + cx;
      for (const f of PROBE_FIELDS) {
        let raw = 0;
        if (f.key === "inMask") raw = maskC[k] ? 1 : 0;
        else if (f.key === "elev") raw = Math.max(0, Math.min(65535, Math.round(demC[k])));
        else if (f.key === "tJan") raw = tM[0][k] < -1000 ? 0 : Math.round(tM[0][k] / f.scale);
        else if (f.key === "tJul") raw = tM[6][k] < -1000 ? 0 : Math.round(tM[6][k] / f.scale);
        else raw = Math.max(0, Math.min(100, Math.round(comfort[f.key][k])));
        // 注意:16 位字段要占两个字节,偏移得显式 +2,不能靠 off++。
        if (f.type === "u8") {
          bin.writeUInt8(raw, off);
          off += 1;
        } else if (f.type === "u16") {
          bin.writeUInt16LE(raw, off);
          off += 2;
        } else {
          bin.writeInt16LE(raw, off);
          off += 2;
        }
      }
    }
  }
  const meta = {
    w: PW,
    h: PH,
    cw: CW,
    ch: CH,
    cell: 2,
    fields: PROBE_FIELDS.map((f) => ({ key: f.key, type: f.type, scale: f.scale, label: f.label, unit: f.unit })),
  };
  const metaBuf = Buffer.from(JSON.stringify(meta), "utf8");
  const head = Buffer.alloc(4);
  head.writeUInt32LE(metaBuf.length, 0);
  const file = path.join(ROOT, "public/atlas/probe.bin");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([head, metaBuf, bin]));
  console.log(`✓ probe.bin ${PW}×${PH} · ${(size / 1024).toFixed(0)} KB`);
}

/** 宜居度面的等值线间隔:跨度大就用 5 分一档,窄了再细一档。 */
const comfortStep = (lo, hi) => {
  const span = hi - lo;
  if (span >= 30) return 5;
  if (span >= 14) return 2.5;
  return 1;
};

const fields = [
  { key: "tJan", group: "temp", label: "1 月均温", unit: "℃", coarse: 4, step: niceStep(...range(tJan), T_STEPS) },
  { key: "tJul", group: "temp", label: "7 月均温", unit: "℃", coarse: 4, step: niceStep(...range(tJul), T_STEPS) },
  { key: "tYear", group: "temp", label: "年均温", unit: "℃", coarse: 4, step: niceStep(...range(tYear), T_STEPS) },
  { key: "pYear", group: "rain", label: "年降水量", unit: "mm", coarse: 12, step: niceStep(...range(pYear), P_STEPS) },
  { key: "pWet", group: "rain", label: "雨季降水", unit: "mm", coarse: 12, step: niceStep(...range(pWet), P_STEPS) },
  { key: "pDry", group: "rain", label: "干季降水", unit: "mm", coarse: 12, step: niceStep(...range(pDry), P_STEPS) },
  { key: "pop", group: "pop", label: "人口规模", unit: "万人", coarse: 9, step: niceStep(...range(pop), POP_STEPS) },
  { key: "cOverall", group: "comfort", label: "综合宜居", unit: "分", coarse: 4, step: comfortStep(...range(comfort.cOverall)) },
  { key: "cSummer", group: "comfort", label: "避暑", unit: "分", coarse: 4, step: comfortStep(...range(comfort.cSummer)) },
  { key: "cWinter", group: "comfort", label: "避寒", unit: "分", coarse: 4, step: comfortStep(...range(comfort.cWinter)) },
  { key: "cSunny", group: "comfort", label: "多日照", unit: "分", coarse: 4, step: comfortStep(...range(comfort.cSunny)) },
  { key: "cDry", group: "comfort", label: "少雨", unit: "分", coarse: 4, step: comfortStep(...range(comfort.cDry)) },
  { key: "cCalm", group: "comfort", label: "怕风", unit: "分", coarse: 4, step: comfortStep(...range(comfort.cCalm)) },
];

const fieldGridRef = { tJan, tJul, tYear, pYear, pWet, pDry, pop, ...comfort };
const fieldData = {};
const fieldBands = {};
const fieldLevels = {};
for (const f of fields) {
  const isComfort = f.group === "comfort";
  const gridRef = fieldGridRef[f.key];
  const dsOverride = isComfort ? { data: gridRef, w: CW, h: CH, mask: maskC } : undefined;
  fieldData[f.key] = buildField(f.key, gridRef, f.step, f.coarse, dsOverride);
  fieldBands[f.key] = writeFieldImage(f, gridRef, dsOverride);
  fieldLevels[f.key] = levelsFor(gridRef, f.step);
}

/* 输出 TS */
const L = [];
L.push("/**");
L.push(" * 云南等值线图册数据(自动生成,勿手改)。");
L.push(" *");
L.push(" * 生成脚本:scripts/build-yunnan-atlas.mjs");
L.push(" * 边界:阿里 DataV GeoAtlas 省级边界;高程:AWS Terrain Tiles。");
L.push(" * 投影:阿尔伯斯等积圆锥(双标准纬线 25°N / 47°N,中央经线 105°E),再线性装进 viewBox。");
L.push(" * 等值线由 marching squares 在栅格上抽取后串成折线并做 Douglas–Peucker 简化;");
L.push(" * 每条折线用扁平数组 [x0, y0, x1, y1, …] 存放,省掉一半括号。");
L.push(" */");
L.push("");
L.push(`export const VIEW = ${JSON.stringify(VIEW)};`);
L.push("");
L.push("/** 经纬度 → viewBox:x = X * s + tx,y = ty - Y * s。 */");
L.push(`export const PROJ = ${JSON.stringify({ s, tx, ty })};`);
L.push("");
L.push("/** 一条等值线:数值 + 若干折线(扁平坐标)。 */");
L.push("export interface IsoLine {");
L.push("  v: number;");
L.push("  segs: number[][];");
L.push("}");
L.push("");
L.push("/** 云南边界(含少量岛屿)。 */");
L.push(`export const BORDER = ${JSON.stringify(borderD)};`);
L.push("");
L.push(`/** 等高线,每 ${ELEV_STEP} m 一档。 */`);
L.push(`export const CONTOURS: IsoLine[] = ${JSON.stringify(contours)};`);
L.push("");
L.push("/** 专题等值线。 */");
L.push(`export const FIELD_LINES: Record<string, IsoLine[]> = ${JSON.stringify(fieldData)};`);
L.push("");
L.push("/** 各专题的元信息(间隔、单位、取值范围),图例直接用。 */");
L.push(
  `export const FIELD_META: Record<string, { group: string; label: string; unit: string; step: number; min: number; max: number }> = ${JSON.stringify(
    Object.fromEntries(
      fields.map((f) => {
        const [lo, hi] = range(fieldGridRef[f.key]);
        return [f.key, { group: f.group, label: f.label, unit: f.unit, step: f.step, min: Math.round(lo), max: Math.round(hi) }];
      }),
    ),
  )};`,
);
L.push("/** 各专题的分层设色色带(自低到高),图例的色条直接用。 */");
L.push(`export const BAND_COLORS: Record<string, string[]> = ${JSON.stringify(fieldBands)};`);
L.push("");
L.push("/** 各专题的等值线档位(自低到高),用于把一个数值落到对应的色带上。 */");
L.push(`export const FIELD_LEVELS: Record<string, number[]> = ${JSON.stringify(fieldLevels)};`);
L.push("");
L.push("/** 各专题的原始色带(连续渐变端点),城市点色与图面色带用同一套颜色。 */");
L.push(`export const RAMPS: Record<string, string[]> = ${JSON.stringify(RAMPS)};`);
L.push("");
L.push("/** 地势分层设色的色带与分档高程(m),与底图 PNG 一致。 */");
L.push(`export const RELIEF_RAMP = ${JSON.stringify(HYPSO.map(([e, c]) => ({ e, color: `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}` })))};`);
L.push("");
L.push("");

fs.mkdirSync(path.dirname(OUT_TS), { recursive: true });
fs.writeFileSync(OUT_TS, L.join("\n"));
console.log(`✓ yunnan.ts ${(fs.statSync(OUT_TS).size / 1024).toFixed(0)} KB`);
