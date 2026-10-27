/**
 * 旅居宜居评分:把「30 年逐月气温」与「近年逐月环境(湿度 / 雨日 / 日照 / 风 / 高温 / 霜冻)」
 * 融合成一套可解释的舒适度模型,用于排行与单城舒适度日历。
 *
 * 设计原则:
 *   - 纯函数、完全可复现,界面只负责展示,不在此做取舍。
 *   - 每个维度都归一到 0–100,100 代表「最宜居」;权重视最终舒适度。
 *   - 气温用 30 年均值(稳定),体感 / 湿度 / 风雨用近年口径(界面须标注两段时间)。
 */
import type { CityClimate, CityId, MonthlyTemp } from "./types";
import { MONTHLY_ENV, type MonthlyEnv } from "./env";
import { CLIMATES, climateOf } from "./cities";
import { FACTS, type CityFacts } from "./archive";
import { computeStats } from "./stats";

export type ClimateDim = "overall" | "summer" | "winter" | "sunny" | "dry" | "calm";

/** 排行榜支持的排序维度:气候六项 + 三项规则换算的非气候指标。 */
export type DimKey = ClimateDim | "cost" | "safety" | "convenience";

const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ---------- 各子项 0–100 评分 ---------- */

/**
 * 气温舒适度:以月均温为输入,16–24 ℃ 为舒适平台,过冷 / 过热线性衰减。
 * 导出的子项评分同时被图册构建脚本使用,保证「地图上的连续面」与「榜单上的离散分数」
 * 来自同一套算法,不会各说各话。
 */
export function thermal(t: number): number {
  if (t >= 16 && t <= 24) return 100;
  if (t < 16) {
    if (t >= 10) return lerp(100, 60, (16 - t) / 6);
    return clamp(lerp(60, 0, (10 - t) / 10)); // 10 ℃→60,0 ℃→0
  }
  // t > 24
  if (t <= 30) return lerp(100, 55, (t - 24) / 6);
  return clamp(lerp(55, 0, (t - 30) / 5)); // 35 ℃→0
}

/** 相对湿度舒适度:40–65 % 最佳,过湿黏腻、过干可接受。 */
export function humidity(h: number): number {
  if (h < 35) return 70;
  if (h <= 65) return 100;
  if (h <= 80) return lerp(100, 55, (h - 65) / 15);
  return clamp(lerp(55, 0, (h - 80) / 15));
}

/** 雨日舒适度:月雨日(≥1 mm)越少越便于户外生活。 */
export function rainDayScore(d: number): number {
  if (d <= 8) return 100;
  if (d <= 16) return lerp(100, 70, (d - 8) / 8);
  if (d <= 24) return lerp(70, 35, (d - 16) / 8);
  return clamp(lerp(35, 0, (d - 24) / 6));
}

/** 日照舒适度:月日照时数越多越好(下限给 40,避免阴城直接归零)。 */
export function sunScore(s: number): number {
  return clamp(lerp(40, 100, (s - 150) / (300 - 150)), 40, 100);
}

/** 大风舒适度:月强阵风日(≥6 级)越少越舒适。 */
export function windScore(w: number): number {
  if (w <= 5) return 100;
  if (w <= 15) return lerp(100, 70, (w - 5) / 10);
  if (w <= 25) return lerp(70, 35, (w - 15) / 10);
  return clamp(lerp(35, 0, (w - 25) / 10));
}

/** 酷热舒适度:月最高温 >30 ℃ 天数越少越好。 */
export function heatScore(h: number): number {
  if (h <= 1) return 100;
  if (h <= 10) return lerp(100, 60, (h - 1) / 9);
  if (h <= 25) return lerp(60, 20, (h - 10) / 15);
  return clamp(lerp(20, 0, (h - 25) / 10));
}

/** 霜冻舒适度:月霜冻(<0 ℃)天数越少越好。 */
export function frostScore(f: number): number {
  if (f <= 1) return 100;
  if (f <= 5) return lerp(100, 50, (f - 1) / 4);
  return clamp(lerp(50, 0, (f - 5) / 10));
}

/* ---------- 非气候三项:由城市事实值按规则换算 ----------
 * 规则写在函数注释里,输入只有 archive.ts 的事实值,不掺主观调分。 */

/**
 * 物价:房租越低分越高。以 10 元/㎡·月 为满分基准,每高 1 元扣 3 分,
 * 90 元/㎡·月(深圳)归零——这个斜率让 10–35 元的常见区间仍有区分度。
 */
export function costScore(rent: number): number {
  return clamp(Math.round(100 - (rent - 10) * 3));
}

