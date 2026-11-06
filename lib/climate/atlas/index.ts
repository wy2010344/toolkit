/**
 * 多省图册数据注册表。
 *
 * 每省一套预生成数据(边界、等高线、专题等值线、色带与资源路径)。客户端按当前省份
 * 动态 import,一次只加载一份,避免把五省的等值线全部打进首屏。
 */

/** 一条等值线:数值 + 若干折线(扁平坐标)。 */
export interface IsoLine {
  v: number;
  segs: number[][];
}

export interface FieldMeta {
  group: string;
  label: string;
  unit: string;
  step: number;
  min: number;
  max: number;
}

export interface ReliefStop {
  e: number;
  color: string;
}

export interface AtlasAssets {
  /** 地势底图(分层设色 + 晕渲)。 */
  relief: string;
  /** 某专题的分层设色图。 */
  field: (key: string) => string;
  /** 逐格读数探针。 */
  probe: string;
}

/** 一个省的图册数据。 */
export interface AtlasModule {
  KEY: string;
  NAME: string;
  /** 是否有地震(断裂带 / 震中)数据。 */
  HAS_QUAKES: boolean;
  /** 参与插值的站点数(说明文字用)。 */
  STATION_COUNT: number;
  /** 人口等值线的州市种子点数。 */
  PREFECTURE_COUNT: number;
  ASSETS: AtlasAssets;
  VIEW: { w: number; h: number };
  /** 经纬度 → viewBox:x = X * s + tx,y = ty - Y * s。 */
  PROJ: { s: number; tx: number; ty: number };
  BORDER: string;
  CONTOURS: IsoLine[];
  FIELD_LINES: Record<string, IsoLine[]>;
  FIELD_META: Record<string, FieldMeta>;
  BAND_COLORS: Record<string, string[]>;
  FIELD_LEVELS: Record<string, number[]>;
  RAMPS: Record<string, string[]>;
  RELIEF_RAMP: ReliefStop[];
}

/** 图册覆盖的省份。顺序即界面切换顺序。 */
export const ATLAS_PROVINCES = [
  { key: "yunnan", name: "云南" },
  { key: "guangdong", name: "广东" },
  { key: "guangxi", name: "广西" },
  { key: "guizhou", name: "贵州" },
  { key: "sichuan", name: "四川" },
] as const;

export type AtlasProvince = (typeof ATLAS_PROVINCES)[number]["key"];

const LOADERS: Record<AtlasProvince, () => Promise<AtlasModule>> = {
  yunnan: () => import("./yunnan"),
  guangdong: () => import("./guangdong"),
  guangxi: () => import("./guangxi"),
  guizhou: () => import("./guizhou"),
  sichuan: () => import("./sichuan"),
};

export function loadAtlasData(province: AtlasProvince): Promise<AtlasModule> {
  return LOADERS[province]();
}
