/**
 * 等高线生成(纯算法,不依赖任何地图库)。
 *
 * 数据源:AWS Terrain Tiles(terrarium 编码的 PNG,免 key、公开可访问且带 CORS)。
 * 高程解码:elevation(m) = R * 256 + G + B / 256 - 32768。
 * 等值线用 marching squares 从高程栅格上提取,再按 Web Mercator 换算成经纬度折线。
 *
 * 说明:DEM 是栅格数据,只有放大到一定级别才有意义;本模块会限制单次抓取的瓦片数量,
 * 视野过大时自动降级到更低的缩放级别,仍然超限则直接放弃(返回空数组,避免卡顿)。
 */

const TILE_SIZE = 256;
/** 单次抓取的瓦片数上限(一个常见视口约 5×3 = 15 块,留些余量)。 */
const MAX_TILES = 24;
const R2D = 180 / Math.PI;
/** terrarium 编码里 -32768(纯黑像元)表示无数据,统计高程范围时要排除。 */
const NODATA = -1000;
const DEM_URL = (z: number, x: number, y: number) =>
  `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;

export interface ContourBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/** 一个高程档位对应的全部折线;每段折线是一串 [经度, 纬度]。 */
export interface ContourLevel {
  level: number;
  lines: Array<Array<[number, number]>>;
}

/** 经纬度 → Web Mercator 世界像素坐标(尺度 = 256 * 2^z)。 */
function worldX(lon: number, scale: number): number {
  return ((lon + 180) / 360) * scale;
}
function worldY(lat: number, scale: number): number {
  const s = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale;
}
/** 世界像素坐标 → 经纬度。 */
function lonOf(px: number, scale: number): number {
  return (px / scale) * 360 - 180;
}
function latOf(py: number, scale: number): number {
  const n = Math.PI * (1 - (2 * py) / scale);
  return Math.atan(Math.sinh(n)) * R2D;
}

function tileRange(bounds: ContourBounds, z: number) {
  const scale = TILE_SIZE * Math.pow(2, z);
  return {
    x0: Math.floor(worldX(bounds.west, scale) / TILE_SIZE),
    x1: Math.floor(worldX(bounds.east, scale) / TILE_SIZE),
    y0: Math.floor(worldY(bounds.north, scale) / TILE_SIZE),
    y1: Math.floor(worldY(bounds.south, scale) / TILE_SIZE),
  };
}

const tileCache = new Map<string, Float32Array>();

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // 该源返回 Access-Control-Allow-Origin: *,加了才能读像素
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`DEM 瓦片加载失败: ${url}`));
    img.src = url;
  });
}

/** 抓取并解码一块 terrarium DEM 瓦片,返回 256×256 的高程(米)。结果会缓存。 */
async function loadTile(z: number, x: number, y: number): Promise<Float32Array> {
  const key = `${z}/${x}/${y}`;
  const hit = tileCache.get(key);
  if (hit) return hit;

  const img = await loadImage(DEM_URL(z, x, y));
  const canvas = document.createElement("canvas");
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("无法创建 canvas 2d 上下文");
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, TILE_SIZE, TILE_SIZE);

  const out = new Float32Array(TILE_SIZE * TILE_SIZE);
  for (let i = 0; i < out.length; i++) {
    out[i] = data[i * 4] * 256 + data[i * 4 + 1] + data[i * 4 + 2] / 256 - 32768;
  }
  tileCache.set(key, out);
  return out;
}

/** 沿一条边线性插值出等值点的比例位置。 */
function frac(va: number, vb: number, level: number): number {
  const t = (level - va) / (vb - va);
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** 一块拼接好的 DEM 栅格,以及它覆盖的地理矩形。 */
interface DemGrid {
  grid: Float32Array;
  /** 栅格宽高(像素) */
  w: number;
  h: number;
  /** Web Mercator 尺度 = 256 * 2^z */
  scale: number;
  /** 栅格左上角在世界像素坐标里的位置 */
  xOrigin: number;
  yOrigin: number;
  /** 视野内的最低 / 最高高程(米),已排除无数据像元 */
  min: number;
  max: number;
}

/**
 * 抓取并拼接 DEM 栅格。等高线与分层设色共用这一份数据。
 * @returns 瓦片数超限(视野过大)时返回 null。
 */
async function buildGrid(bounds: ContourBounds, zoom: number): Promise<DemGrid | null> {
  // 视野太大时逐级降级,直到瓦片数进入上限(仍超限就放弃,避免一次性拉几十张图)。
  let z = Math.min(Math.max(Math.round(zoom), 6), 14);
  let range = tileRange(bounds, z);
  while ((range.x1 - range.x0 + 1) * (range.y1 - range.y0 + 1) > MAX_TILES && z > 6) {
    z -= 1;
    range = tileRange(bounds, z);
  }
  const nx = range.x1 - range.x0 + 1;
  const ny = range.y1 - range.y0 + 1;
  if (nx * ny > MAX_TILES) return null;

  const scale = TILE_SIZE * Math.pow(2, z);
  const w = nx * TILE_SIZE;
  const h = ny * TILE_SIZE;

  // 把若干瓦片拼成一整块栅格,这样等值线在瓦片接缝处也能连起来。
  const tiles = await Promise.all(
    Array.from({ length: nx * ny }, (_, k) =>
      loadTile(z, range.x0 + (k % nx), range.y0 + Math.floor(k / nx)),
    ),
  );
  const grid = new Float32Array(w * h);
  tiles.forEach((t, k) => {
    const ox = (k % nx) * TILE_SIZE;
    const oy = Math.floor(k / nx) * TILE_SIZE;
    for (let py = 0; py < TILE_SIZE; py++) {
      grid.set(t.subarray(py * TILE_SIZE, py * TILE_SIZE + TILE_SIZE), (oy + py) * w + ox);
    }
  });

  let min = Infinity;
  let max = -Infinity;
  for (let k = 0; k < grid.length; k++) {
    const v = grid[k];
    if (v < NODATA) continue; // 无数据像元不参与高程范围统计
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;

  return {
    grid,
    w,
    h,
    scale,
    xOrigin: range.x0 * TILE_SIZE,
    yOrigin: range.y0 * TILE_SIZE,
    min,
    max,
  };
}

/** 分层设色的浅色带,从低到高:浅绿 → 黄绿 → 浅黄 → 浅棕黄 → 浅棕 → 灰紫。 */
const FILL_RAMP: Array<[number, number, number]> = [
  [154, 191, 160],
  [196, 209, 150],
  [222, 208, 148],
  [219, 186, 143],
  [198, 156, 130],
  [186, 176, 196],
];
/** 填充的底色透明度(0–1),压得比较淡以便同时看清底图。 */
const FILL_ALPHA = 0.3;

/** 按 t(0–1)在色带上取色。 */
function rampColor(t: number): [number, number, number] {
  const x = Math.min(Math.max(t, 0), 1) * (FILL_RAMP.length - 1);
  const i = Math.min(Math.floor(x), FILL_RAMP.length - 2);
  const f = x - i;
  const a = FILL_RAMP[i];
  const b = FILL_RAMP[i + 1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

/** 一张覆盖整块 DEM 栅格的半透明分层设色图。 */
export interface ElevationFill {
  /** PNG data URL,透明度已烘进 alpha 通道 */
  dataUrl: string;
  /** 该图对应的地理矩形 */
  bounds: ContourBounds;
}

/**
 * 生成分层设色填充:每个像元按「高程落在哪个间隔档」着色,同一档即两条等高线之间的封闭区域,
 * 因此色块的边界与等高线严格重合。和等高线共用同一份 DEM 栅格。
 */
export async function generateElevationFill(opts: {
  bounds: ContourBounds;
  zoom: number;
  interval: number;
}): Promise<ElevationFill | null> {
  const g = await buildGrid(opts.bounds, opts.zoom);
  if (!g) return null;

  const { grid, w, h, scale, xOrigin, yOrigin, min, max } = g;
  const span = Math.max(max - min, 1);
  const alpha = Math.round(FILL_ALPHA * 255);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const image = ctx.createImageData(w, h);
  const px = image.data;
  // 先按档位算好颜色,避免逐像元重复插值(视野内档位数通常只有十几个)。
  const colorCache = new Map<number, [number, number, number]>();
  for (let k = 0; k < grid.length; k++) {
    const e = grid[k];
    if (e < NODATA) continue; // 无数据像元保持全透明
    const band = Math.floor(e / opts.interval) * opts.interval;
    let rgb = colorCache.get(band);
    if (!rgb) {
      rgb = rampColor((band - min) / span);
      colorCache.set(band, rgb);
    }
    const o = k * 4;
    px[o] = rgb[0];
    px[o + 1] = rgb[1];
    px[o + 2] = rgb[2];
    px[o + 3] = alpha;
  }
  ctx.putImageData(image, 0, 0);

  return {
    dataUrl: canvas.toDataURL("image/png"),
    bounds: {
      north: latOf(yOrigin, scale),
      south: latOf(yOrigin + h, scale),
      west: lonOf(xOrigin, scale),
      east: lonOf(xOrigin + w, scale),
    },
  };
}

/**
 * 生成指定视野内的等高线。
 * @param zoom 期望的等高线栅格级别(建议 9–12);瓦片数超限时会自动降级。
 * @param interval 等高线间隔(米),如 300 / 500 / 1000 / 1500 / 2000。
 */
export async function generateContours(opts: {
  bounds: ContourBounds;
  zoom: number;
  interval: number;
}): Promise<ContourLevel[]> {
  const { interval } = opts;
  const dem = await buildGrid(opts.bounds, opts.zoom);
  if (!dem) return [];
  const { grid, w, h, scale, xOrigin, yOrigin, min, max } = dem;

  // 预先算出每个小格的极值:只有跨过某条等值线的格子才需要参与计算,大幅省掉无用的遍历。
  const cw = w - 1;
  const ch = h - 1;
  const cellMin = new Float32Array(cw * ch);
  const cellMax = new Float32Array(cw * ch);
  for (let j = 0; j < ch; j++) {
    for (let i = 0; i < cw; i++) {
      const a = grid[j * w + i];
      const b = grid[j * w + i + 1];
      const d = grid[(j + 1) * w + i];
      const c = grid[(j + 1) * w + i + 1];
      cellMin[j * cw + i] = Math.min(a, b, c, d);
      cellMax[j * cw + i] = Math.max(a, b, c, d);
    }
  }

  const levels: number[] = [];
  for (let lv = Math.max(Math.ceil(min / interval) * interval, interval); lv <= max; lv += interval) {
    levels.push(lv);
  }

  const out: ContourLevel[] = [];

  for (const level of levels) {
    const segs: Array<Array<[number, number]>> = [];
    for (let j = 0; j < ch; j++) {
      for (let i = 0; i < cw; i++) {
        const k = j * cw + i;
        if (level <= cellMin[k] || level > cellMax[k]) continue;

        const a = grid[j * w + i];
        const b = grid[j * w + i + 1];
        const d = grid[(j + 1) * w + i];
        const c = grid[(j + 1) * w + i + 1];
        const code = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
        if (code === 0 || code === 15) continue;

        // 四个边上的等值点(格内像素坐标,左上为原点)
        const top: [number, number] = [i + frac(a, b, level), j];
        const right: [number, number] = [i + 1, j + frac(b, c, level)];
        const bottom: [number, number] = [i + frac(d, c, level), j + 1];
        const left: [number, number] = [i, j + frac(a, d, level)];

        switch (code) {
          case 1:
          case 14:
            segs.push([left, bottom]);
            break;
          case 2:
          case 13:
            segs.push([bottom, right]);
            break;
          case 3:
          case 12:
            segs.push([left, right]);
            break;
          case 4:
          case 11:
            segs.push([right, top]);
            break;
          case 6:
          case 9:
            segs.push([top, bottom]);
            break;
          case 7:
          case 8:
            segs.push([left, top]);
            break;
          // 5 / 10 是鞍点,用四角均值判断中心落在哪一侧,避免连错
          case 5:
            if ((a + b + c + d) / 4 > level) {
              segs.push([left, top], [bottom, right]);
            } else {
              segs.push([left, bottom], [top, right]);
            }
            break;
          case 10:
            if ((a + b + c + d) / 4 > level) {
              segs.push([top, right], [left, bottom]);
            } else {
              segs.push([top, left], [right, bottom]);
            }
            break;
        }
      }
    }

    if (segs.length) {
      out.push({
        level,
        lines: segs.map((seg) =>
          seg.map(([px, py]) => [lonOf(xOrigin + px, scale), latOf(yOrigin + py, scale)] as [number, number]),
        ),
      });
    }
  }

  return out;
}