/**
 * 安全:满分 100,按地震活跃度、台风、地质灾害三类风险扣分。
 * 地震是最主要的风险来源(云南多数城市都在断裂带附近)。
 */
export function safetyScore(f: CityFacts): number {
  const seismicPenalty = [0, 15, 32][f.seismic];
  return clamp(100 - seismicPenalty - (f.typhoon ? 18 : 0) - (f.geoHazard ? 8 : 0));
}

/**
 * 便利:县城基本生活服务打底 40 分,有机场 +22、有铁路客运 +18、
 * 每有一家三级医院 +6(最多 +20)。上限刚好 100。
 */
export function convenienceScore(f: CityFacts): number {
  return clamp(40 + (f.airport ? 22 : 0) + (f.rail ? 18 : 0) + Math.min(20, f.hospitals * 6));
}

/* ---------- 权重 ---------- */

/**
 * 十项要素的权重:气候七项 + 物价 / 安全 / 便利。
 * 数值只需保持相对比例(界面上是 0–100 的滑块),合成前统一归一到合计 1。
 */
export interface ComfortWeights {
  thermal: number;
  rain: number;
  humidity: number;
  wind: number;
  heat: number;
  frost: number;
  sun: number;
  cost: number;
  safety: number;
  convenience: number;
}

/**
 * 默认权重:气候占大头(气候七项合计 100),非气候合计 18,
 * 即默认综合分约 85% 看气候、15% 看物价 / 安全 / 便利。
 */
export const DEFAULT_WEIGHTS: ComfortWeights = {
  thermal: 38,
  rain: 20,
  humidity: 14,
  wind: 8,
  heat: 8,
  frost: 6,
  sun: 6,
  cost: 8,
  safety: 4,
  convenience: 6,
};

const weightSum = (w: ComfortWeights) =>
  w.thermal + w.rain + w.humidity + w.wind + w.heat + w.frost + w.sun + w.cost + w.safety + w.convenience;

/** 归一化全部十项;全为 0 时回落到默认,避免除零。 */
export function normalizedWeights(w: ComfortWeights): ComfortWeights {
  const sum = weightSum(w);
  if (sum <= 0) return normalizedWeights(DEFAULT_WEIGHTS);
  return {
    thermal: w.thermal / sum,
    rain: w.rain / sum,
    humidity: w.humidity / sum,
    wind: w.wind / sum,
    heat: w.heat / sum,
    frost: w.frost / sum,
    sun: w.sun / sum,
    cost: w.cost / sum,
    safety: w.safety / sum,
    convenience: w.convenience / sum,
  };
}

/** 只归一化气候七项:逐月舒适度始终是 0–100 的纯气候分,不受非气候权重稀释。 */
function normalizedClimateWeights(w: ComfortWeights): ComfortWeights {
  const sum = w.thermal + w.rain + w.humidity + w.wind + w.heat + w.frost + w.sun;
  if (sum <= 0) return normalizedClimateWeights(DEFAULT_WEIGHTS);
  return {
    ...w,
    thermal: w.thermal / sum,
    rain: w.rain / sum,
    humidity: w.humidity / sum,
    wind: w.wind / sum,
    heat: w.heat / sum,
    frost: w.frost / sum,
    sun: w.sun / sum,
  };
}

/** 计算某个月舒适度所需的原始要素(任何来源都可以喂进来:站点、插值栅格……)。 */
export interface ComfortInputs {
  /** 月均温 ℃(30 年口径)。 */
  temp: number;
  /** 相对湿度 %。 */
  hum: number;
  /** 月雨日数(≥1 mm)。 */
  rainDays: number;
  /** 月日照时数 h。 */
  sun: number;
  /** 月强阵风日数(≥6 级)。 */
  windyDays: number;
  /** 月 >30 ℃ 天数。 */
  hot30: number;
  /** 月霜冻(<0 ℃)天数。 */
  frost: number;
}

/** 单月舒适度的各子项明细。 */
export interface ComfortBreakdown {
  /** 加权总分 0–100。 */
  score: number;
  thermal: number;
  humidity: number;
  rain: number;
  sun: number;
  wind: number;
  heat: number;
  frost: number;
}

/**
 * 单月舒适度:把七项要素按权重合成 0–100 分。
 * 城市评分与图册上的连续宜居度面都调用这一个函数。
 */
