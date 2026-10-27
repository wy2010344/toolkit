/**
 * 各城逐月环境与舒适度均值(2023–2025,共 3 年)。
 *
 * 数据源:Open-Meteo Historical Weather API(ERA5 再分析),timezone=Asia/Shanghai,
 * 逐日取 relative_humidity_2m_mean / precipitation_sum / sunshine_duration / cloud_cover_mean /
 * shortwave_radiation_sum / apparent_temperature_mean / wind_speed_10m_mean / wind_gusts_10m_max /
 * temperature_2m_max / temperature_2m_min,按自然月聚合。
 * 注意:受免费接口配额限制,本文件为「近年口径」,与 30 年气温(./data.ts)不同,界面须标注。
 * 重新获取可用:https://archive-api.open-meteo.com/v1/archive
 *
 * 求和类字段(降水、日照)与计数类字段(雨日、>30℃ 天数等)均已按覆盖年数归一,表示「平均每年该月」的量。
 * 每条为 12 个月,索引 0 对应一月。
 */
import type { CityId } from "./types";

/** 环境变量的时间口径说明。 */
export const ENV_PERIOD = "2023–2025 共 3 年,逐日聚合后按年平均";

/** 单个自然月的环境与舒适度均值。 */
export interface MonthlyEnv {
  /** 月份,1–12。 */
  m: number;
  /** 月平均体感温度 ℃(apparent temperature,含湿度与风的影响)。 */
  feels: number;
  /** 月平均相对湿度 %。 */
  hum: number;
  /** 平均每年该月降水总量 mm。 */
  precip: number;
  /** 平均每年该月雨日数(日降水 ≥ 1 mm)。 */
  rainDays: number;
  /** 平均每年该月大雨日数(日降水 ≥ 25 mm)。 */
  heavyRain: number;
  /** 平均每年该月日照小时数 h。 */
  sun: number;
  /** 月平均云量 %。 */
  cloud: number;
  /** 月平均日太阳短波辐射 MJ/m²(紫外线强弱的代理指标)。 */
  rad: number;
  /** 月平均风速 km/h。 */
  wind: number;
  /** 月平均日最大阵风 km/h。 */
  gust: number;
  /** 平均每年该月强阵风日数(日最大阵风 ≥ 39 km/h,约 6 级)。 */
  windyDays: number;
  /** 平均每年该月最高温 > 30 ℃ 的天数。 */
  hot30: number;
  /** 平均每年该月最低温 < 0 ℃ 的霜冻天数。 */
  frost: number;
}

