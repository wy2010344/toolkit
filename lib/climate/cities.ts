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
  {
    id: "qujing",
    name: "曲靖",
    region: "云南",
    lat: 25.49,
    lon: 103.8,
    elevation: 1875,
    note: "滇东高原坝子,海拔偏高,夏季凉爽、冬季比昆明略冷。",
  },
  {
    id: "xingyi",
    name: "兴义",
    region: "贵州",
    lat: 25.1,
    lon: 104.91,
    elevation: 1192,
    note: "黔西南州府,海拔适中,夏无酷暑、冬较温和,南盘江畔。",
  },
  {
    id: "renhe",
    name: "攀枝花仁和",
    region: "四川",
    lat: 26.5,
    lon: 101.72,
    elevation: 1100,
    note: "金沙江干热河谷,冬暖如春、日照极足,夏季午后偏热。",
  },
  {
    id: "lincang",
    name: "临沧",
    region: "云南",
    lat: 23.89,
    lon: 100.09,
    elevation: 1450,
    note: "滇西南低纬高原,冬暖夏温,昼夜温差较大、雨量充沛。",
  },
  {
    id: "baoshan",
    name: "保山",
    region: "云南",
    lat: 25.11,
    lon: 99.16,
    elevation: 1650,
    note: "滇西坝子,怒江与澜沧江之间,四季温和,冬不冷夏不热。",
  },
  {
    id: "gejiu",
    name: "个旧",
    region: "云南",
    lat: 23.36,
    lon: 103.15,
    elevation: 1688,
    note: "滇南高海拔山城,全年温和,夏季尤其凉爽。",
  },
  {
    id: "yuanyang",
    name: "元阳",
    region: "云南",
    lat: 23.22,
    lon: 102.83,
    elevation: 300,
    note: "县城南沙镇地处红河干热河谷,冬季温暖、夏季较热;梯田区(新街)海拔约 1600 m,明显更凉。",
  },
  {
    id: "lvchun",
    name: "绿春",
    region: "云南",
    lat: 22.99,
    lon: 102.4,
    elevation: 1500,
    note: "滇南高海拔山区县城,云雾多、全年凉爽湿润。",
  },
  {
    id: "honghe",
    name: "红河县",
    region: "云南",
    lat: 23.37,
    lon: 102.42,
    elevation: 1000,
    note: "县城迤萨镇地处红河(元江)河谷,海拔约 1000 m;冬暖、夏季温和,干湿季分明。",
  },
  {
    id: "mojiang",
    name: "墨江县",
    region: "云南",
    lat: 23.43,
    lon: 101.69,
    elevation: 1300,
    note: "北回归线穿城而过,海拔约 1300 m;冬无严寒、夏无酷暑,气候温和湿润。",
  },
  {
    id: "yuanjiang",
    name: "元江县",
    region: "云南",
    lat: 23.6,
    lon: 101.99,
    elevation: 380,
    note: "县城位于元江干热河谷,海拔仅约 380 m;冬季温暖,但夏季酷热(7 月均温近 28 ℃),求夏凉需选高海拔乡镇。",
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
