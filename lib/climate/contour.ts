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

/**
 * 生成指定视野内的等高线。
 * @param zoom 期望的等高线栅格级别(建议 9–12);瓦片数超限时会自动降级。
 * @param interval 等高线间隔(米),如 300 / 500。
 */
export async function generateContours(opts: {
  bounds: ContourBounds;
  zoom: number;
  interval: number;
}): Promise<ContourLevel[]> {
  const { bounds, interval } = opts;

  let z = Math.min(Math.max(Math.round(opts.zoom), 6), 14);
  let range = tileRange(bounds, z);
  while ((range.x1 - range.x0 + 1) * (range.y1 - range.y0 + 1) > MAX_TILES && z > 6) {
    z -= 1;
    range = tileRange(bounds, z);
  }
  const nx = range.x1 - range.x0 + 1;
  const ny = range.y1 - range.y0 + 1;
  if (nx * ny > MAX_TILES) return [];

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

  // 预先算出每个小格的极值:只有跨过某条等值线的格子才需要参与计算,大幅省掉无用的遍历。
  const cw = w - 1;
  const ch = h - 1;
  const cellMin = new Float32Array(cw * ch);
  const cellMax = new Float32Array(cw * ch);
  let gMin = Infinity;
  let gMax = -Infinity;
  for (let j = 0; j < ch; j++) {
    for (let i = 0; i < cw; i++) {
      const a = grid[j * w + i];
      const b = grid[j * w + i + 1];
      const d = grid[(j + 1) * w + i];
      const c = grid[(j + 1) * w + i + 1];
      const mn = Math.min(a, b, c, d);
      const mx = Math.max(a, b, c, d);
      cellMin[j * cw + i] = mn;
      cellMax[j * cw + i] = mx;
      if (mn < gMin) gMin = mn;
      if (mx > gMax) gMax = mx;
    }
  }
  if (!Number.isFinite(gMin) || !Number.isFinite(gMax)) return [];

  const levels: number[] = [];
  for (let lv = Math.max(Math.ceil(gMin / interval) * interval, interval); lv <= gMax; lv += interval) {
    levels.push(lv);
  }

  const xOrigin = range.x0 * TILE_SIZE;
  const yOrigin = range.y0 * TILE_SIZE;
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
