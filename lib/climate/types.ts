/**
 * 旅居气候对比模块的类型定义。
 */

/** 候选城市的稳定 id。 */
export type CityId =
  | "kunming"
  | "yuxi"
  | "mengzi"
  | "puer"
  | "yongren"
  | "chongqing"
  | "shenzhen"
  | "qujing"
  | "xingyi"
  | "renhe"
  | "lincang"
  | "baoshan"
  | "gejiu"
  | "yuanyang"
  | "lvchun"
  | "honghe"
  | "mojiang"
  | "yuanjiang"
  | "dali"
  | "tengchong"
  | "chuxiong"
  | "chengjiang"
  | "jianshui"
  | "shiping"
  | "mile"
  | "luxi"
  | "weishan"
  | "pingbian"
  | "jingdong"
  | "xichang";

/** 单个自然月的气温均值(单位 ℃)。 */
export interface MonthlyTemp {
  /** 月份,1–12。 */
  m: number;
  /** 月平均最高温。 */
  max: number;
  /** 月平均最低温。 */
  min: number;
  /** 月平均温。 */
  mean: number;
}

/** 城市静态信息。 */
export interface CityMeta {
  id: CityId;
  /** 中文名。 */
  name: string;
  /** 省 / 直辖市。 */
  region: string;
  /** 纬度(北纬为正)。 */
  lat: number;
  /** 经度(东经为正)。 */
  lon: number;
  /** 海拔(米),用于解释气温。 */
  elevation: number;
  /** 一句话气候印象。 */
  note: string;
}

/** 城市静态信息 + 完整的 12 个月气温序列。 */
export interface CityClimate extends CityMeta {
  months: MonthlyTemp[];
}