export const MONTHLY_ENV: Record<CityId, MonthlyEnv[]> = {
  // 昆明
  kunming: [
    { m: 1, feels: 5.3, hum: 71, precip: 38, rainDays: 7.7, heavyRain: 0, sun: 247, cloud: 42, rad: 13.7, wind: 9.5, gust: 41, windyDays: 19, hot30: 0, frost: 3 },
    { m: 2, feels: 8.6, hum: 57, precip: 12, rainDays: 5.7, heavyRain: 0, sun: 267, cloud: 37, rad: 17.3, wind: 12.7, gust: 53, windyDays: 25, hot30: 0, frost: 0.3 },
    { m: 3, feels: 11.8, hum: 51, precip: 25, rainDays: 6.7, heavyRain: 0, sun: 307, cloud: 40, rad: 20, wind: 13.4, gust: 53, windyDays: 27.7, hot30: 0, frost: 0 },
    { m: 4, feels: 16.8, hum: 44, precip: 18, rainDays: 4.3, heavyRain: 0, sun: 339, cloud: 40, rad: 23.6, wind: 14.5, gust: 56, windyDays: 28, hot30: 1.3, frost: 0 },
    { m: 5, feels: 18.5, hum: 63, precip: 133, rainDays: 15.3, heavyRain: 1.3, sun: 319, cloud: 59, rad: 22.1, wind: 10.8, gust: 44, windyDays: 21, hot30: 4.3, frost: 0 },
    { m: 6, feels: 20.5, hum: 78, precip: 272, rainDays: 24.3, heavyRain: 2.3, sun: 274, cloud: 82, rad: 20.1, wind: 8.5, gust: 36, windyDays: 8.3, hot30: 1, frost: 0 },
    { m: 7, feels: 21.1, hum: 80, precip: 248, rainDays: 26.7, heavyRain: 0.3, sun: 307, cloud: 85, rad: 20.7, wind: 8.1, gust: 35, windyDays: 9.3, hot30: 0, frost: 0 },
    { m: 8, feels: 20.5, hum: 83, precip: 260, rainDays: 24, heavyRain: 1, sun: 302, cloud: 77, rad: 19.7, wind: 6.1, gust: 30, windyDays: 1.7, hot30: 0, frost: 0 },
    { m: 9, feels: 19.2, hum: 79, precip: 181, rainDays: 21.7, heavyRain: 0.7, sun: 294, cloud: 70, rad: 18.5, wind: 8, gust: 34, windyDays: 7.3, hot30: 0, frost: 0 },
    { m: 10, feels: 15.5, hum: 81, precip: 137, rainDays: 18, heavyRain: 0.7, sun: 251, cloud: 69, rad: 14.8, wind: 8, gust: 33, windyDays: 4.7, hot30: 0, frost: 0 },
    { m: 11, feels: 10.5, hum: 77, precip: 77, rainDays: 9.3, heavyRain: 0.3, sun: 221, cloud: 55, rad: 13.3, wind: 7.2, gust: 32, windyDays: 4, hot30: 0, frost: 0.7 },
    { m: 12, feels: 7.7, hum: 74, precip: 16, rainDays: 5, heavyRain: 0, sun: 242, cloud: 46, rad: 13.1, wind: 7.8, gust: 37, windyDays: 12, hot30: 0, frost: 0 },
  ],
  // 玉溪
  yuxi: [
    { m: 1, feels: 8.5, hum: 73, precip: 26, rainDays: 6, heavyRain: 0, sun: 242, cloud: 48, rad: 13.3, wind: 8, gust: 41, windyDays: 18, hot30: 0, frost: 0.3 },
    { m: 2, feels: 11.9, hum: 59, precip: 13, rainDays: 3.7, heavyRain: 0, sun: 271, cloud: 38, rad: 17.4, wind: 10.6, gust: 52, windyDays: 25.7, hot30: 0, frost: 0 },
    { m: 3, feels: 15.1, hum: 53, precip: 11, rainDays: 3, heavyRain: 0, sun: 306, cloud: 38, rad: 19.7, wind: 11, gust: 53, windyDays: 27.3, hot30: 0, frost: 0 },
    { m: 4, feels: 19.8, hum: 47, precip: 13, rainDays: 2.3, heavyRain: 0, sun: 336, cloud: 37, rad: 23.1, wind: 11.5, gust: 54, windyDays: 28.7, hot30: 11.7, frost: 0 },
    { m: 5, feels: 21.9, hum: 63, precip: 99, rainDays: 14.3, heavyRain: 0.3, sun: 323, cloud: 56, rad: 21.9, wind: 9.2, gust: 43, windyDays: 21, hot30: 9, frost: 0 },
    { m: 6, feels: 23.7, hum: 78, precip: 223, rainDays: 20.7, heavyRain: 2.7, sun: 282, cloud: 82, rad: 20, wind: 7, gust: 35, windyDays: 9.7, hot30: 2, frost: 0 },
    { m: 7, feels: 24.1, hum: 79, precip: 229, rainDays: 23, heavyRain: 2, sun: 313, cloud: 86, rad: 20.6, wind: 6.6, gust: 34, windyDays: 9.7, hot30: 1, frost: 0 },
    { m: 8, feels: 23.4, hum: 83, precip: 252, rainDays: 23.7, heavyRain: 1.7, sun: 305, cloud: 81, rad: 19.2, wind: 4.8, gust: 30, windyDays: 2.7, hot30: 0, frost: 0 },
    { m: 9, feels: 22.4, hum: 78, precip: 117, rainDays: 17.7, heavyRain: 0.7, sun: 302, cloud: 70, rad: 19, wind: 6.6, gust: 34, windyDays: 7, hot30: 0, frost: 0 },
    { m: 10, feels: 19, hum: 78, precip: 76, rainDays: 13, heavyRain: 0.3, sun: 264, cloud: 69, rad: 15.1, wind: 5.9, gust: 31, windyDays: 3.3, hot30: 0, frost: 0 },
    { m: 11, feels: 13.7, hum: 78, precip: 67, rainDays: 9.7, heavyRain: 0.3, sun: 227, cloud: 58, rad: 13.1, wind: 5.7, gust: 31, windyDays: 4.7, hot30: 0, frost: 0 },
    { m: 12, feels: 10.6, hum: 77, precip: 8, rainDays: 2, heavyRain: 0, sun: 238, cloud: 55, rad: 12.6, wind: 6.6, gust: 38, windyDays: 13.7, hot30: 0, frost: 0 },
  ],
  // 蒙自
  mengzi: [
    { m: 1, feels: 10.5, hum: 74, precip: 6, rainDays: 1.7, heavyRain: 0, sun: 256, cloud: 57, rad: 13.8, wind: 11.5, gust: 39, windyDays: 15.7, hot30: 0, frost: 0 },
    { m: 2, feels: 13.9, hum: 71, precip: 7, rainDays: 0.7, heavyRain: 0, sun: 253, cloud: 57, rad: 16.6, wind: 12.4, gust: 42, windyDays: 20.3, hot30: 0, frost: 0 },
    { m: 3, feels: 17.3, hum: 66, precip: 13, rainDays: 4, heavyRain: 0, sun: 305, cloud: 52, rad: 19.3, wind: 12.1, gust: 44, windyDays: 26.3, hot30: 1.7, frost: 0 },
    { m: 4, feels: 22.6, hum: 59, precip: 15, rainDays: 4.3, heavyRain: 0, sun: 327, cloud: 45, rad: 22.5, wind: 11.3, gust: 45, windyDays: 26, hot30: 17.7, frost: 0 },
    { m: 5, feels: 24.5, hum: 68, precip: 86, rainDays: 14.3, heavyRain: 0.3, sun: 319, cloud: 64, rad: 21.8, wind: 9.6, gust: 39, windyDays: 15.3, hot30: 11.3, frost: 0 },
    { m: 6, feels: 26.3, hum: 78, precip: 186, rainDays: 23.7, heavyRain: 1, sun: 284, cloud: 87, rad: 20.1, wind: 8, gust: 34, windyDays: 4.7, hot30: 4.7, frost: 0 },
    { m: 7, feels: 26.6, hum: 78, precip: 186, rainDays: 23.3, heavyRain: 0.7, sun: 311, cloud: 86, rad: 20.6, wind: 8, gust: 34, windyDays: 8, hot30: 7.3, frost: 0 },
    { m: 8, feels: 25.8, hum: 82, precip: 190, rainDays: 25.7, heavyRain: 0.7, sun: 284, cloud: 85, rad: 18.2, wind: 5.9, gust: 29, windyDays: 1, hot30: 1.7, frost: 0 },
    { m: 9, feels: 24.7, hum: 80, precip: 151, rainDays: 20, heavyRain: 1, sun: 275, cloud: 72, rad: 17.4, wind: 6.7, gust: 31, windyDays: 3, hot30: 1.3, frost: 0 },
    { m: 10, feels: 21.3, hum: 77, precip: 56, rainDays: 8.3, heavyRain: 0.7, sun: 277, cloud: 69, rad: 15.7, wind: 8.1, gust: 33, windyDays: 4, hot30: 0, frost: 0 },
    { m: 11, feels: 16.6, hum: 76, precip: 26, rainDays: 6.3, heavyRain: 0, sun: 245, cloud: 66, rad: 13.7, wind: 8.3, gust: 32, windyDays: 4, hot30: 0, frost: 0 },
    { m: 12, feels: 12.9, hum: 77, precip: 5, rainDays: 2, heavyRain: 0, sun: 257, cloud: 66, rad: 13, wind: 10.7, gust: 37, windyDays: 11.7, hot30: 0, frost: 0 },
  ],
  // 普洱
  puer: [
    { m: 1, feels: 12.8, hum: 75, precip: 37, rainDays: 6.3, heavyRain: 0, sun: 289, cloud: 33, rad: 15.1, wind: 8.9, gust: 33, windyDays: 5.7, hot30: 0, frost: 0 },
    { m: 2, feels: 15.7, hum: 61, precip: 29, rainDays: 5.3, heavyRain: 0.3, sun: 274, cloud: 31, rad: 18, wind: 9.5, gust: 40, windyDays: 14.7, hot30: 0, frost: 0 },
    { m: 3, feels: 18.7, hum: 54, precip: 23, rainDays: 6, heavyRain: 0, sun: 315, cloud: 29, rad: 19.3, wind: 9.8, gust: 44, windyDays: 21.3, hot30: 1, frost: 0 },
    { m: 4, feels: 22.9, hum: 50, precip: 41, rainDays: 6, heavyRain: 0, sun: 334, cloud: 33, rad: 21.7, wind: 10.1, gust: 46, windyDays: 25, hot30: 16, frost: 0 },
    { m: 5, feels: 24.1, hum: 72, precip: 188, rainDays: 17, heavyRain: 1.3, sun: 308, cloud: 55, rad: 20.7, wind: 8.8, gust: 37, windyDays: 10, hot30: 10.7, frost: 0 },
    { m: 6, feels: 25.3, hum: 86, precip: 357, rainDays: 28, heavyRain: 2.3, sun: 256, cloud: 88, rad: 18.9, wind: 7.9, gust: 32, windyDays: 3.7, hot30: 1.3, frost: 0 },
    { m: 7, feels: 25.5, hum: 87, precip: 425, rainDays: 28.7, heavyRain: 4, sun: 262, cloud: 91, rad: 18.2, wind: 6.8, gust: 30, windyDays: 1.7, hot30: 0.3, frost: 0 },
    { m: 8, feels: 24.7, hum: 90, precip: 412, rainDays: 30, heavyRain: 3, sun: 229, cloud: 92, rad: 16.4, wind: 5.8, gust: 28, windyDays: 1, hot30: 0.3, frost: 0 },
    { m: 9, feels: 24.3, hum: 86, precip: 244, rainDays: 25.3, heavyRain: 0.3, sun: 270, cloud: 77, rad: 17.5, wind: 6.1, gust: 28, windyDays: 2.3, hot30: 0.3, frost: 0 },
    { m: 10, feels: 21.7, hum: 85, precip: 164, rainDays: 23.3, heavyRain: 0.7, sun: 283, cloud: 64, rad: 15.9, wind: 6.6, gust: 26, windyDays: 0.7, hot30: 0, frost: 0 },
    { m: 11, feels: 17.2, hum: 83, precip: 89, rainDays: 13, heavyRain: 0, sun: 241, cloud: 53, rad: 13.8, wind: 6.8, gust: 26, windyDays: 1, hot30: 0, frost: 0 },
    { m: 12, feels: 14.9, hum: 81, precip: 39, rainDays: 8.3, heavyRain: 0, sun: 274, cloud: 43, rad: 13.9, wind: 8.1, gust: 30, windyDays: 2.3, hot30: 0, frost: 0 },
  ],
  // 永仁县
  yongren: [
    { m: 1, feels: 9.9, hum: 49, precip: 9, rainDays: 2, heavyRain: 0, sun: 298, cloud: 23, rad: 14.5, wind: 8.5, gust: 34, windyDays: 13.3, hot30: 0, frost: 0 },
    { m: 2, feels: 12.7, hum: 39, precip: 2, rainDays: 0.3, heavyRain: 0, sun: 301, cloud: 23, rad: 17.6, wind: 12.4, gust: 47, windyDays: 24.7, hot30: 0, frost: 0 },
    { m: 3, feels: 16.3, hum: 35, precip: 3, rainDays: 1.3, heavyRain: 0, sun: 328, cloud: 31, rad: 20.1, wind: 12.1, gust: 45, windyDays: 22.7, hot30: 4.7, frost: 0 },
    { m: 4, feels: 21.1, hum: 33, precip: 4, rainDays: 0.7, heavyRain: 0, sun: 346, cloud: 39, rad: 22.9, wind: 12.5, gust: 47, windyDays: 24, hot30: 22.3, frost: 0 },
    { m: 5, feels: 23.5, hum: 48, precip: 75, rainDays: 8.7, heavyRain: 0, sun: 327, cloud: 53, rad: 21.9, wind: 10.1, gust: 38, windyDays: 15.3, hot30: 19, frost: 0 },
    { m: 6, feels: 25.4, hum: 70, precip: 305, rainDays: 20.3, heavyRain: 3.3, sun: 291, cloud: 76, rad: 20.4, wind: 7.1, gust: 30, windyDays: 4, hot30: 8, frost: 0 },
    { m: 7, feels: 26.4, hum: 73, precip: 227, rainDays: 24.3, heavyRain: 1, sun: 320, cloud: 84, rad: 21, wind: 6.6, gust: 29, windyDays: 3.3, hot30: 9, frost: 0 },
    { m: 8, feels: 25.8, hum: 76, precip: 196, rainDays: 21, heavyRain: 0.7, sun: 311, cloud: 73, rad: 19.9, wind: 4.6, gust: 24, windyDays: 0, hot30: 2.7, frost: 0 },
    { m: 9, feels: 24.6, hum: 75, precip: 184, rainDays: 16.3, heavyRain: 0.7, sun: 306, cloud: 64, rad: 19, wind: 4.8, gust: 24, windyDays: 0, hot30: 2.3, frost: 0 },
    { m: 10, feels: 20.4, hum: 75, precip: 180, rainDays: 14.7, heavyRain: 2, sun: 282, cloud: 57, rad: 15.1, wind: 5, gust: 24, windyDays: 0.7, hot30: 1.3, frost: 0 },
    { m: 11, feels: 14.4, hum: 68, precip: 62, rainDays: 6.3, heavyRain: 1, sun: 262, cloud: 37, rad: 14.1, wind: 5, gust: 24, windyDays: 1, hot30: 0, frost: 0 },
    { m: 12, feels: 11.1, hum: 59, precip: 3, rainDays: 1, heavyRain: 0, sun: 286, cloud: 31, rad: 13.9, wind: 6.3, gust: 29, windyDays: 5.7, hot30: 0, frost: 0 },
  ],
  // 重庆
  chongqing: [
    { m: 1, feels: 6.8, hum: 81, precip: 37, rainDays: 9.3, heavyRain: 0, sun: 112, cloud: 75, rad: 6.7, wind: 5, gust: 18, windyDays: 0, hot30: 0, frost: 1.3 },
    { m: 2, feels: 8.3, hum: 77, precip: 29, rainDays: 9.3, heavyRain: 0, sun: 103, cloud: 79, rad: 8.4, wind: 5.6, gust: 21, windyDays: 0, hot30: 0, frost: 0 },
    { m: 3, feels: 13.7, hum: 78, precip: 88, rainDays: 15, heavyRain: 0, sun: 164, cloud: 76, rad: 11.3, wind: 6, gust: 23, windyDays: 1.3, hot30: 0, frost: 0 },
    { m: 4, feels: 21.4, hum: 79, precip: 210, rainDays: 18.3, heavyRain: 2.3, sun: 209, cloud: 76, rad: 14.9, wind: 6.1, gust: 25, windyDays: 2, hot30: 2, frost: 0 },
    { m: 5, feels: 25.5, hum: 79, precip: 187, rainDays: 19, heavyRain: 2.7, sun: 218, cloud: 73, rad: 16, wind: 5.8, gust: 24, windyDays: 1, hot30: 5.7, frost: 0 },
    { m: 6, feels: 29.2, hum: 81, precip: 193, rainDays: 15, heavyRain: 2.7, sun: 200, cloud: 70, rad: 15.3, wind: 5.3, gust: 22, windyDays: 0.3, hot30: 11.7, frost: 0 },
    { m: 7, feels: 34.7, hum: 78, precip: 287, rainDays: 15.3, heavyRain: 4.7, sun: 281, cloud: 68, rad: 18.8, wind: 6, gust: 26, windyDays: 1.3, hot30: 26.3, frost: 0 },
    { m: 8, feels: 35.3, hum: 69, precip: 134, rainDays: 12.3, heavyRain: 0.7, sun: 317, cloud: 55, rad: 19.5, wind: 6.2, gust: 27, windyDays: 1, hot30: 27.7, frost: 0 },
    { m: 9, feels: 31.4, hum: 72, precip: 167, rainDays: 13.7, heavyRain: 2.3, sun: 240, cloud: 59, rad: 15.2, wind: 6.2, gust: 26, windyDays: 3, hot30: 21, frost: 0 },
    { m: 10, feels: 21.8, hum: 82, precip: 164, rainDays: 18, heavyRain: 1, sun: 145, cloud: 75, rad: 9.3, wind: 5.3, gust: 20, windyDays: 0, hot30: 2.7, frost: 0 },
    { m: 11, feels: 14.9, hum: 85, precip: 81, rainDays: 14.7, heavyRain: 0, sun: 111, cloud: 75, rad: 7, wind: 4.9, gust: 19, windyDays: 0.3, hot30: 0, frost: 0 },
    { m: 12, feels: 8.5, hum: 83, precip: 33, rainDays: 7.7, heavyRain: 0, sun: 94, cloud: 79, rad: 5.9, wind: 4.4, gust: 19, windyDays: 0.3, hot30: 0, frost: 0 },
  ],
  // 深圳
  shenzhen: [
    { m: 1, feels: 13.6, hum: 65, precip: 27, rainDays: 5, heavyRain: 0, sun: 255, cloud: 48, rad: 13.1, wind: 11.8, gust: 32, windyDays: 4.7, hot30: 0, frost: 0 },
    { m: 2, feels: 16.7, hum: 74, precip: 16, rainDays: 4.3, heavyRain: 0, sun: 222, cloud: 59, rad: 14.4, wind: 11.5, gust: 32, windyDays: 2.7, hot30: 0, frost: 0 },
    { m: 3, feels: 19.9, hum: 76, precip: 74, rainDays: 11.3, heavyRain: 0, sun: 223, cloud: 65, rad: 14.9, wind: 11.6, gust: 35, windyDays: 6, hot30: 0.3, frost: 0 },
    { m: 4, feels: 25.8, hum: 84, precip: 289, rainDays: 17.3, heavyRain: 4, sun: 245, cloud: 74, rad: 16.7, wind: 11.5, gust: 36, windyDays: 10.7, hot30: 2.7, frost: 0 },
    { m: 5, feels: 29, hum: 84, precip: 239, rainDays: 20.7, heavyRain: 2.7, sun: 246, cloud: 80, rad: 17.3, wind: 10.5, gust: 33, windyDays: 7, hot30: 9, frost: 0 },
    { m: 6, feels: 32.4, hum: 87, precip: 282, rainDays: 26, heavyRain: 2, sun: 265, cloud: 88, rad: 18.1, wind: 10.4, gust: 35, windyDays: 6.7, hot30: 18, frost: 0 },
    { m: 7, feels: 33.8, hum: 84, precip: 270, rainDays: 25, heavyRain: 3, sun: 311, cloud: 74, rad: 19.7, wind: 10.2, gust: 33, windyDays: 4.7, hot30: 25.3, frost: 0 },
    { m: 8, feels: 33.2, hum: 86, precip: 309, rainDays: 26, heavyRain: 3.3, sun: 265, cloud: 80, rad: 17.6, wind: 8.8, gust: 31, windyDays: 5, hot30: 22.7, frost: 0 },
    { m: 9, feels: 32, hum: 86, precip: 382, rainDays: 23.7, heavyRain: 4, sun: 254, cloud: 72, rad: 16.3, wind: 9.6, gust: 33, windyDays: 5.3, hot30: 20, frost: 0 },
    { m: 10, feels: 27.3, hum: 75, precip: 94, rainDays: 10.3, heavyRain: 1, sun: 266, cloud: 58, rad: 15.4, wind: 11.7, gust: 33, windyDays: 7.3, hot30: 12.7, frost: 0 },
    { m: 11, feels: 21.2, hum: 68, precip: 62, rainDays: 6.7, heavyRain: 1.3, sun: 240, cloud: 58, rad: 13.6, wind: 11.3, gust: 33, windyDays: 6.3, hot30: 2, frost: 0 },
    { m: 12, feels: 16.3, hum: 65, precip: 9, rainDays: 2.3, heavyRain: 0, sun: 262, cloud: 50, rad: 12.7, wind: 10.4, gust: 31, windyDays: 4.3, hot30: 0, frost: 0 },
  ],
  // 曲靖
  qujing: [
    { m: 1, feels: 4.3, hum: 70, precip: 36, rainDays: 9.3, heavyRain: 0, sun: 223, cloud: 51, rad: 12.4, wind: 13.5, gust: 43, windyDays: 19, hot30: 0, frost: 4.7 },
    { m: 2, feels: 7.9, hum: 57, precip: 15, rainDays: 4.7, heavyRain: 0, sun: 262, cloud: 42, rad: 16.5, wind: 18.1, gust: 55, windyDays: 24.3, hot30: 0, frost: 0 },
    { m: 3, feels: 10.7, hum: 54, precip: 30, rainDays: 7, heavyRain: 0, sun: 295, cloud: 47, rad: 19.1, wind: 16.9, gust: 53, windyDays: 25.7, hot30: 0, frost: 0 },
    { m: 4, feels: 16.1, hum: 49, precip: 45, rainDays: 6.3, heavyRain: 0.3, sun: 318, cloud: 47, rad: 22.8, wind: 16.1, gust: 51, windyDays: 25.3, hot30: 2.3, frost: 0 },
    { m: 5, feels: 18.1, hum: 66, precip: 163, rainDays: 16.3, heavyRain: 1.7, sun: 304, cloud: 65, rad: 21.4, wind: 12.8, gust: 42, windyDays: 19, hot30: 5, frost: 0 },
    { m: 6, feels: 20.2, hum: 77, precip: 272, rainDays: 23, heavyRain: 1.7, sun: 259, cloud: 84, rad: 19, wind: 9.8, gust: 35, windyDays: 9.3, hot30: 0.7, frost: 0 },
    { m: 7, feels: 21.3, hum: 79, precip: 175, rainDays: 23.7, heavyRain: 0.3, sun: 315, cloud: 82, rad: 21, wind: 10.1, gust: 36, windyDays: 10.3, hot30: 0, frost: 0 },
    { m: 8, feels: 20.9, hum: 81, precip: 168, rainDays: 20.7, heavyRain: 0.3, sun: 318, cloud: 74, rad: 20.5, wind: 6.8, gust: 31, windyDays: 2.7, hot30: 0, frost: 0 },
    { m: 9, feels: 19.5, hum: 78, precip: 123, rainDays: 20, heavyRain: 0.7, sun: 298, cloud: 69, rad: 18.4, wind: 8.7, gust: 34, windyDays: 7.3, hot30: 0, frost: 0 },
    { m: 10, feels: 15.1, hum: 80, precip: 136, rainDays: 16.7, heavyRain: 1.3, sun: 228, cloud: 74, rad: 13.6, wind: 9.9, gust: 33, windyDays: 7.7, hot30: 0, frost: 0 },
    { m: 11, feels: 9.9, hum: 75, precip: 69, rainDays: 10, heavyRain: 0.3, sun: 206, cloud: 59, rad: 12.2, wind: 10, gust: 34, windyDays: 8.7, hot30: 0, frost: 1 },
    { m: 12, feels: 6.6, hum: 73, precip: 22, rainDays: 6.7, heavyRain: 0, sun: 218, cloud: 56, rad: 11.5, wind: 12.2, gust: 41, windyDays: 17.3, hot30: 0, frost: 0 },
  ],
  // 兴义
  xingyi: [
    { m: 1, feels: 6.8, hum: 77, precip: 32, rainDays: 9, heavyRain: 0, sun: 161, cloud: 71, rad: 9.6, wind: 7.7, gust: 34, windyDays: 9, hot30: 0, frost: 2.7 },
    { m: 2, feels: 9.3, hum: 74, precip: 34, rainDays: 9.7, heavyRain: 0, sun: 178, cloud: 70, rad: 12.4, wind: 9.3, gust: 40, windyDays: 15.3, hot30: 0, frost: 0 },
    { m: 3, feels: 14.3, hum: 67, precip: 36, rainDays: 10.3, heavyRain: 0, sun: 246, cloud: 67, rad: 15.8, wind: 9.6, gust: 42, windyDays: 19, hot30: 5.3, frost: 0 },
    { m: 4, feels: 20.9, hum: 60, precip: 75, rainDays: 11, heavyRain: 0.7, sun: 277, cloud: 63, rad: 19.5, wind: 9.6, gust: 43, windyDays: 19.7, hot30: 13.7, frost: 0 },
    { m: 5, feels: 23.1, hum: 72, precip: 249, rainDays: 20.3, heavyRain: 3.7, sun: 266, cloud: 71, rad: 18.9, wind: 8.9, gust: 38, windyDays: 14.3, hot30: 9, frost: 0 },
    { m: 6, feels: 25.7, hum: 80, precip: 306, rainDays: 22.7, heavyRain: 3.3, sun: 232, cloud: 84, rad: 18.2, wind: 7.3, gust: 32, windyDays: 5.7, hot30: 4.7, frost: 0 },
    { m: 7, feels: 27.2, hum: 79, precip: 212, rainDays: 22, heavyRain: 1.3, sun: 320, cloud: 78, rad: 21.2, wind: 8.3, gust: 35, windyDays: 10.3, hot30: 10.3, frost: 0 },
    { m: 8, feels: 26.4, hum: 84, precip: 198, rainDays: 23.7, heavyRain: 1, sun: 317, cloud: 73, rad: 20.1, wind: 6, gust: 31, windyDays: 1.3, hot30: 2, frost: 0 },
    { m: 9, feels: 24.8, hum: 81, precip: 207, rainDays: 21.7, heavyRain: 1, sun: 287, cloud: 66, rad: 17.8, wind: 7.3, gust: 33, windyDays: 4.7, hot30: 1, frost: 0 },
    { m: 10, feels: 19.5, hum: 78, precip: 96, rainDays: 12.3, heavyRain: 0.3, sun: 212, cloud: 72, rad: 13.4, wind: 7.3, gust: 32, windyDays: 5.3, hot30: 0, frost: 0 },
    { m: 11, feels: 13.9, hum: 77, precip: 52, rainDays: 9, heavyRain: 0.7, sun: 190, cloud: 67, rad: 10.9, wind: 6.5, gust: 29, windyDays: 3.3, hot30: 0, frost: 0 },
    { m: 12, feels: 8.8, hum: 77, precip: 27, rainDays: 7.7, heavyRain: 0, sun: 168, cloud: 75, rad: 9, wind: 7, gust: 32, windyDays: 6.3, hot30: 0, frost: 0.3 },
  ],
  // 攀枝花仁和
  renhe: [
    { m: 1, feels: 11.1, hum: 56, precip: 8, rainDays: 2, heavyRain: 0, sun: 303, cloud: 21, rad: 14.7, wind: 4.6, gust: 29, windyDays: 1.3, hot30: 0, frost: 0 },
    { m: 2, feels: 14.7, hum: 44, precip: 6, rainDays: 1.7, heavyRain: 0, sun: 302, cloud: 20, rad: 18.1, wind: 5.6, gust: 38, windyDays: 11, hot30: 0.3, frost: 0 },
    { m: 3, feels: 18.7, hum: 40, precip: 8, rainDays: 2, heavyRain: 0, sun: 334, cloud: 30, rad: 20.8, wind: 5.6, gust: 37, windyDays: 12, hot30: 8.3, frost: 0 },
    { m: 4, feels: 24, hum: 36, precip: 7, rainDays: 2, heavyRain: 0, sun: 350, cloud: 38, rad: 23.8, wind: 6.1, gust: 40, windyDays: 15.7, hot30: 25.7, frost: 0 },
    { m: 5, feels: 26.3, hum: 50, precip: 110, rainDays: 12, heavyRain: 0.7, sun: 333, cloud: 52, rad: 22.6, wind: 5.3, gust: 34, windyDays: 7.7, hot30: 22.3, frost: 0 },
    { m: 6, feels: 28.1, hum: 73, precip: 450, rainDays: 23.3, heavyRain: 8, sun: 287, cloud: 76, rad: 20.3, wind: 4.1, gust: 27, windyDays: 1, hot30: 12.7, frost: 0 },
    { m: 7, feels: 29.5, hum: 75, precip: 284, rainDays: 22, heavyRain: 2.7, sun: 316, cloud: 81, rad: 20.4, wind: 3.9, gust: 25, windyDays: 0, hot30: 16.3, frost: 0 },
    { m: 8, feels: 28.9, hum: 77, precip: 226, rainDays: 21.3, heavyRain: 1, sun: 303, cloud: 75, rad: 19, wind: 3.4, gust: 22, windyDays: 0, hot30: 10, frost: 0 },
    { m: 9, feels: 27.3, hum: 77, precip: 230, rainDays: 20, heavyRain: 1.3, sun: 288, cloud: 67, rad: 17.7, wind: 3.5, gust: 23, windyDays: 0, hot30: 3.3, frost: 0 },
    { m: 10, feels: 22.8, hum: 79, precip: 233, rainDays: 18.3, heavyRain: 3, sun: 274, cloud: 61, rad: 14.8, wind: 3.5, gust: 23, windyDays: 0, hot30: 0.7, frost: 0 },
    { m: 11, feels: 16.3, hum: 72, precip: 95, rainDays: 9, heavyRain: 1, sun: 265, cloud: 37, rad: 14, wind: 3.3, gust: 23, windyDays: 0, hot30: 0, frost: 0 },
    { m: 12, feels: 12.5, hum: 65, precip: 4, rainDays: 1, heavyRain: 0, sun: 290, cloud: 29, rad: 13.8, wind: 3.8, gust: 26, windyDays: 0, hot30: 0, frost: 0 },
  ],
  // 临沧
  lincang: [
    { m: 1, feels: 11.4, hum: 68, precip: 22, rainDays: 4, heavyRain: 0, sun: 312, cloud: 30, rad: 16, wind: 4.8, gust: 34, windyDays: 7.3, hot30: 0, frost: 0 },
    { m: 2, feels: 13.5, hum: 57, precip: 12, rainDays: 3.3, heavyRain: 0, sun: 300, cloud: 29, rad: 19.2, wind: 5.9, gust: 43, windyDays: 20, hot30: 0, frost: 0 },
    { m: 3, feels: 16.4, hum: 53, precip: 18, rainDays: 4.7, heavyRain: 0, sun: 333, cloud: 32, rad: 21.1, wind: 6.7, gust: 46, windyDays: 26.3, hot30: 0.3, frost: 0 },
    { m: 4, feels: 20.4, hum: 56, precip: 21, rainDays: 6, heavyRain: 0, sun: 350, cloud: 37, rad: 22.9, wind: 7.4, gust: 50, windyDays: 26, hot30: 6.7, frost: 0 },
    { m: 5, feels: 22.8, hum: 73, precip: 135, rainDays: 18.7, heavyRain: 0.7, sun: 337, cloud: 55, rad: 21.5, wind: 5.8, gust: 36, windyDays: 12, hot30: 4.3, frost: 0 },
    { m: 6, feels: 25.4, hum: 84, precip: 240, rainDays: 26, heavyRain: 2.3, sun: 305, cloud: 83, rad: 19.6, wind: 4.4, gust: 30, windyDays: 1.7, hot30: 2, frost: 0 },
    { m: 7, feels: 25.6, hum: 87, precip: 309, rainDays: 29, heavyRain: 2.3, sun: 279, cloud: 93, rad: 18, wind: 4.3, gust: 27, windyDays: 0.7, hot30: 1.3, frost: 0 },
    { m: 8, feels: 25, hum: 88, precip: 235, rainDays: 29.3, heavyRain: 0.7, sun: 297, cloud: 91, rad: 18.1, wind: 4.3, gust: 27, windyDays: 0, hot30: 0, frost: 0 },
    { m: 9, feels: 24.2, hum: 86, precip: 198, rainDays: 26, heavyRain: 0.3, sun: 300, cloud: 77, rad: 18.3, wind: 3.9, gust: 28, windyDays: 1.3, hot30: 0, frost: 0 },
    { m: 10, feels: 21.2, hum: 87, precip: 135, rainDays: 21.7, heavyRain: 0.3, sun: 298, cloud: 73, rad: 15.7, wind: 4, gust: 26, windyDays: 0.3, hot30: 0, frost: 0 },
    { m: 11, feels: 16.1, hum: 81, precip: 85, rainDays: 11.3, heavyRain: 1, sun: 268, cloud: 51, rad: 14.7, wind: 3.9, gust: 26, windyDays: 0, hot30: 0, frost: 0 },
    { m: 12, feels: 12.8, hum: 76, precip: 14, rainDays: 3.7, heavyRain: 0, sun: 302, cloud: 35, rad: 15.1, wind: 3.6, gust: 28, windyDays: 1, hot30: 0, frost: 0 },
  ],
  // 保山
  baoshan: [
    { m: 1, feels: 7.3, hum: 68, precip: 11, rainDays: 2.3, heavyRain: 0, sun: 311, cloud: 20, rad: 15.9, wind: 6.6, gust: 37, windyDays: 14.7, hot30: 0, frost: 1 },
    { m: 2, feels: 9.4, hum: 61, precip: 14, rainDays: 3.3, heavyRain: 0, sun: 294, cloud: 27, rad: 17.9, wind: 8.3, gust: 48, windyDays: 24, hot30: 0, frost: 0 },
    { m: 3, feels: 12.8, hum: 55, precip: 30, rainDays: 6.7, heavyRain: 0, sun: 330, cloud: 31, rad: 20.4, wind: 8.6, gust: 49, windyDays: 28.7, hot30: 0, frost: 0 },
    { m: 4, feels: 17.1, hum: 58, precip: 22, rainDays: 7, heavyRain: 0, sun: 338, cloud: 43, rad: 22.2, wind: 9.1, gust: 50, windyDays: 28.3, hot30: 1, frost: 0 },
    { m: 5, feels: 19.7, hum: 71, precip: 144, rainDays: 13, heavyRain: 1.3, sun: 313, cloud: 53, rad: 21.2, wind: 7.4, gust: 41, windyDays: 19, hot30: 1.3, frost: 0 },
    { m: 6, feels: 23.1, hum: 80, precip: 189, rainDays: 24.3, heavyRain: 1.3, sun: 296, cloud: 76, rad: 21, wind: 6, gust: 36, windyDays: 12, hot30: 1.3, frost: 0 },
    { m: 7, feels: 23.8, hum: 84, precip: 245, rainDays: 27.7, heavyRain: 2.3, sun: 260, cloud: 90, rad: 18.8, wind: 4.7, gust: 31, windyDays: 4.3, hot30: 0.7, frost: 0 },
    { m: 8, feels: 23.4, hum: 85, precip: 223, rainDays: 26.7, heavyRain: 1, sun: 265, cloud: 86, rad: 18.7, wind: 4.1, gust: 28, windyDays: 1.7, hot30: 0.3, frost: 0 },
    { m: 9, feels: 22.6, hum: 80, precip: 140, rainDays: 19.7, heavyRain: 1, sun: 288, cloud: 70, rad: 19.2, wind: 4.6, gust: 29, windyDays: 2.7, hot30: 0, frost: 0 },
    { m: 10, feels: 18.7, hum: 82, precip: 141, rainDays: 16.3, heavyRain: 1.3, sun: 273, cloud: 59, rad: 16.1, wind: 4.3, gust: 28, windyDays: 1, hot30: 0, frost: 0 },
    { m: 11, feels: 13, hum: 76, precip: 58, rainDays: 7.3, heavyRain: 0.7, sun: 273, cloud: 35, rad: 15.3, wind: 4.4, gust: 27, windyDays: 1, hot30: 0, frost: 0 },
    { m: 12, feels: 9, hum: 72, precip: 25, rainDays: 2.7, heavyRain: 0, sun: 300, cloud: 26, rad: 15, wind: 5.3, gust: 33, windyDays: 6.3, hot30: 0, frost: 0 },
  ],
  // 个旧
  gejiu: [
    { m: 1, feels: 8.3, hum: 74, precip: 18, rainDays: 3.3, heavyRain: 0, sun: 283, cloud: 46, rad: 14.2, wind: 6.4, gust: 33, windyDays: 9, hot30: 0, frost: 0.3 },
    { m: 2, feels: 11.4, hum: 68, precip: 14, rainDays: 3.3, heavyRain: 0, sun: 277, cloud: 42, rad: 16.9, wind: 8.9, gust: 44, windyDays: 18.3, hot30: 0, frost: 0 },
    { m: 3, feels: 14.6, hum: 62, precip: 17, rainDays: 3.3, heavyRain: 0, sun: 323, cloud: 38, rad: 19.2, wind: 9.2, gust: 46, windyDays: 22.3, hot30: 0, frost: 0 },
    { m: 4, feels: 19.1, hum: 55, precip: 19, rainDays: 4.7, heavyRain: 0, sun: 335, cloud: 37, rad: 21.9, wind: 10.1, gust: 49, windyDays: 24, hot30: 1, frost: 0 },
    { m: 5, feels: 20.7, hum: 70, precip: 120, rainDays: 15.3, heavyRain: 0.3, sun: 329, cloud: 59, rad: 21.8, wind: 7.3, gust: 37, windyDays: 14, hot30: 1, frost: 0 },
    { m: 6, feels: 22.5, hum: 80, precip: 221, rainDays: 20, heavyRain: 2.3, sun: 289, cloud: 86, rad: 20, wind: 5.1, gust: 29, windyDays: 3, hot30: 0.3, frost: 0 },
    { m: 7, feels: 22.9, hum: 81, precip: 275, rainDays: 22.7, heavyRain: 3.7, sun: 322, cloud: 86, rad: 20.7, wind: 5, gust: 28, windyDays: 4.3, hot30: 0, frost: 0 },
    { m: 8, feels: 22, hum: 85, precip: 277, rainDays: 25.7, heavyRain: 2.3, sun: 300, cloud: 85, rad: 18.7, wind: 4.1, gust: 26, windyDays: 1.3, hot30: 0, frost: 0 },
    { m: 9, feels: 20.9, hum: 83, precip: 171, rainDays: 18.7, heavyRain: 1.3, sun: 297, cloud: 71, rad: 17.9, wind: 4.5, gust: 27, windyDays: 1.7, hot30: 0, frost: 0 },
    { m: 10, feels: 17.9, hum: 82, precip: 89, rainDays: 12.7, heavyRain: 0.7, sun: 301, cloud: 63, rad: 15.9, wind: 4.1, gust: 23, windyDays: 0, hot30: 0, frost: 0 },
    { m: 11, feels: 13.2, hum: 78, precip: 51, rainDays: 8.3, heavyRain: 0, sun: 260, cloud: 53, rad: 13.9, wind: 4.9, gust: 26, windyDays: 0.3, hot30: 0, frost: 0 },
    { m: 12, feels: 10.3, hum: 76, precip: 7, rainDays: 1.7, heavyRain: 0, sun: 274, cloud: 50, rad: 13.4, wind: 5.8, gust: 30, windyDays: 4.3, hot30: 0, frost: 0 },
  ],
  // 元阳
  yuanyang: [
    { m: 1, feels: 18.5, hum: 70, precip: 32, rainDays: 7.3, heavyRain: 0, sun: 255, cloud: 45, rad: 12.1, wind: 4.2, gust: 29, windyDays: 2.3, hot30: 1.3, frost: 0 },
    { m: 2, feels: 21.9, hum: 65, precip: 23, rainDays: 5, heavyRain: 0.3, sun: 253, cloud: 43, rad: 14.5, wind: 4.9, gust: 33, windyDays: 6.3, hot30: 12.3, frost: 0 },
    { m: 3, feels: 25.4, hum: 59, precip: 28, rainDays: 3.7, heavyRain: 0, sun: 295, cloud: 39, rad: 15.7, wind: 4.9, gust: 37, windyDays: 14, hot30: 21, frost: 0 },
    { m: 4, feels: 30.7, hum: 56, precip: 36, rainDays: 4, heavyRain: 0.3, sun: 310, cloud: 40, rad: 18.2, wind: 4.8, gust: 39, windyDays: 13.7, hot30: 28.3, frost: 0 },
    { m: 5, feels: 33.5, hum: 65, precip: 111, rainDays: 13.3, heavyRain: 0.7, sun: 314, cloud: 58, rad: 20.3, wind: 4.3, gust: 32, windyDays: 5, hot30: 28.3, frost: 0 },
    { m: 6, feels: 35.3, hum: 78, precip: 240, rainDays: 22.7, heavyRain: 2, sun: 296, cloud: 86, rad: 19.8, wind: 3.4, gust: 27, windyDays: 1, hot30: 28.3, frost: 0 },
    { m: 7, feels: 35.6, hum: 78, precip: 276, rainDays: 21.7, heavyRain: 3.3, sun: 315, cloud: 85, rad: 20.2, wind: 3.5, gust: 27, windyDays: 0.7, hot30: 29, frost: 0 },
    { m: 8, feels: 34.5, hum: 82, precip: 237, rainDays: 22.3, heavyRain: 1, sun: 283, cloud: 84, rad: 18, wind: 3.2, gust: 26, windyDays: 0.3, hot30: 27.3, frost: 0 },
    { m: 9, feels: 33.7, hum: 76, precip: 127, rainDays: 13, heavyRain: 1.7, sun: 302, cloud: 67, rad: 18.3, wind: 3.6, gust: 28, windyDays: 1, hot30: 27.7, frost: 0 },
    { m: 10, feels: 30, hum: 73, precip: 76, rainDays: 9.7, heavyRain: 0.3, sun: 301, cloud: 56, rad: 16.5, wind: 3.8, gust: 28, windyDays: 0.3, hot30: 23.3, frost: 0 },
    { m: 11, feels: 24.5, hum: 72, precip: 62, rainDays: 7.7, heavyRain: 0.3, sun: 250, cloud: 50, rad: 13.3, wind: 3.6, gust: 27, windyDays: 0.3, hot30: 9, frost: 0 },
    { m: 12, feels: 20.8, hum: 72, precip: 19, rainDays: 4.7, heavyRain: 0, sun: 246, cloud: 51, rad: 11.2, wind: 3.8, gust: 28, windyDays: 0.3, hot30: 1.7, frost: 0 },
  ],
  // 绿春
  lvchun: [
    { m: 1, feels: 9.5, hum: 86, precip: 68, rainDays: 14, heavyRain: 0, sun: 235, cloud: 61, rad: 12.5, wind: 4.8, gust: 33, windyDays: 4.7, hot30: 0, frost: 0.3 },
    { m: 2, feels: 12.3, hum: 80, precip: 41, rainDays: 10.7, heavyRain: 0, sun: 245, cloud: 51, rad: 15.9, wind: 5.6, gust: 40, windyDays: 16.7, hot30: 0, frost: 0 },
    { m: 3, feels: 15.3, hum: 74, precip: 44, rainDays: 9, heavyRain: 0, sun: 293, cloud: 47, rad: 18, wind: 5.8, gust: 41, windyDays: 19, hot30: 0, frost: 0 },
    { m: 4, feels: 19.6, hum: 70, precip: 85, rainDays: 11.7, heavyRain: 0.3, sun: 318, cloud: 43, rad: 21, wind: 5.5, gust: 43, windyDays: 21.7, hot30: 2.3, frost: 0 },
    { m: 5, feels: 21.7, hum: 82, precip: 225, rainDays: 23.7, heavyRain: 1.3, sun: 298, cloud: 66, rad: 20.1, wind: 5.2, gust: 35, windyDays: 10.3, hot30: 0.7, frost: 0 },
    { m: 6, feels: 23.3, hum: 89, precip: 333, rainDays: 28.3, heavyRain: 1.3, sun: 243, cloud: 91, rad: 17.6, wind: 4.9, gust: 32, windyDays: 3.3, hot30: 0, frost: 0 },
    { m: 7, feels: 23.8, hum: 88, precip: 315, rainDays: 28.3, heavyRain: 2.3, sun: 276, cloud: 91, rad: 18.6, wind: 4.6, gust: 30, windyDays: 1.7, hot30: 0, frost: 0 },
    { m: 8, feels: 23.1, hum: 90, precip: 322, rainDays: 29.3, heavyRain: 2.3, sun: 239, cloud: 91, rad: 16.4, wind: 3.9, gust: 27, windyDays: 0, hot30: 0, frost: 0 },
    { m: 9, feels: 22.4, hum: 86, precip: 159, rainDays: 24.3, heavyRain: 1, sun: 297, cloud: 74, rad: 18.3, wind: 4.5, gust: 29, windyDays: 3.3, hot30: 0, frost: 0 },
    { m: 10, feels: 19.6, hum: 87, precip: 112, rainDays: 18.7, heavyRain: 0.7, sun: 283, cloud: 69, rad: 15.4, wind: 4.1, gust: 25, windyDays: 0.3, hot30: 0, frost: 0 },
    { m: 11, feels: 14.9, hum: 85, precip: 69, rainDays: 13.7, heavyRain: 0, sun: 239, cloud: 64, rad: 13.3, wind: 4.2, gust: 26, windyDays: 0.3, hot30: 0, frost: 0 },
    { m: 12, feels: 12.1, hum: 88, precip: 59, rainDays: 13.7, heavyRain: 0, sun: 230, cloud: 70, rad: 11.6, wind: 4.4, gust: 29, windyDays: 1.7, hot30: 0, frost: 0 },
  ],
  // 红河县
  honghe: [
    { m: 1, feels: 12.9, hum: 70, precip: 36, rainDays: 7.3, heavyRain: 0, sun: 279, cloud: 39, rad: 13.8, wind: 6.2, gust: 33, windyDays: 6, hot30: 0, frost: 0 },
    { m: 2, feels: 16.5, hum: 62, precip: 28, rainDays: 6, heavyRain: 0, sun: 274, cloud: 37, rad: 16.4, wind: 6.5, gust: 38, windyDays: 12, hot30: 0.3, frost: 0 },
    { m: 3, feels: 19.6, hum: 57, precip: 29, rainDays: 4, heavyRain: 0, sun: 314, cloud: 36, rad: 18, wind: 6.6, gust: 43, windyDays: 21, hot30: 8.7, frost: 0 },
    { m: 4, feels: 24.6, hum: 51, precip: 43, rainDays: 5.3, heavyRain: 0, sun: 330, cloud: 36, rad: 20.5, wind: 5.9, gust: 46, windyDays: 22, hot30: 21, frost: 0 },
    { m: 5, feels: 26.6, hum: 64, precip: 139, rainDays: 17, heavyRain: 0.7, sun: 329, cloud: 56, rad: 21.1, wind: 5, gust: 35, windyDays: 7.7, hot30: 20, frost: 0 },
    { m: 6, feels: 28.1, hum: 76, precip: 345, rainDays: 25.3, heavyRain: 3.7, sun: 310, cloud: 85, rad: 20.3, wind: 4.8, gust: 30, windyDays: 2, hot30: 13, frost: 0 },
    { m: 7, feels: 28.4, hum: 76, precip: 320, rainDays: 24, heavyRain: 4, sun: 325, cloud: 86, rad: 20.4, wind: 4.5, gust: 29, windyDays: 1, hot30: 14.7, frost: 0 },
    { m: 8, feels: 27.4, hum: 80, precip: 226, rainDays: 25.7, heavyRain: 1, sun: 310, cloud: 83, rad: 18.7, wind: 4.1, gust: 28, windyDays: 0, hot30: 3.3, frost: 0 },
    { m: 9, feels: 26.8, hum: 74, precip: 183, rainDays: 15.7, heavyRain: 2.7, sun: 310, cloud: 66, rad: 18.8, wind: 4.5, gust: 29, windyDays: 1, hot30: 9, frost: 0 },
    { m: 10, feels: 23.1, hum: 72, precip: 97, rainDays: 11.3, heavyRain: 0.3, sun: 311, cloud: 54, rad: 16.3, wind: 5.3, gust: 30, windyDays: 1, hot30: 2, frost: 0 },
    { m: 11, feels: 18, hum: 72, precip: 72, rainDays: 9.3, heavyRain: 0, sun: 262, cloud: 48, rad: 13.9, wind: 4.8, gust: 28, windyDays: 1.3, hot30: 0, frost: 0 },
    { m: 12, feels: 14.9, hum: 73, precip: 32, rainDays: 5, heavyRain: 0.3, sun: 271, cloud: 47, rad: 12.8, wind: 5.9, gust: 31, windyDays: 4, hot30: 0, frost: 0 },
  ],
  // 墨江县
  mojiang: [
    { m: 1, feels: 11.2, hum: 80, precip: 33, rainDays: 7, heavyRain: 0, sun: 239, cloud: 47, rad: 12.5, wind: 6.6, gust: 26, windyDays: 1, hot30: 0, frost: 0 },
    { m: 2, feels: 13.9, hum: 71, precip: 34, rainDays: 6.3, heavyRain: 0.3, sun: 262, cloud: 39, rad: 16.6, wind: 7.5, gust: 35, windyDays: 9.3, hot30: 0, frost: 0 },
    { m: 3, feels: 17.1, hum: 63, precip: 34, rainDays: 5.7, heavyRain: 0, sun: 302, cloud: 36, rad: 18.3, wind: 7.5, gust: 38, windyDays: 14, hot30: 0, frost: 0 },
    { m: 4, feels: 21.6, hum: 56, precip: 49, rainDays: 7.3, heavyRain: 0.3, sun: 329, cloud: 36, rad: 21, wind: 7.5, gust: 40, windyDays: 18, hot30: 14.3, frost: 0 },
    { m: 5, feels: 23.5, hum: 74, precip: 178, rainDays: 18.3, heavyRain: 1, sun: 305, cloud: 58, rad: 20.4, wind: 6.6, gust: 30, windyDays: 2, hot30: 7.3, frost: 0 },
    { m: 6, feels: 25.1, hum: 85, precip: 352, rainDays: 28, heavyRain: 2, sun: 252, cloud: 86, rad: 18.3, wind: 6.3, gust: 28, windyDays: 0.3, hot30: 1.3, frost: 0 },
    { m: 7, feels: 25.4, hum: 85, precip: 320, rainDays: 28.3, heavyRain: 2.3, sun: 275, cloud: 88, rad: 18.7, wind: 5.5, gust: 26, windyDays: 0, hot30: 1, frost: 0 },
    { m: 8, feels: 24.8, hum: 87, precip: 341, rainDays: 28.7, heavyRain: 2.7, sun: 271, cloud: 88, rad: 17.3, wind: 4.8, gust: 24, windyDays: 0, hot30: 0.3, frost: 0 },
    { m: 9, feels: 24.3, hum: 82, precip: 184, rainDays: 22.3, heavyRain: 0.7, sun: 288, cloud: 71, rad: 17.8, wind: 4.8, gust: 24, windyDays: 0, hot30: 0, frost: 0 },
    { m: 10, feels: 21.3, hum: 82, precip: 116, rainDays: 19.3, heavyRain: 0.3, sun: 290, cloud: 62, rad: 15.8, wind: 5.4, gust: 23, windyDays: 0.3, hot30: 0, frost: 0 },
    { m: 11, feels: 16.4, hum: 82, precip: 111, rainDays: 13.3, heavyRain: 1, sun: 239, cloud: 54, rad: 13, wind: 5, gust: 21, windyDays: 0, hot30: 0, frost: 0 },
    { m: 12, feels: 13.5, hum: 83, precip: 60, rainDays: 9, heavyRain: 0.7, sun: 231, cloud: 56, rad: 11.4, wind: 6.1, gust: 23, windyDays: 0, hot30: 0, frost: 0 },
  ],
  // 元江县
  yuanjiang: [
    { m: 1, feels: 19, hum: 63, precip: 15, rainDays: 6, heavyRain: 0, sun: 296, cloud: 37, rad: 14.4, wind: 6, gust: 29, windyDays: 2, hot30: 2, frost: 0 },
    { m: 2, feels: 22.5, hum: 53, precip: 10, rainDays: 2.7, heavyRain: 0, sun: 289, cloud: 33, rad: 17.2, wind: 6.4, gust: 36, windyDays: 8.3, hot30: 16.7, frost: 0 },
    { m: 3, feels: 25.7, hum: 48, precip: 17, rainDays: 2.3, heavyRain: 0, sun: 323, cloud: 32, rad: 18.4, wind: 5.9, gust: 35, windyDays: 12.3, hot30: 26.3, frost: 0 },
    { m: 4, feels: 30.5, hum: 42, precip: 21, rainDays: 3, heavyRain: 0, sun: 335, cloud: 36, rad: 20.7, wind: 5.6, gust: 37, windyDays: 11.7, hot30: 29.3, frost: 0 },
    { m: 5, feels: 33.2, hum: 57, precip: 94, rainDays: 12, heavyRain: 0.3, sun: 333, cloud: 54, rad: 21.6, wind: 5.6, gust: 34, windyDays: 8, hot30: 28.7, frost: 0 },
    { m: 6, feels: 35, hum: 69, precip: 151, rainDays: 16.3, heavyRain: 1, sun: 314, cloud: 82, rad: 20.7, wind: 5.4, gust: 31, windyDays: 3, hot30: 29.3, frost: 0 },
    { m: 7, feels: 35.1, hum: 72, precip: 216, rainDays: 19, heavyRain: 2.3, sun: 327, cloud: 85, rad: 20.6, wind: 4.7, gust: 29, windyDays: 2.3, hot30: 30, frost: 0 },
    { m: 8, feels: 34.3, hum: 76, precip: 193, rainDays: 22, heavyRain: 0.7, sun: 323, cloud: 82, rad: 19.4, wind: 3.9, gust: 25, windyDays: 0, hot30: 30, frost: 0 },
    { m: 9, feels: 33.4, hum: 70, precip: 131, rainDays: 11.7, heavyRain: 1.3, sun: 316, cloud: 65, rad: 19.1, wind: 4.4, gust: 27, windyDays: 0.7, hot30: 28.3, frost: 0 },
    { m: 10, feels: 30, hum: 70, precip: 71, rainDays: 8, heavyRain: 0.3, sun: 316, cloud: 52, rad: 17, wind: 4.4, gust: 25, windyDays: 1, hot30: 26.3, frost: 0 },
    { m: 11, feels: 24.2, hum: 71, precip: 89, rainDays: 9, heavyRain: 1.3, sun: 264, cloud: 46, rad: 14.1, wind: 3.9, gust: 22, windyDays: 0, hot30: 11.3, frost: 0 },
    { m: 12, feels: 21.2, hum: 66, precip: 14, rainDays: 2.3, heavyRain: 0, sun: 294, cloud: 44, rad: 13.6, wind: 5.8, gust: 28, windyDays: 0.7, hot30: 2.7, frost: 0 },
  ],
  // 大理
  dali: [
    { m: 1, feels: 6.4, hum: 68.2, precip: 9, rainDays: 1.7, heavyRain: 0, sun: 305, cloud: 27.8, rad: 14.8, wind: 9.7, gust: 40.5, windyDays: 16.7, hot30: 0, frost: 0 },
    { m: 2, feels: 8.2, hum: 61.1, precip: 10, rainDays: 2.7, heavyRain: 0, sun: 285, cloud: 34.9, rad: 16.7, wind: 11.3, gust: 48.7, windyDays: 26, hot30: 0, frost: 0 },
    { m: 3, feels: 11.6, hum: 56, precip: 6, rainDays: 1.7, heavyRain: 0, sun: 331, cloud: 33.7, rad: 20.2, wind: 11.4, gust: 50.1, windyDays: 28, hot30: 0, frost: 0 },
    { m: 4, feels: 16.2, hum: 54.5, precip: 8, rainDays: 2.3, heavyRain: 0, sun: 352, cloud: 42.7, rad: 22.7, wind: 11.5, gust: 50.3, windyDays: 27.7, hot30: 0, frost: 0 },
    { m: 5, feels: 19, hum: 65.2, precip: 100, rainDays: 9.3, heavyRain: 1.3, sun: 328, cloud: 53.9, rad: 21.5, wind: 9.5, gust: 40.6, windyDays: 19.7, hot30: 1.7, frost: 0 },
    { m: 6, feels: 22.1, hum: 77.4, precip: 164, rainDays: 18.3, heavyRain: 1.7, sun: 315, cloud: 73.1, rad: 21.1, wind: 8.1, gust: 34.9, windyDays: 10.3, hot30: 1.3, frost: 0 },
    { m: 7, feels: 22.9, hum: 82, precip: 201, rainDays: 21, heavyRain: 1.3, sun: 298, cloud: 88.7, rad: 19.5, wind: 6.9, gust: 30.6, windyDays: 4, hot30: 0, frost: 0 },
    { m: 8, feels: 22.6, hum: 85.2, precip: 278, rainDays: 25, heavyRain: 1.7, sun: 292, cloud: 83.9, rad: 18.8, wind: 4.9, gust: 24.8, windyDays: 0.3, hot30: 0, frost: 0 },
    { m: 9, feels: 21.5, hum: 83.9, precip: 162, rainDays: 19, heavyRain: 1.3, sun: 302, cloud: 74.3, rad: 18.8, wind: 5.7, gust: 27.3, windyDays: 0.3, hot30: 0, frost: 0 },
    { m: 10, feels: 17.6, hum: 82.4, precip: 86, rainDays: 13.7, heavyRain: 0, sun: 287, cloud: 61.2, rad: 15.7, wind: 7.2, gust: 29.3, windyDays: 1.3, hot30: 0, frost: 0 },
    { m: 11, feels: 12, hum: 78.5, precip: 59, rainDays: 6.3, heavyRain: 0.7, sun: 266, cloud: 39.5, rad: 14.6, wind: 7.2, gust: 30.7, windyDays: 2, hot30: 0, frost: 0 },
    { m: 12, feels: 8.2, hum: 74.7, precip: 9, rainDays: 1.7, heavyRain: 0, sun: 295, cloud: 28.1, rad: 14.5, wind: 8.9, gust: 36.7, windyDays: 13.3, hot30: 0, frost: 0 },
  ],
  // 腾冲
  tengchong: [
    { m: 1, feels: 7, hum: 68.1, precip: 10, rainDays: 2.3, heavyRain: 0, sun: 321, cloud: 19.5, rad: 16.2, wind: 5.8, gust: 33, windyDays: 6, hot30: 0, frost: 0.3 },
    { m: 2, feels: 8.9, hum: 61.8, precip: 14, rainDays: 3.3, heavyRain: 0, sun: 297, cloud: 30.1, rad: 17.7, wind: 6.7, gust: 41.3, windyDays: 19.7, hot30: 0, frost: 0 },
    { m: 3, feels: 12.2, hum: 57, precip: 33, rainDays: 5.3, heavyRain: 0.3, sun: 334, cloud: 32.1, rad: 20.3, wind: 7.3, gust: 44.1, windyDays: 24.3, hot30: 0, frost: 0 },
    { m: 4, feels: 16.4, hum: 61.4, precip: 33, rainDays: 8.7, heavyRain: 0, sun: 340, cloud: 45.2, rad: 21.7, wind: 7.3, gust: 44.7, windyDays: 24, hot30: 0, frost: 0 },
    { m: 5, feels: 19, hum: 75.1, precip: 167, rainDays: 19.7, heavyRain: 2, sun: 305, cloud: 57.7, rad: 20, wind: 5.8, gust: 34.8, windyDays: 9.3, hot30: 0.7, frost: 0 },
    { m: 6, feels: 21.8, hum: 86.2, precip: 287, rainDays: 26.7, heavyRain: 1.7, sun: 265, cloud: 81, rad: 18.4, wind: 5.3, gust: 31.9, windyDays: 1.3, hot30: 0.3, frost: 0 },
    { m: 7, feels: 22.4, hum: 89.4, precip: 337, rainDays: 30, heavyRain: 2.7, sun: 233, cloud: 93.9, rad: 16.5, wind: 4.5, gust: 27.4, windyDays: 0, hot30: 0, frost: 0 },
    { m: 8, feels: 22, hum: 90.4, precip: 400, rainDays: 30, heavyRain: 3, sun: 234, cloud: 91.7, rad: 16.1, wind: 4.1, gust: 25.9, windyDays: 0, hot30: 0, frost: 0 },
    { m: 9, feels: 21.8, hum: 85.6, precip: 196, rainDays: 21.7, heavyRain: 1.7, sun: 289, cloud: 75.2, rad: 18.1, wind: 4, gust: 24.9, windyDays: 0, hot30: 0, frost: 0 },
    { m: 10, feels: 17.9, hum: 84.8, precip: 148, rainDays: 18.3, heavyRain: 1.3, sun: 284, cloud: 63.6, rad: 15.9, wind: 4.3, gust: 25, windyDays: 0, hot30: 0, frost: 0 },
    { m: 11, feels: 12.4, hum: 77, precip: 69, rainDays: 6.7, heavyRain: 1, sun: 284, cloud: 35.1, rad: 15.7, wind: 4.6, gust: 24.8, windyDays: 0, hot30: 0, frost: 0 },
    { m: 12, feels: 8.4, hum: 72.3, precip: 21, rainDays: 2, heavyRain: 0, sun: 306, cloud: 28.8, rad: 15.3, wind: 4.8, gust: 28.1, windyDays: 0.3, hot30: 0, frost: 0 },
  ],
  // 楚雄
  chuxiong: [
    { m: 1, feels: 7.3, hum: 64.6, precip: 16, rainDays: 4.7, heavyRain: 0, sun: 279, cloud: 33.1, rad: 14.6, wind: 10.7, gust: 41.9, windyDays: 21.7, hot30: 0, frost: 0 },
    { m: 2, feels: 10.2, hum: 51.3, precip: 5, rainDays: 1.3, heavyRain: 0, sun: 286, cloud: 31.5, rad: 17.8, wind: 14.2, gust: 53, windyDays: 26.3, hot30: 0, frost: 0 },
    { m: 3, feels: 13.6, hum: 43.6, precip: 14, rainDays: 2, heavyRain: 0, sun: 325, cloud: 33.1, rad: 20.6, wind: 15.4, gust: 53.7, windyDays: 29.3, hot30: 0, frost: 0 },
    { m: 4, feels: 18.1, hum: 41.4, precip: 14, rainDays: 3.3, heavyRain: 0, sun: 344, cloud: 37.7, rad: 23.3, wind: 15.8, gust: 55.6, windyDays: 28, hot30: 4.3, frost: 0 },
    { m: 5, feels: 20.3, hum: 57.7, precip: 87, rainDays: 11, heavyRain: 0.7, sun: 332, cloud: 53.9, rad: 22.3, wind: 12.5, gust: 44.9, windyDays: 23.3, hot30: 9.7, frost: 0 },
    { m: 6, feels: 22.4, hum: 77.3, precip: 218, rainDays: 21.3, heavyRain: 1.3, sun: 302, cloud: 77.8, rad: 21.2, wind: 9.3, gust: 35.7, windyDays: 9, hot30: 1.7, frost: 0 },
    { m: 7, feels: 23.2, hum: 80.5, precip: 197, rainDays: 24.7, heavyRain: 0.7, sun: 299, cloud: 87.7, rad: 20.1, wind: 7.8, gust: 32.1, windyDays: 4, hot30: 1, frost: 0 },
    { m: 8, feels: 22.6, hum: 83.1, precip: 222, rainDays: 23.7, heavyRain: 2.3, sun: 295, cloud: 78.9, rad: 19.3, wind: 5.7, gust: 26.9, windyDays: 0.7, hot30: 0, frost: 0 },
    { m: 9, feels: 21.3, hum: 80.8, precip: 126, rainDays: 19.3, heavyRain: 0.7, sun: 292, cloud: 68.5, rad: 18.3, wind: 6.9, gust: 29.3, windyDays: 1.7, hot30: 0, frost: 0 },
    { m: 10, feels: 17.6, hum: 81.3, precip: 96, rainDays: 16.3, heavyRain: 0.7, sun: 266, cloud: 64.7, rad: 15.2, wind: 7.7, gust: 30.6, windyDays: 1.3, hot30: 0, frost: 0 },
    { m: 11, feels: 12.3, hum: 75, precip: 63, rainDays: 7.7, heavyRain: 0.7, sun: 244, cloud: 49.3, rad: 14, wind: 7.6, gust: 31.4, windyDays: 4.3, hot30: 0, frost: 0 },
    { m: 12, feels: 8.8, hum: 71.9, precip: 6, rainDays: 1.7, heavyRain: 0, sun: 269, cloud: 39.6, rad: 13.9, wind: 8.7, gust: 37.9, windyDays: 14.7, hot30: 0, frost: 0 },
  ],
  // 澄江
  chengjiang: [
    { m: 1, feels: 7.9, hum: 77.3, precip: 37, rainDays: 9, heavyRain: 0, sun: 238, cloud: 48.1, rad: 12.9, wind: 9.5, gust: 41, windyDays: 17.3, hot30: 0, frost: 0 },
    { m: 2, feels: 10.9, hum: 64.9, precip: 16, rainDays: 6, heavyRain: 0, sun: 265, cloud: 38.8, rad: 17, wind: 12.1, gust: 50.2, windyDays: 22.7, hot30: 0, frost: 0 },
    { m: 3, feels: 13.7, hum: 59.3, precip: 22, rainDays: 4.3, heavyRain: 0, sun: 302, cloud: 39.9, rad: 19.3, wind: 11.9, gust: 50.5, windyDays: 26.7, hot30: 0, frost: 0 },
    { m: 4, feels: 18.5, hum: 51.3, precip: 29, rainDays: 4, heavyRain: 0.3, sun: 335, cloud: 38.5, rad: 22.8, wind: 12.4, gust: 52.6, windyDays: 26.3, hot30: 2.7, frost: 0 },
    { m: 5, feels: 20.6, hum: 68.6, precip: 131, rainDays: 14.7, heavyRain: 0.7, sun: 317, cloud: 59.2, rad: 21.3, wind: 9.8, gust: 42.5, windyDays: 20, hot30: 5, frost: 0 },
    { m: 6, feels: 22.7, hum: 80.6, precip: 285, rainDays: 23.7, heavyRain: 1.3, sun: 286, cloud: 81.8, rad: 19.8, wind: 7.9, gust: 34.2, windyDays: 7.7, hot30: 1, frost: 0 },
    { m: 7, feels: 23.4, hum: 82.1, precip: 255, rainDays: 25, heavyRain: 1.7, sun: 313, cloud: 84.7, rad: 20.5, wind: 7.7, gust: 34.2, windyDays: 9.7, hot30: 0, frost: 0 },
    { m: 8, feels: 22.9, hum: 85.3, precip: 304, rainDays: 26.3, heavyRain: 2.3, sun: 315, cloud: 78.8, rad: 19.7, wind: 5.9, gust: 28.8, windyDays: 0.3, hot30: 0, frost: 0 },
    { m: 9, feels: 21.5, hum: 82.2, precip: 153, rainDays: 19.7, heavyRain: 0.3, sun: 300, cloud: 67.6, rad: 18.6, wind: 7.6, gust: 33, windyDays: 6, hot30: 0, frost: 0 },
    { m: 10, feels: 17.9, hum: 82.9, precip: 109, rainDays: 19, heavyRain: 0.3, sun: 250, cloud: 68.5, rad: 14.3, wind: 7.5, gust: 31.5, windyDays: 3.7, hot30: 0, frost: 0 },
    { m: 11, feels: 13.2, hum: 80.4, precip: 70, rainDays: 10, heavyRain: 0.7, sun: 222, cloud: 55.7, rad: 12.8, wind: 7.4, gust: 32, windyDays: 4.7, hot30: 0, frost: 0 },
    { m: 12, feels: 10.1, hum: 80.3, precip: 17, rainDays: 6, heavyRain: 0, sun: 236, cloud: 51.9, rad: 12.3, wind: 8.3, gust: 36.7, windyDays: 11.7, hot30: 0, frost: 0 },
  ],
  // 建水
  jianshui: [
    { m: 1, feels: 10.7, hum: 68.9, precip: 14, rainDays: 5.3, heavyRain: 0, sun: 268, cloud: 44.5, rad: 14, wind: 7.8, gust: 34.5, windyDays: 8.7, hot30: 0, frost: 0 },
    { m: 2, feels: 14.1, hum: 61.9, precip: 11, rainDays: 2, heavyRain: 0, sun: 267, cloud: 40.1, rad: 17.2, wind: 9.8, gust: 44, windyDays: 21, hot30: 0, frost: 0 },
    { m: 3, feels: 17.4, hum: 55.2, precip: 10, rainDays: 2, heavyRain: 0, sun: 316, cloud: 36.4, rad: 19.8, wind: 10.4, gust: 46.4, windyDays: 26, hot30: 2.7, frost: 0 },
    { m: 4, feels: 22.3, hum: 48.5, precip: 12, rainDays: 2, heavyRain: 0, sun: 339, cloud: 35.2, rad: 23, wind: 11.3, gust: 49.5, windyDays: 26.3, hot30: 20.7, frost: 0 },
    { m: 5, feels: 24.5, hum: 60.4, precip: 79, rainDays: 13.3, heavyRain: 0.3, sun: 331, cloud: 54.9, rad: 22.6, wind: 9.1, gust: 40, windyDays: 17.7, hot30: 19.3, frost: 0 },
    { m: 6, feels: 26.2, hum: 72.3, precip: 179, rainDays: 20, heavyRain: 1.7, sun: 307, cloud: 83, rad: 21.2, wind: 7, gust: 33.4, windyDays: 5.7, hot30: 10.3, frost: 0 },
    { m: 7, feels: 26.8, hum: 72.5, precip: 183, rainDays: 20, heavyRain: 1.3, sun: 326, cloud: 84.4, rad: 21.3, wind: 6, gust: 30.7, windyDays: 4, hot30: 16, frost: 0 },
    { m: 8, feels: 25.8, hum: 77.5, precip: 161, rainDays: 21.7, heavyRain: 0.7, sun: 304, cloud: 81, rad: 19, wind: 4.7, gust: 26.5, windyDays: 2, hot30: 2, frost: 0 },
    { m: 9, feels: 24.9, hum: 72.8, precip: 100, rainDays: 14.3, heavyRain: 0.7, sun: 308, cloud: 66.2, rad: 18.9, wind: 6, gust: 30.8, windyDays: 3.7, hot30: 6.7, frost: 0 },
    { m: 10, feels: 21.4, hum: 71, precip: 40, rainDays: 7.7, heavyRain: 0.3, sun: 297, cloud: 57.9, rad: 16.6, wind: 5.7, gust: 28.1, windyDays: 1.3, hot30: 0.7, frost: 0 },
    { m: 11, feels: 16.1, hum: 71.6, precip: 35, rainDays: 7, heavyRain: 0, sun: 253, cloud: 54.1, rad: 14.1, wind: 5.7, gust: 28.2, windyDays: 1.7, hot30: 0, frost: 0 },
    { m: 12, feels: 12.9, hum: 71.7, precip: 7, rainDays: 1, heavyRain: 0, sun: 262, cloud: 53.7, rad: 13, wind: 6.5, gust: 33.2, windyDays: 6, hot30: 0, frost: 0 },
  ],
  // 石屏
  shiping: [
    { m: 1, feels: 10.3, hum: 71.1, precip: 21, rainDays: 5.3, heavyRain: 0, sun: 256, cloud: 44.5, rad: 13.3, wind: 6.1, gust: 32.7, windyDays: 6.7, hot30: 0, frost: 0 },
    { m: 2, feels: 13.6, hum: 61.5, precip: 19, rainDays: 3.3, heavyRain: 0, sun: 264, cloud: 39.6, rad: 16.8, wind: 7.5, gust: 41.6, windyDays: 17.7, hot30: 0, frost: 0 },
    { m: 3, feels: 16.7, hum: 55.3, precip: 14, rainDays: 2.7, heavyRain: 0, sun: 310, cloud: 36.7, rad: 19, wind: 7.9, gust: 43.4, windyDays: 22, hot30: 0, frost: 0 },
    { m: 4, feels: 21.4, hum: 48.5, precip: 25, rainDays: 5, heavyRain: 0, sun: 336, cloud: 35.8, rad: 22.2, wind: 8.2, gust: 46.5, windyDays: 23.7, hot30: 12, frost: 0 },
    { m: 5, feels: 23.6, hum: 63.3, precip: 83, rainDays: 13, heavyRain: 0.3, sun: 325, cloud: 54.4, rad: 21.9, wind: 6.9, gust: 37.7, windyDays: 14, hot30: 10.3, frost: 0 },
    { m: 6, feels: 25.2, hum: 76.9, precip: 183, rainDays: 23.3, heavyRain: 1.3, sun: 301, cloud: 82.4, rad: 20.8, wind: 5.2, gust: 31.3, windyDays: 4.3, hot30: 2.3, frost: 0 },
    { m: 7, feels: 25.6, hum: 77.6, precip: 200, rainDays: 23.3, heavyRain: 1.7, sun: 320, cloud: 84.4, rad: 20.9, wind: 4.5, gust: 29.1, windyDays: 2.7, hot30: 3.7, frost: 0 },
    { m: 8, feels: 24.6, hum: 82.2, precip: 216, rainDays: 24.3, heavyRain: 0.7, sun: 299, cloud: 81.4, rad: 19, wind: 3.8, gust: 26.2, windyDays: 0.7, hot30: 0, frost: 0 },
    { m: 9, feels: 23.8, hum: 76.7, precip: 106, rainDays: 17, heavyRain: 0.7, sun: 301, cloud: 65.6, rad: 18.7, wind: 4.7, gust: 29.2, windyDays: 1.3, hot30: 0.7, frost: 0 },
    { m: 10, feels: 20.4, hum: 75.3, precip: 50, rainDays: 9, heavyRain: 0.3, sun: 287, cloud: 56.9, rad: 15.9, wind: 4.8, gust: 26.4, windyDays: 0.7, hot30: 0, frost: 0 },
    { m: 11, feels: 15.3, hum: 74.7, precip: 73, rainDays: 8.7, heavyRain: 0.7, sun: 239, cloud: 51.5, rad: 13.2, wind: 4.5, gust: 25.8, windyDays: 0, hot30: 0, frost: 0 },
    { m: 12, feels: 12.1, hum: 75, precip: 10, rainDays: 2.7, heavyRain: 0, sun: 243, cloud: 51.9, rad: 12.4, wind: 5, gust: 31.6, windyDays: 3.7, hot30: 0, frost: 0 },
  ],
  // 弥勒
  mile: [
    { m: 1, feels: 8.5, hum: 75.5, precip: 43, rainDays: 9.3, heavyRain: 0, sun: 201, cloud: 54.8, rad: 11.7, wind: 7.8, gust: 34.5, windyDays: 10.3, hot30: 0, frost: 0.3 },
    { m: 2, feels: 12.3, hum: 65.4, precip: 17, rainDays: 4.7, heavyRain: 0, sun: 238, cloud: 46.6, rad: 15.8, wind: 10.5, gust: 45.5, windyDays: 20, hot30: 0, frost: 0 },
    { m: 3, feels: 15.8, hum: 56.5, precip: 18, rainDays: 3.7, heavyRain: 0, sun: 289, cloud: 45.8, rad: 18.7, wind: 10.8, gust: 47.6, windyDays: 25, hot30: 1.7, frost: 0 },
    { m: 4, feels: 21.4, hum: 48.1, precip: 22, rainDays: 4.3, heavyRain: 0, sun: 321, cloud: 41.6, rad: 22.3, wind: 11.5, gust: 49.8, windyDays: 25, hot30: 20.3, frost: 0 },
    { m: 5, feels: 23.1, hum: 67.2, precip: 127, rainDays: 16.3, heavyRain: 0.7, sun: 301, cloud: 61.8, rad: 21, wind: 9.2, gust: 39.7, windyDays: 14.7, hot30: 13, frost: 0 },
    { m: 6, feels: 24.9, hum: 79.2, precip: 276, rainDays: 25, heavyRain: 2.7, sun: 266, cloud: 82.9, rad: 19.6, wind: 7.3, gust: 32.6, windyDays: 5, hot30: 3, frost: 0 },
    { m: 7, feels: 25.7, hum: 79.3, precip: 204, rainDays: 21, heavyRain: 1.3, sun: 316, cloud: 82.9, rad: 20.8, wind: 7.3, gust: 33.2, windyDays: 8.7, hot30: 6.7, frost: 0 },
    { m: 8, feels: 25, hum: 83.1, precip: 199, rainDays: 23.3, heavyRain: 1, sun: 303, cloud: 77.6, rad: 19.6, wind: 5.2, gust: 27.3, windyDays: 0.7, hot30: 0, frost: 0 },
    { m: 9, feels: 23.7, hum: 79.7, precip: 118, rainDays: 18, heavyRain: 0.3, sun: 291, cloud: 66.3, rad: 18.3, wind: 7.1, gust: 32.6, windyDays: 5.7, hot30: 0, frost: 0 },
    { m: 10, feels: 19.6, hum: 80, precip: 97, rainDays: 11.3, heavyRain: 0.7, sun: 233, cloud: 70.3, rad: 14.1, wind: 6.2, gust: 28.5, windyDays: 1.3, hot30: 0, frost: 0 },
    { m: 11, feels: 14.3, hum: 77.5, precip: 51, rainDays: 8.3, heavyRain: 0, sun: 206, cloud: 61.6, rad: 12, wind: 5.8, gust: 27.4, windyDays: 2, hot30: 0, frost: 0 },
    { m: 12, feels: 10.6, hum: 77.7, precip: 14, rainDays: 3, heavyRain: 0, sun: 198, cloud: 60.6, rad: 10.8, wind: 6.5, gust: 32.6, windyDays: 6.3, hot30: 0, frost: 0 },
  ],
  // 泸西
  luxi: [
    { m: 1, feels: 5.4, hum: 79.8, precip: 33, rainDays: 6.3, heavyRain: 0, sun: 202, cloud: 59, rad: 11.6, wind: 12.2, gust: 40.1, windyDays: 16, hot30: 0, frost: 4 },
    { m: 2, feels: 9.1, hum: 68.5, precip: 25, rainDays: 5, heavyRain: 0, sun: 237, cloud: 49.2, rad: 15.5, wind: 16.5, gust: 51.6, windyDays: 22.7, hot30: 0, frost: 0 },
    { m: 3, feels: 12.3, hum: 61.2, precip: 30, rainDays: 7, heavyRain: 0, sun: 289, cloud: 49, rad: 18.5, wind: 16.4, gust: 52.2, windyDays: 24.7, hot30: 0, frost: 0 },
    { m: 4, feels: 18, hum: 52.7, precip: 29, rainDays: 4.7, heavyRain: 0, sun: 318, cloud: 44.6, rad: 22.2, wind: 16.5, gust: 53, windyDays: 26, hot30: 7.7, frost: 0 },
    { m: 5, feels: 19.9, hum: 70.5, precip: 145, rainDays: 16.7, heavyRain: 1.3, sun: 298, cloud: 64.3, rad: 21.1, wind: 12.9, gust: 42.2, windyDays: 19.7, hot30: 5.7, frost: 0 },
    { m: 6, feels: 21.9, hum: 81.9, precip: 255, rainDays: 23.3, heavyRain: 2, sun: 267, cloud: 84.5, rad: 19.4, wind: 10.1, gust: 34.7, windyDays: 7.7, hot30: 1, frost: 0 },
    { m: 7, feels: 22.9, hum: 81.7, precip: 164, rainDays: 24.3, heavyRain: 1, sun: 317, cloud: 84.4, rad: 21.1, wind: 9.7, gust: 34.5, windyDays: 10, hot30: 0, frost: 0 },
    { m: 8, feels: 22.4, hum: 84.9, precip: 188, rainDays: 25.3, heavyRain: 1, sun: 308, cloud: 80.6, rad: 19.8, wind: 7, gust: 29.5, windyDays: 3.7, hot30: 0, frost: 0 },
    { m: 9, feels: 20.9, hum: 82.6, precip: 146, rainDays: 21, heavyRain: 1, sun: 296, cloud: 71.5, rad: 18.3, wind: 9, gust: 34.3, windyDays: 8, hot30: 0, frost: 0 },
    { m: 10, feels: 16.7, hum: 83.2, precip: 68, rainDays: 11.7, heavyRain: 0, sun: 235, cloud: 72.6, rad: 14.2, wind: 8.3, gust: 30.8, windyDays: 3, hot30: 0, frost: 0 },
    { m: 11, feels: 11.5, hum: 79.7, precip: 49, rainDays: 7.3, heavyRain: 0.3, sun: 209, cloud: 62.7, rad: 12.1, wind: 9, gust: 32, windyDays: 5.7, hot30: 0, frost: 0 },
    { m: 12, feels: 7.7, hum: 80.8, precip: 7, rainDays: 2.3, heavyRain: 0, sun: 198, cloud: 62.6, rad: 10.8, wind: 11.4, gust: 39.3, windyDays: 15, hot30: 0, frost: 0.3 },
  ],
  // 巍山
  weishan: [
    { m: 1, feels: 6.3, hum: 65.6, precip: 20, rainDays: 3.3, heavyRain: 0, sun: 303, cloud: 25.9, rad: 15.1, wind: 7.6, gust: 44.1, windyDays: 22.3, hot30: 0, frost: 0.3 },
    { m: 2, feels: 8.7, hum: 56.4, precip: 15, rainDays: 4, heavyRain: 0, sun: 295, cloud: 27.4, rad: 17.8, wind: 9.5, gust: 54.4, windyDays: 27.3, hot30: 0, frost: 0 },
    { m: 3, feels: 12.3, hum: 49.4, precip: 12, rainDays: 4, heavyRain: 0, sun: 330, cloud: 31.3, rad: 20.5, wind: 10.1, gust: 56.3, windyDays: 30.7, hot30: 0, frost: 0 },
    { m: 4, feels: 16.8, hum: 48.9, precip: 23, rainDays: 4.3, heavyRain: 0.3, sun: 350, cloud: 39.6, rad: 23.1, wind: 10.5, gust: 57.7, windyDays: 28.3, hot30: 0, frost: 0 },
    { m: 5, feels: 19.3, hum: 63.6, precip: 116, rainDays: 13, heavyRain: 0.7, sun: 328, cloud: 53.9, rad: 21.9, wind: 8.3, gust: 46.2, windyDays: 23, hot30: 2.7, frost: 0 },
    { m: 6, feels: 22.1, hum: 77.3, precip: 172, rainDays: 24.3, heavyRain: 0.7, sun: 315, cloud: 77, rad: 21.3, wind: 6.9, gust: 37.6, windyDays: 13.3, hot30: 1.7, frost: 0 },
    { m: 7, feels: 22.5, hum: 82.1, precip: 228, rainDays: 27.7, heavyRain: 1.7, sun: 297, cloud: 89.1, rad: 19.8, wind: 5.9, gust: 32.4, windyDays: 8, hot30: 0, frost: 0 },
    { m: 8, feels: 22.1, hum: 84.9, precip: 257, rainDays: 28, heavyRain: 1, sun: 293, cloud: 82.6, rad: 19, wind: 4.4, gust: 27, windyDays: 1.7, hot30: 0, frost: 0 },
    { m: 9, feels: 20.9, hum: 81.2, precip: 149, rainDays: 22.3, heavyRain: 1, sun: 302, cloud: 70, rad: 18.8, wind: 5.3, gust: 29.4, windyDays: 2, hot30: 0, frost: 0 },
    { m: 10, feels: 17.2, hum: 81.8, precip: 112, rainDays: 17.3, heavyRain: 0.7, sun: 284, cloud: 61.5, rad: 15.7, wind: 5.6, gust: 31.1, windyDays: 3.3, hot30: 0, frost: 0 },
    { m: 11, feels: 11.6, hum: 75.4, precip: 66, rainDays: 7.3, heavyRain: 0.7, sun: 257, cloud: 43.3, rad: 14.5, wind: 5.4, gust: 32.2, windyDays: 7, hot30: 0, frost: 0 },
    { m: 12, feels: 7.8, hum: 71.3, precip: 10, rainDays: 2.3, heavyRain: 0, sun: 292, cloud: 29.3, rad: 14.6, wind: 6.5, gust: 39.3, windyDays: 17, hot30: 0, frost: 0 },
  ],
  // 屏边
  pingbian: [
    { m: 1, feels: 8.4, hum: 86.2, precip: 36, rainDays: 9, heavyRain: 0, sun: 215, cloud: 63, rad: 11.8, wind: 5, gust: 29.8, windyDays: 1, hot30: 0, frost: 0 },
    { m: 2, feels: 11.9, hum: 83.7, precip: 24, rainDays: 7, heavyRain: 0, sun: 212, cloud: 63.8, rad: 14.2, wind: 6.1, gust: 34.5, windyDays: 4.7, hot30: 0, frost: 0 },
    { m: 3, feels: 15.1, hum: 80.3, precip: 27, rainDays: 7.3, heavyRain: 0, sun: 266, cloud: 58.4, rad: 16.4, wind: 6.3, gust: 37.7, windyDays: 10, hot30: 0, frost: 0 },
    { m: 4, feels: 20.6, hum: 73.6, precip: 45, rainDays: 9.7, heavyRain: 0.3, sun: 299, cloud: 52.3, rad: 19.7, wind: 6.7, gust: 41.3, windyDays: 15, hot30: 1, frost: 0 },
    { m: 5, feels: 22.4, hum: 81.3, precip: 190, rainDays: 22, heavyRain: 1.3, sun: 297, cloud: 69, rad: 20.2, wind: 5.9, gust: 33.5, windyDays: 7.7, hot30: 1, frost: 0 },
    { m: 6, feels: 24, hum: 88.2, precip: 320, rainDays: 28, heavyRain: 3.7, sun: 262, cloud: 90.6, rad: 18.9, wind: 4.8, gust: 29.5, windyDays: 1.7, hot30: 0.3, frost: 0 },
    { m: 7, feels: 24.2, hum: 87.1, precip: 382, rainDays: 28.7, heavyRain: 4, sun: 307, cloud: 87.9, rad: 20.1, wind: 5.3, gust: 29.3, windyDays: 2, hot30: 0, frost: 0 },
    { m: 8, feels: 23.5, hum: 90.2, precip: 422, rainDays: 28.7, heavyRain: 4, sun: 274, cloud: 87.8, rad: 17.8, wind: 3.8, gust: 24.6, windyDays: 0, hot30: 0, frost: 0 },
    { m: 9, feels: 22.5, hum: 88.3, precip: 298, rainDays: 27.3, heavyRain: 2.7, sun: 270, cloud: 78.3, rad: 17.1, wind: 4.7, gust: 28.1, windyDays: 2, hot30: 0, frost: 0 },
    { m: 10, feels: 19, hum: 87.7, precip: 129, rainDays: 21.7, heavyRain: 0.3, sun: 273, cloud: 74.9, rad: 14.9, wind: 5.1, gust: 26.3, windyDays: 0, hot30: 0, frost: 0 },
    { m: 11, feels: 14.4, hum: 86.4, precip: 67, rainDays: 12.3, heavyRain: 0, sun: 234, cloud: 66.9, rad: 12.6, wind: 4.8, gust: 25.9, windyDays: 0, hot30: 0, frost: 0 },
    { m: 12, feels: 10.5, hum: 89.2, precip: 28, rainDays: 8.7, heavyRain: 0, sun: 207, cloud: 69.9, rad: 10.7, wind: 4.9, gust: 26.8, windyDays: 0.3, hot30: 0, frost: 0 },
  ],
  // 景东
  jingdong: [
    { m: 1, feels: 12.3, hum: 74.6, precip: 167, rainDays: 12.3, heavyRain: 2.3, sun: 294, cloud: 40.3, rad: 14.1, wind: 4.5, gust: 31.5, windyDays: 2.3, hot30: 0, frost: 0 },
    { m: 2, feels: 14.9, hum: 65.5, precip: 136, rainDays: 12.7, heavyRain: 1.3, sun: 292, cloud: 36, rad: 17.1, wind: 4.4, gust: 32.7, windyDays: 3.3, hot30: 0, frost: 0 },
    { m: 3, feels: 18, hum: 58.7, precip: 56, rainDays: 8.7, heavyRain: 0.3, sun: 326, cloud: 34.7, rad: 19.5, wind: 4.4, gust: 34.3, windyDays: 6.7, hot30: 3.3, frost: 0 },
    { m: 4, feels: 22.6, hum: 56.3, precip: 42, rainDays: 6.7, heavyRain: 0, sun: 344, cloud: 37.5, rad: 22.2, wind: 4.5, gust: 35.7, windyDays: 8.3, hot30: 19.7, frost: 0 },
    { m: 5, feels: 25.3, hum: 70.6, precip: 278, rainDays: 18, heavyRain: 4.7, sun: 327, cloud: 56.1, rad: 21.3, wind: 4.6, gust: 32.9, windyDays: 4.7, hot30: 18.7, frost: 0 },
    { m: 6, feels: 27.9, hum: 82.7, precip: 707, rainDays: 26.7, heavyRain: 12.3, sun: 303, cloud: 81, rad: 20.3, wind: 5, gust: 33, windyDays: 3, hot30: 12.3, frost: 0 },
    { m: 7, feels: 28.2, hum: 84.7, precip: 638, rainDays: 27.3, heavyRain: 10.3, sun: 291, cloud: 89.9, rad: 19, wind: 4.9, gust: 32.3, windyDays: 2.7, hot30: 11.7, frost: 0 },
    { m: 8, feels: 27.8, hum: 84.9, precip: 416, rainDays: 24, heavyRain: 7, sun: 306, cloud: 82.2, rad: 18.8, wind: 4.1, gust: 29.8, windyDays: 0.7, hot30: 6.3, frost: 0 },
    { m: 9, feels: 26.7, hum: 80.4, precip: 235, rainDays: 18.3, heavyRain: 2.3, sun: 305, cloud: 69.6, rad: 18.5, wind: 4.9, gust: 31.8, windyDays: 0.7, hot30: 7, frost: 0 },
    { m: 10, feels: 23.2, hum: 86, precip: 400, rainDays: 26.3, heavyRain: 5.3, sun: 280, cloud: 72.7, rad: 15.4, wind: 4.8, gust: 30.3, windyDays: 1, hot30: 0.7, frost: 0 },
    { m: 11, feels: 17.7, hum: 81.1, precip: 206, rainDays: 17, heavyRain: 1.3, sun: 253, cloud: 54.6, rad: 13.9, wind: 4.1, gust: 29.5, windyDays: 0.3, hot30: 0, frost: 0 },
    { m: 12, feels: 14.2, hum: 77.2, precip: 97, rainDays: 11.7, heavyRain: 0.7, sun: 287, cloud: 43.6, rad: 13.4, wind: 4, gust: 31.1, windyDays: 0, hot30: 0, frost: 0 },
  ],
  // 西昌
  xichang: [
    { m: 1, feels: 7.7, hum: 54.3, precip: 26, rainDays: 4.3, heavyRain: 0, sun: 285, cloud: 33.4, rad: 12.9, wind: 6.6, gust: 31.3, windyDays: 8, hot30: 0, frost: 0.3 },
    { m: 2, feels: 10.2, hum: 45.4, precip: 27, rainDays: 2.7, heavyRain: 0.3, sun: 289, cloud: 30.6, rad: 16, wind: 8.4, gust: 43.1, windyDays: 18, hot30: 0, frost: 0 },
    { m: 3, feels: 13.7, hum: 41.9, precip: 18, rainDays: 3, heavyRain: 0, sun: 311, cloud: 41.9, rad: 18.6, wind: 8.3, gust: 42.6, windyDays: 18, hot30: 0, frost: 0 },
    { m: 4, feels: 18.6, hum: 40.9, precip: 8, rainDays: 2, heavyRain: 0, sun: 322, cloud: 50.6, rad: 21.4, wind: 8, gust: 43.1, windyDays: 19.7, hot30: 11.7, frost: 0 },
    { m: 5, feels: 21.3, hum: 52.3, precip: 63, rainDays: 10, heavyRain: 0, sun: 312, cloud: 61.8, rad: 20.7, wind: 7, gust: 36.4, windyDays: 11.3, hot30: 12.3, frost: 0 },
    { m: 6, feels: 23.4, hum: 69.7, precip: 192, rainDays: 18.3, heavyRain: 1.7, sun: 266, cloud: 76.6, rad: 19, wind: 5.6, gust: 27.5, windyDays: 2.3, hot30: 6, frost: 0 },
    { m: 7, feels: 25.6, hum: 71.6, precip: 186, rainDays: 17.3, heavyRain: 1.7, sun: 295, cloud: 78.9, rad: 19.9, wind: 4.7, gust: 25, windyDays: 1.3, hot30: 9, frost: 0 },
    { m: 8, feels: 25, hum: 74, precip: 279, rainDays: 20, heavyRain: 3.3, sun: 296, cloud: 74.9, rad: 18.7, wind: 3.8, gust: 21.5, windyDays: 0, hot30: 5.7, frost: 0 },
    { m: 9, feels: 23.5, hum: 73.3, precip: 171, rainDays: 18.3, heavyRain: 1.3, sun: 285, cloud: 66.6, rad: 17.6, wind: 4.4, gust: 23, windyDays: 0.3, hot30: 2, frost: 0 },
    { m: 10, feels: 18.3, hum: 72.8, precip: 110, rainDays: 15, heavyRain: 0.3, sun: 260, cloud: 66.7, rad: 13.8, wind: 5.6, gust: 24.1, windyDays: 0.3, hot30: 0.3, frost: 0 },
    { m: 11, feels: 12.5, hum: 65.2, precip: 59, rainDays: 7.7, heavyRain: 0, sun: 239, cloud: 47.8, rad: 11.8, wind: 5.4, gust: 23.3, windyDays: 1, hot30: 0, frost: 0 },
    { m: 12, feels: 9.4, hum: 55.9, precip: 5, rainDays: 2.3, heavyRain: 0, sun: 285, cloud: 34.3, rad: 12.2, wind: 5.4, gust: 27.8, windyDays: 4.7, hot30: 0, frost: 0 },
  ],
  // 通海县
  tonghai: [
    { m: 1, feels: 7.3, hum: 74.9, precip: 27, rainDays: 6.3, heavyRain: 0, sun: 243, cloud: 46.8, rad: 13.2, wind: 6.9, gust: 40.8, windyDays: 17, hot30: 0, frost: 1.3 },
    { m: 2, feels: 10.7, hum: 63.5, precip: 16, rainDays: 3.7, heavyRain: 0, sun: 264, cloud: 40.9, rad: 17.1, wind: 9, gust: 52.6, windyDays: 24.3, hot30: 0, frost: 0 },
    { m: 3, feels: 13.8, hum: 56.4, precip: 14, rainDays: 3.3, heavyRain: 0, sun: 307, cloud: 37.8, rad: 19.5, wind: 9.5, gust: 54.6, windyDays: 27, hot30: 0, frost: 0 },
    { m: 4, feels: 18.6, hum: 48, precip: 18, rainDays: 4, heavyRain: 0, sun: 334, cloud: 36.6, rad: 22.7, wind: 10, gust: 56.5, windyDays: 28.3, hot30: 1.7, frost: 0 },
    { m: 5, feels: 20.3, hum: 66.9, precip: 104, rainDays: 15.7, heavyRain: 0.7, sun: 318, cloud: 56.6, rad: 21.4, wind: 8, gust: 43.7, windyDays: 20, hot30: 4, frost: 0 },
    { m: 6, feels: 21.9, hum: 80.7, precip: 218, rainDays: 25.3, heavyRain: 1.7, sun: 278, cloud: 83, rad: 19.8, wind: 6.6, gust: 35.9, windyDays: 9, hot30: 1.3, frost: 0 },
    { m: 7, feels: 22.3, hum: 81.3, precip: 215, rainDays: 24.3, heavyRain: 1.3, sun: 314, cloud: 85.9, rad: 20.3, wind: 6.5, gust: 34.9, windyDays: 10, hot30: 0, frost: 0 },
    { m: 8, feels: 21.5, hum: 85.2, precip: 286, rainDays: 28, heavyRain: 2.7, sun: 296, cloud: 81.6, rad: 18.6, wind: 5, gust: 29.6, windyDays: 3, hot30: 0, frost: 0 },
    { m: 9, feels: 20.5, hum: 80.9, precip: 121, rainDays: 20.3, heavyRain: 0.7, sun: 299, cloud: 68.1, rad: 18.3, wind: 6.5, gust: 34.2, windyDays: 6.7, hot30: 0, frost: 0 },
    { m: 10, feels: 17.1, hum: 80.7, precip: 59, rainDays: 13, heavyRain: 0, sun: 260, cloud: 63.8, rad: 14.8, wind: 6.2, gust: 31.1, windyDays: 2.7, hot30: 0, frost: 0 },
    { m: 11, feels: 12.4, hum: 77.1, precip: 57, rainDays: 8.7, heavyRain: 0, sun: 228, cloud: 53.8, rad: 12.8, wind: 5.5, gust: 31.9, windyDays: 4, hot30: 0, frost: 0 },
    { m: 12, feels: 9.3, hum: 77.8, precip: 22, rainDays: 4.7, heavyRain: 0, sun: 251, cloud: 51.4, rad: 12.6, wind: 5.9, gust: 37.2, windyDays: 12.3, hot30: 0, frost: 0 },
  ],
};
