/**
 * 由 12 个月气温序列派生的旅居参考指标。
 */
import type { MonthlyTemp } from "./types";

export interface ClimateStats {
  /** 全年月均温的平均值。 */
  annualMean: number;
  /** 最热月(按月均温)。 */
  hottest: { m: number; mean: number };
  /** 最冷月(按月均温)。 */
  coldest: { m: number; mean: number };
  /** 月均温极差 = 最热月均温 − 最冷月均温。 */
  annualRange: number;
  /** 平均昼夜温差 = 各月(最高 − 最低)的平均。 */
  diurnalRange: number;
  /** 宜居月数:月均温落在 15–25 ℃ 的月份数。 */
  livableMonths: number;
  /** 避暑指数:6–8 月平均月均温 ℃,越低越凉爽。 */
  summerIndex: number;
  /** 避寒指数:12 月与 1、2 月平均月均温 ℃,越高越暖和。 */
  winterIndex: number;
}

export function computeStats(months: MonthlyTemp[]): ClimateStats {
  const n = months.length;
  const annualMean = months.reduce((s, m) => s + m.mean, 0) / n;

  let hottest = months[0];
  let coldest = months[0];
  for (const m of months) {
    if (m.mean > hottest.mean) hottest = m;
    if (m.mean < coldest.mean) coldest = m;
  }

  const diurnalRange = months.reduce((s, m) => s + (m.max - m.min), 0) / n;

  // 宜居月:月均温处于 15–25 ℃ 的舒适区间。
  const livableMonths = months.filter((m) => m.mean >= 15 && m.mean <= 25).length;

  // 6–8 月(索引 5–7)与 12、1、2 月(索引 11、0、1)的月均温均值。
  const meanOf = (idx: number[]) => idx.reduce((s, i) => s + months[i].mean, 0) / idx.length;
  const summerIndex = meanOf([5, 6, 7]);
  const winterIndex = meanOf([11, 0, 1]);

  return {
    annualMean,
    hottest: { m: hottest.m, mean: hottest.mean },
    coldest: { m: coldest.m, mean: coldest.mean },
    annualRange: hottest.mean - coldest.mean,
    diurnalRange,
    livableMonths,
    summerIndex,
    winterIndex,
  };
}