export function comfortOf(i: ComfortInputs, weights: ComfortWeights = DEFAULT_WEIGHTS): ComfortBreakdown {
  const thermal = thermalScore(i.temp);
  const humidity = humidityScore(i.hum);
  const rain = rainDayScore(i.rainDays);
  const sun = sunScore(i.sun);
  const wind = windScore(i.windyDays);
  const heat = heatScore(i.hot30);
  const frost = frostScore(i.frost);
  const w = normalizedClimateWeights(weights);
  const score =
    thermal * w.thermal + rain * w.rain + humidity * w.humidity + wind * w.wind + heat * w.heat + frost * w.frost + sun * w.sun;
  return {
    score: Math.round(score * 10) / 10,
    thermal: Math.round(thermal),
    humidity: Math.round(humidity),
    rain: Math.round(rain),
    sun: Math.round(sun),
    wind: Math.round(wind),
    heat: Math.round(heat),
    frost: Math.round(frost),
  };
}

// 内部别名,避免与 MonthlyEnv 的字段名混淆。
const thermalScore = thermal;
const humidityScore = humidity;

export interface MonthComfort {
  m: number;
  temp: number; // 月均温(30 年)
  feels: number; // 月体感(近年)
  score: number; // 综合舒适度 0–100
  thermal: number;
  humidity: number;
  rain: number;
  sun: number;
  wind: number;
  heat: number;
  frost: number;
}

export interface CityScore {
  id: CityId;
  name: string;
  region: string;
  elevation: number;
  /** 气候综合指数 0–100(全年逐月舒适度均值,不含非气候项)。 */
  climate: number;
  /** 综合宜居指数 0–100:气候分与非气候三项按当前权重合成。 */
  overall: number;
  /** 物价 0–100,越高越便宜。 */
  cost: number;
  /** 安全 0–100,越高风险越低。 */
  safety: number;
  /** 便利 0–100,医疗与交通通达度。 */
  convenience: number;
  /** 舒适度 ≥75 的月份数。 */
  goodMonths: number;
  /** 避暑:6–8 月舒适度均值。 */
  summer: number;
  /** 避寒:12、1、2 月舒适度均值。 */
  winter: number;
  /** 多日照:全年日照评分均值。 */
  sunny: number;
  /** 少雨:全年雨日评分均值(越高越干爽)。 */
  dry: number;
  /** 怕风:全年大风评分均值(越高越安稳)。 */
  calm: number;
  /** 气候分型标签(按气温)。 */
  climateTag: string;
  /** 降水格局标签。 */
  rainTag: string;
  /** 最佳旅居时段文字描述。 */
  bestWindow: string;
  months: MonthComfort[];
}

/** 单个城市的逐月舒适度与各维度评分。 */
export function scoreCity(
  climate: CityClimate,
  env: MonthlyEnv[],
  weights: ComfortWeights = DEFAULT_WEIGHTS,
): CityScore {
  const months: MonthComfort[] = climate.months.map((mt: MonthlyTemp, i) => {
    const e = env[i];
    const c = comfortOf(
      {
        temp: mt.mean,
        hum: e.hum,
        rainDays: e.rainDays,
        sun: e.sun,
        windyDays: e.windyDays,
        hot30: e.hot30,
        frost: e.frost,
      },
      weights,
    );
    return {
      m: mt.m,
      temp: mt.mean,
      feels: e.feels,
      score: c.score,
      thermal: c.thermal,
      humidity: c.humidity,
      rain: c.rain,
      sun: c.sun,
      wind: c.wind,
      heat: c.heat,
      frost: c.frost,
    };
  });

  const avg = (sel: (x: MonthComfort) => number) =>
    Math.round((months.reduce((s, x) => s + sel(x), 0) / 12) * 10) / 10;

  const climateScore = avg((x) => x.score);
  const facts = FACTS[climate.id];
  const cost = costScore(facts.rent);
  const safety = safetyScore(facts);
  const convenience = convenienceScore(facts);

  // 综合分 = 气候分与非气候三项按归一后的权重加权;气候七项内部的归一已在 comfortOf 里做过。
  const w = normalizedWeights(weights);
  const climateShare = w.thermal + w.rain + w.humidity + w.wind + w.heat + w.frost + w.sun;
  const overall =
    Math.round(
      (climateScore * climateShare + cost * w.cost + safety * w.safety + convenience * w.convenience) * 10,
    ) / 10;

  const goodMonths = months.filter((x) => x.score >= 75).length;
  const summer = Math.round(
    ((months[5].score + months[6].score + months[7].score) / 3) * 10,
  ) / 10;
  const winter = Math.round(
    ((months[11].score + months[0].score + months[1].score) / 3) * 10,
  ) / 10;
  const sunny = avg((x) => x.sun);
  const dry = avg((x) => x.rain);
  const calm = avg((x) => x.wind);

  const stats = computeStats(climate.months);
  const climateTag = classifyClimate(stats.annualMean, stats.annualRange, stats.summerIndex, stats.winterIndex);
  const rainTag = classifyRain(env);
  const bestWindow = bestWindowText(months.map((x) => x.score));

  return {
    id: climate.id,
    name: climate.name,
    region: climate.region,
    elevation: climate.elevation,
    climate: climateScore,
    overall,
    cost,
    safety,
    convenience,
    goodMonths,
    summer,
    winter,
    sunny,
    dry,
    calm,
    climateTag,
    rainTag,
    bestWindow,
    months,
  };
}

