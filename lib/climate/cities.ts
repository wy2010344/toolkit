/**
 * 城市元数据与逐月数据的组装层。
 */
import { MONTHLY_NORMALS } from "./data";
import type { CityClimate, CityId, CityMeta } from "./types";

/** 城市静态信息,数组顺序即界面展示顺序。 */
export const CITIES: CityMeta[] = [
  {
    id: "kunming",
    name: "昆明",
    region: "云南",
    lat: 25.04,
    lon: 102.71,
    elevation: 1902,
    note: "四季如春的高原湖城,全年温差极小,雨季集中在夏秋。",
  },
  {
    id: "yuxi",
    name: "玉溪",
    region: "云南",
    lat: 24.35,
    lon: 102.54,
    elevation: 1638,
    note: "比昆明略暖,冬无严寒、夏无酷暑,气候平稳宜人。",
  },
  {
    id: "mengzi",
    name: "蒙自",
    region: "云南",
    lat: 23.36,
    lon: 103.39,
    elevation: 1307,
    note: "滇南坝子,冬暖夏不酷热,日照充足、干湿分明。",
  },
  {
    id: "puer",
    name: "普洱",
    region: "云南",
    lat: 22.79,
    lon: 100.97,
    elevation: 1317,
    note: "滇西南温润小城,全年温和,冬暖夏不热,雨量充沛。",
  },
  {
    id: "yongren",
    name: "永仁县",
    region: "云南",
    lat: 26.06,
    lon: 101.67,
    elevation: 1543,
    note: "金沙江干热河谷,冬春温和、日照长,昼夜温差偏大。",
  },
  {
    id: "chongqing",
    name: "重庆",
    region: "重庆",
    lat: 29.56,
    lon: 106.55,
    elevation: 249,
    note: "夏长酷热、冬短温和,七八月是著名的“火炉”高温期。",
  },
  {
    id: "shenzhen",
    name: "深圳",
    region: "广东",
    lat: 22.54,
    lon: 114.06,
    elevation: 8,
    note: "南亚热带海洋性气候,全年偏暖基本无冬,夏季长而湿热。",
  },
];

/** 把元数据与逐月数据拼成完整气候对象。 */
export const CLIMATES: CityClimate[] = CITIES.map((c) => ({
  ...c,
  months: MONTHLY_NORMALS[c.id].map(([max, min, mean], i) => ({ m: i + 1, max, min, mean })),
}));

/** 按 id 取完整气候对象。 */
export function climateOf(id: CityId): CityClimate {
  const found = CLIMATES.find((c) => c.id === id);
  if (!found) throw new Error(`未知城市:${id}`);
  return found;
}
