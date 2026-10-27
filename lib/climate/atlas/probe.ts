/**
 * 探针:在地图上任意位置读出该点的气候。
 *
 * 连续宜居度面把「哪里适合住」变成了一张可以逐点读数的图——但地图本身的像素
 * 是不带数值的,读数得从旁边取。这里配套一个很小的二进制栅格:地图上任意一点
 * 的宜居度分项、海拔、1 月与 7 月均温,都能即时读出来。
 *
 * 数据由 scripts/build-yunnan-atlas.mjs 生成到 public/atlas/probe.bin:
 *   前 4 字节 = 头部 JSON 长度,其后是头部 JSON,再往后是二进制体。
 * 头部 JSON 描述网格尺寸与各字段的编码,客户端按它解析,不用把字段写死两遍。
 */

export interface ProbeFieldMeta {
  key: string;
  type: "u8" | "u16" | "i16";
  /** 解码时的乘数(值 = 原始整数 × scale)。 */
  scale: number;
  label: string;
  unit: string;
}

export interface ProbeMeta {
  /** 探针网格宽高。 */
  w: number;
  h: number;
  /** 粗网格宽高(舒适度面就是在这个分辨率上算的)。 */
  cw: number;
  ch: number;
  /** 探针格对应粗网格几格。 */
  cell: number;
  fields: ProbeFieldMeta[];
}

export interface Probe {
  meta: ProbeMeta;
  /** 读一格的所有字段;越界返回 null。 */
  at(gx: number, gy: number): Record<string, number> | null;
}

/** 加载并解析探针数据。 */
export async function loadProbe(url = "/atlas/probe.bin"): Promise<Probe> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`探针数据加载失败:HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const dv = new DataView(buf);
  const jsonLen = dv.getUint32(0, true);
  const meta = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, jsonLen))) as ProbeMeta;
  const body = new Uint8Array(buf, 4 + jsonLen);
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength);

  const offsets: number[] = [];
  let stride = 0;
  for (const f of meta.fields) {
    offsets.push(stride);
    stride += f.type === "u8" ? 1 : 2;
  }

  return {
    meta,
    at(gx, gy) {
      if (gx < 0 || gy < 0 || gx >= meta.w || gy >= meta.h) return null;
      const base = (gy * meta.w + gx) * stride;
      const out: Record<string, number> = {};
      for (let i = 0; i < meta.fields.length; i++) {
        const f = meta.fields[i];
        const o = base + offsets[i];
        const raw = f.type === "u8" ? view.getUint8(o) : f.type === "u16" ? view.getUint16(o, true) : view.getInt16(o, true);
        out[f.key] = raw * f.scale;
      }
      return out;
    },
  };
}