/** 气温主导的气候分型。 */
function classifyClimate(annualMean: number, range: number, summer: number, winter: number): string {
  if (range <= 16 && annualMean >= 13 && annualMean <= 21) return "四季如春";
  if (winter < 7) return "冬寒夏凉";
  if (summer > 27 && winter >= 12) return "夏热冬暖";
  if (summer <= 22 && winter >= 9) return "夏凉冬温";
  if (annualMean < 12) return "冷凉高地";
  if (range >= 18) return "四季分明";
  return "温和";
}

/** 降水格局分型。 */
function classifyRain(env: MonthlyEnv[]): string {
  const wet = [4, 5, 6, 7, 8, 9].map((i) => env[i].rainDays); // 5–10 月
  const dry = [10, 11, 0, 1, 2, 3].map((i) => env[i].rainDays); // 11–4 月
  const avg = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
  const all = avg(env.map((e) => e.rainDays));
  if (avg(wet) >= 18 && avg(dry) <= 7) return "干湿分明·雨季长";
  if (all <= 10) return "全年少雨";
  if (all >= 18) return "全年多雨";
  return "降水适中";
}

/** 找出舒适度 ≥70 的最长连续月份区间(允许跨年),生成文字。 */
function bestWindowText(scores: number[]): string {
  const ok = scores.map((s) => s >= 70);
  if (ok.every(Boolean)) return "全年皆宜";
  if (ok.every((b) => !b)) return "无明显舒适月";

  // 复制成双倍数组处理跨年连续。
  const ext = [...ok, ...ok];
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;
  for (let i = 0; i < ext.length; i++) {
    if (ext[i]) {
      if (curLen === 0) curStart = i;
      curLen++;
      if (curLen > bestLen && curLen <= 12) {
        bestLen = curLen;
        bestStart = curStart;
      }
    } else {
      curLen = 0;
    }
  }
  if (bestStart < 0 || bestLen === 0) return "分散舒适";
  const m = (idx: number) => ((idx % 12) + 1); // 1–12
  const from = m(bestStart);
  const to = m(bestStart + bestLen - 1);
  return bestLen >= 10 ? `${from}–${to}月(几乎全年)` : `${from}–${to}月`;
}

/** 全部城市的评分(按综合指数降序)。 */
export function scoreAll(list: CityClimate[] = CLIMATES, weights: ComfortWeights = DEFAULT_WEIGHTS): CityScore[] {
  return list
    .map((c) => scoreCity(c, MONTHLY_ENV[c.id], weights))
    .sort((a, b) => b.overall - a.overall);
}

/** 针对某一偏好维度排序(降序)。 */
export function rankBy(dim: DimKey, weights: ComfortWeights = DEFAULT_WEIGHTS): CityScore[] {
  const all = scoreAll(CLIMATES, weights);
  return all.sort((a, b) => b[dim] - a[dim]);
}

/** 维度元信息:供 UI 渲染分段控件与说明。 */
export const DIMENSIONS: Array<{ key: DimKey; label: string; desc: string }> = [
  { key: "overall", label: "综合", desc: "气候分与物价 / 安全 / 便利按当前权重合成" },
  { key: "summer", label: "避暑", desc: "6–8 月越凉快、越舒适越靠前" },
  { key: "winter", label: "避寒", desc: "12–2 月越温暖、越舒适越靠前" },
  { key: "sunny", label: "多日照", desc: "全年日照越充裕越靠前" },
  { key: "dry", label: "少雨", desc: "雨日越少、越干爽越靠前" },
  { key: "calm", label: "怕风", desc: "大风日越少、越安稳越靠前" },
  { key: "cost", label: "物价", desc: "房租中位数换算,越便宜越靠前(适合穷游)" },
  { key: "safety", label: "安全", desc: "按地震、台风、地质灾害风险扣分,越高越安心" },
  { key: "convenience", label: "便利", desc: "机场、铁路客运与三级医院按事实值折算" },
];

/** 取单城评分的便捷方法。 */
export function scoreOf(id: CityId, weights: ComfortWeights = DEFAULT_WEIGHTS): CityScore {
  return scoreCity(climateOf(id), MONTHLY_ENV[id], weights);
}
