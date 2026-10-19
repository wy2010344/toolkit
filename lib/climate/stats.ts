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

  return {
    annualMean,
    hottest: { m: hottest.m, mean: hottest.mean },
    coldest: { m: coldest.m, mean: coldest.mean },
    annualRange: hottest.mean - coldest.mean,
    diurnalRange,
  };
}
