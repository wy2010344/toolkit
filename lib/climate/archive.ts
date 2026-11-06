/**
 * 三十城「城市档案」——气候之外、影响旅居决策的软信息。
 *
 * ⚠️ 本文件全部为人工整理,非机器可读数据源,存在时效性偏差,仅作粗略参考,请以官方信息为准。
 * 字段口径:
 *   medical   医疗:三甲/三级医院资源与就近就医情况;
 *   transport 交通:民航与铁路通达度;
 *   cost      生活成本:房租 / 物价的相对水平(与其他候选城市横向比较);
 *   hazard    高原与灾害:海拔适应、地质灾害与地震风险。
 */
import type { CityId } from "./types";

export interface CityArchive {
  medical: string;
  transport: string;
  cost: string;
  hazard: string;
}

/** 字段展示顺序与标题。 */
export const ARCHIVE_FIELDS: Array<{ key: keyof CityArchive; label: string }> = [
  { key: "medical", label: "医疗" },
  { key: "transport", label: "交通" },
  { key: "cost", label: "生活成本" },
  { key: "hazard", label: "高原与灾害" },
];

/**
 * 可用于「物价 / 安全 / 便利」规则换算的事实值。
 *
 * 与上面的文字档案同源(都是从医疗 / 交通 / 生活成本 / 灾害四段描述里摘出来的),
 * 但这里只记事实、不打分;分数由 lib/climate/score.ts 里的规则统一换算,
 * 这样口径公开、可复现,换城市只要补这几项事实值,不必重新拍脑袋。
 */
export interface CityFacts {
  /** 房租中位数,元/㎡·月(取档案里区间的中点)。 */
  rent: number;
  /** 三级(含三甲)医院家数,超过 4 家按 4 计。 */
  hospitals: number;
  /** 是否有民航机场(含就近机场)。 */
  airport: boolean;
  /** 是否有铁路客运站(含动车、普速)。 */
  rail: boolean;
  /** 地震活跃度:0 低 / 1 中 / 2 高。 */
  seismic: 0 | 1 | 2;
  /** 是否受台风影响。 */
  typhoon: boolean;
  /** 是否有较高地质灾害风险(滑坡 / 泥石流 / 岩溶)。 */
  geoHazard: boolean;
}

export const FACTS: Record<CityId, CityFacts> = {
  kunming: { rent: 27.5, hospitals: 4, airport: true, rail: true, seismic: 1, typhoon: false, geoHazard: false },
  yuxi: { rent: 20, hospitals: 1, airport: false, rail: true, seismic: 1, typhoon: false, geoHazard: false },
  mengzi: { rent: 16, hospitals: 1, airport: true, rail: true, seismic: 2, typhoon: false, geoHazard: false },
  puer: { rent: 16, hospitals: 1, airport: true, rail: true, seismic: 1, typhoon: false, geoHazard: false },
  yongren: { rent: 11.5, hospitals: 0, airport: false, rail: false, seismic: 2, typhoon: false, geoHazard: false },
  chongqing: { rent: 35, hospitals: 4, airport: true, rail: true, seismic: 0, typhoon: false, geoHazard: false },
  shenzhen: { rent: 90, hospitals: 4, airport: true, rail: true, seismic: 0, typhoon: true, geoHazard: false },
  qujing: { rent: 16, hospitals: 1, airport: false, rail: true, seismic: 1, typhoon: false, geoHazard: false },
  xingyi: { rent: 16, hospitals: 1, airport: true, rail: true, seismic: 0, typhoon: false, geoHazard: true },
  renhe: { rent: 16, hospitals: 0, airport: true, rail: true, seismic: 2, typhoon: false, geoHazard: false },
  lincang: { rent: 14, hospitals: 1, airport: true, rail: true, seismic: 2, typhoon: false, geoHazard: false },
  baoshan: { rent: 14, hospitals: 1, airport: true, rail: true, seismic: 2, typhoon: false, geoHazard: false },
  gejiu: { rent: 14, hospitals: 1, airport: false, rail: false, seismic: 1, typhoon: false, geoHazard: false },
  yuanyang: { rent: 11.5, hospitals: 0, airport: false, rail: false, seismic: 1, typhoon: false, geoHazard: true },
  lvchun: { rent: 10, hospitals: 0, airport: false, rail: false, seismic: 1, typhoon: false, geoHazard: true },
  honghe: { rent: 11.5, hospitals: 0, airport: false, rail: false, seismic: 1, typhoon: false, geoHazard: true },
  mojiang: { rent: 13, hospitals: 0, airport: false, rail: true, seismic: 1, typhoon: false, geoHazard: false },
  yuanjiang: { rent: 11.5, hospitals: 0, airport: false, rail: true, seismic: 1, typhoon: false, geoHazard: true },
  dali: { rent: 21.5, hospitals: 1, airport: true, rail: true, seismic: 2, typhoon: false, geoHazard: false },
  tengchong: { rent: 16, hospitals: 1, airport: true, rail: false, seismic: 2, typhoon: false, geoHazard: false },
  chuxiong: { rent: 16, hospitals: 1, airport: false, rail: true, seismic: 1, typhoon: false, geoHazard: false },
  chengjiang: { rent: 20, hospitals: 0, airport: false, rail: false, seismic: 0, typhoon: false, geoHazard: false },
  tonghai: { rent: 14, hospitals: 0, airport: false, rail: true, seismic: 1, typhoon: false, geoHazard: false },
  jianshui: { rent: 14, hospitals: 0, airport: false, rail: true, seismic: 1, typhoon: false, geoHazard: false },
  shiping: { rent: 11.5, hospitals: 0, airport: false, rail: false, seismic: 1, typhoon: false, geoHazard: false },
  mile: { rent: 14, hospitals: 0, airport: false, rail: true, seismic: 1, typhoon: false, geoHazard: false },
  luxi: { rent: 11.5, hospitals: 0, airport: false, rail: false, seismic: 0, typhoon: false, geoHazard: true },
  weishan: { rent: 14, hospitals: 0, airport: false, rail: false, seismic: 1, typhoon: false, geoHazard: true },
  pingbian: { rent: 11.5, hospitals: 0, airport: false, rail: true, seismic: 1, typhoon: false, geoHazard: true },
  jingdong: { rent: 11.5, hospitals: 0, airport: false, rail: false, seismic: 2, typhoon: false, geoHazard: false },
  xichang: { rent: 16, hospitals: 1, airport: true, rail: true, seismic: 2, typhoon: false, geoHazard: false },
  guangzhou: { rent: 50, hospitals: 4, airport: true, rail: true, seismic: 0, typhoon: true, geoHazard: false },
  zhuhai: { rent: 40, hospitals: 3, airport: true, rail: true, seismic: 0, typhoon: true, geoHazard: false },
  shantou: { rent: 25, hospitals: 3, airport: true, rail: true, seismic: 1, typhoon: true, geoHazard: false },
  shaoguan: { rent: 18, hospitals: 1, airport: true, rail: true, seismic: 0, typhoon: false, geoHazard: true },
  zhanjiang: { rent: 22, hospitals: 2, airport: true, rail: true, seismic: 0, typhoon: true, geoHazard: false },
  meizhou: { rent: 18, hospitals: 1, airport: true, rail: true, seismic: 0, typhoon: true, geoHazard: true },
  zhaoqing: { rent: 22, hospitals: 2, airport: false, rail: true, seismic: 0, typhoon: true, geoHazard: false },
  huizhou: { rent: 25, hospitals: 2, airport: true, rail: true, seismic: 0, typhoon: true, geoHazard: false },
  nanning: { rent: 25, hospitals: 4, airport: true, rail: true, seismic: 0, typhoon: true, geoHazard: false },
  liuzhou: { rent: 20, hospitals: 3, airport: true, rail: true, seismic: 0, typhoon: false, geoHazard: true },
  guilin: { rent: 22, hospitals: 2, airport: true, rail: true, seismic: 0, typhoon: false, geoHazard: true },
  wuzhou: { rent: 15, hospitals: 1, airport: true, rail: true, seismic: 0, typhoon: true, geoHazard: true },
  beihai: { rent: 18, hospitals: 1, airport: true, rail: true, seismic: 0, typhoon: true, geoHazard: false },
  baise: { rent: 15, hospitals: 1, airport: true, rail: true, seismic: 0, typhoon: false, geoHazard: true },
  hechi: { rent: 14, hospitals: 1, airport: true, rail: true, seismic: 0, typhoon: false, geoHazard: true },
  yulin: { rent: 16, hospitals: 1, airport: true, rail: true, seismic: 0, typhoon: true, geoHazard: true },
  guiyang: { rent: 25, hospitals: 4, airport: true, rail: true, seismic: 0, typhoon: false, geoHazard: true },
  zunyi: { rent: 20, hospitals: 2, airport: true, rail: true, seismic: 0, typhoon: false, geoHazard: true },
  liupanshui: { rent: 16, hospitals: 1, airport: true, rail: true, seismic: 1, typhoon: false, geoHazard: true },
  anshun: { rent: 16, hospitals: 1, airport: true, rail: true, seismic: 0, typhoon: false, geoHazard: true },
  bijie: { rent: 15, hospitals: 1, airport: true, rail: true, seismic: 0, typhoon: false, geoHazard: true },
  tongren: { rent: 15, hospitals: 1, airport: true, rail: true, seismic: 0, typhoon: false, geoHazard: true },
  kaili: { rent: 15, hospitals: 1, airport: true, rail: true, seismic: 0, typhoon: false, geoHazard: true },
  chengdu: { rent: 40, hospitals: 4, airport: true, rail: true, seismic: 1, typhoon: false, geoHazard: false },
  mianyang: { rent: 22, hospitals: 2, airport: true, rail: true, seismic: 2, typhoon: false, geoHazard: true },
  yibin: { rent: 18, hospitals: 1, airport: true, rail: true, seismic: 1, typhoon: false, geoHazard: true },
  luzhou: { rent: 18, hospitals: 1, airport: true, rail: true, seismic: 1, typhoon: false, geoHazard: true },
  nanchong: { rent: 16, hospitals: 1, airport: true, rail: true, seismic: 0, typhoon: false, geoHazard: false },
  dazhou: { rent: 15, hospitals: 1, airport: true, rail: true, seismic: 0, typhoon: false, geoHazard: true },
  kangding: { rent: 16, hospitals: 1, airport: true, rail: false, seismic: 2, typhoon: false, geoHazard: true },
  maerkang: { rent: 15, hospitals: 1, airport: false, rail: false, seismic: 2, typhoon: false, geoHazard: true },
};

/**
 * 城市规模:城区口径的常住人口与建成区面积。
 *
 * ⚠️ 同样为人工整理的 2022–2023 年约值,只求量级正确,不做排名依据;口径是「城区」而非「市域」,
 * 所以深圳、重庆用的是中心城区数,县城用的是县城建成区数。更新数据只需改这里。
 */
export interface CityScale {
  /** 城区常住人口,万人。 */
  pop: number;
  /** 建成区面积,km²。 */
  area: number;
}

export const URBAN: Record<CityId, CityScale> = {
  kunming: { pop: 480, area: 430 },
  yuxi: { pop: 45, area: 48 },
  mengzi: { pop: 42, area: 40 },
  puer: { pop: 32, area: 31 },
  yongren: { pop: 6, area: 5 },
  chongqing: { pop: 1050, area: 1000 },
  shenzhen: { pop: 1760, area: 1210 },
  qujing: { pop: 85, area: 95 },
  xingyi: { pop: 52, area: 58 },
  renhe: { pop: 22, area: 18 },
  lincang: { pop: 28, area: 27 },
  baoshan: { pop: 42, area: 46 },
  gejiu: { pop: 30, area: 26 },
  yuanyang: { pop: 6, area: 4 },
  lvchun: { pop: 5, area: 3.5 },
  honghe: { pop: 8, area: 5 },
  mojiang: { pop: 13, area: 9 },
  yuanjiang: { pop: 11, area: 9 },
  dali: { pop: 62, area: 66 },
  tengchong: { pop: 36, area: 40 },
  chuxiong: { pop: 46, area: 52 },
  chengjiang: { pop: 13, area: 12 },
  tonghai: { pop: 19, area: 16 },
  jianshui: { pop: 26, area: 23 },
  shiping: { pop: 13, area: 11 },
  mile: { pop: 31, area: 32 },
  luxi: { pop: 16, area: 13 },
  weishan: { pop: 11, area: 9 },
  pingbian: { pop: 5, area: 4 },
  jingdong: { pop: 9, area: 7 },
  xichang: { pop: 72, area: 78 },
  guangzhou: { pop: 1000, area: 1200 },
  zhuhai: { pop: 220, area: 200 },
  shantou: { pop: 200, area: 220 },
  shaoguan: { pop: 60, area: 70 },
  zhanjiang: { pop: 150, area: 170 },
  meizhou: { pop: 60, area: 65 },
  zhaoqing: { pop: 90, area: 110 },
  huizhou: { pop: 160, area: 180 },
  nanning: { pop: 350, area: 350 },
  liuzhou: { pop: 200, area: 210 },
  guilin: { pop: 110, area: 120 },
  wuzhou: { pop: 60, area: 60 },
  beihai: { pop: 60, area: 70 },
  baise: { pop: 40, area: 45 },
  hechi: { pop: 30, area: 30 },
  yulin: { pop: 70, area: 75 },
  guiyang: { pop: 300, area: 350 },
  zunyi: { pop: 130, area: 140 },
  liupanshui: { pop: 70, area: 75 },
  anshun: { pop: 60, area: 65 },
  bijie: { pop: 60, area: 65 },
  tongren: { pop: 40, area: 40 },
  kaili: { pop: 40, area: 45 },
  chengdu: { pop: 1000, area: 1000 },
  mianyang: { pop: 110, area: 120 },
  yibin: { pop: 80, area: 85 },
  luzhou: { pop: 90, area: 95 },
  nanchong: { pop: 90, area: 95 },
  dazhou: { pop: 60, area: 65 },
  kangding: { pop: 8, area: 6 },
  maerkang: { pop: 5, area: 4 },
};

export const ARCHIVES: Record<CityId, CityArchive> = {
  kunming: {
    medical: "省会资源最强,三甲医院十余家(省一院、昆医附一院等)。",
    transport: "长水国际机场 + 高铁昆明南站 + 地铁网,通达度高。",
    cost: "省会里偏温和:房租约 20–35 元/㎡·月,物价中等。",
    hazard: "海拔约 1900 m,高原反应轻微;地震烈度较高,但城区风险可控。",
  },
  yuxi: {
    medical: "玉溪市人民医院为三甲,重症多转昆明(约 1 小时)。",
    transport: "有高铁玉溪站;无民航机场,靠昆明长水(约 1.5 小时)。",
    cost: "低于昆明一档,房租约 15–25 元/㎡·月。",
    hazard: "海拔约 1640 m,适中;处地震带边缘,需留意。",
  },
  mengzi: {
    medical: "红河州第一人民医院为三级,基本覆盖常见病。",
    transport: "弥蒙高铁已通(蒙自北站),近蒙自机场,出行便利。",
    cost: "低,房租约 12–20 元/㎡·月。",
    hazard: "海拔约 1310 m,红河断裂带附近,地震活动较活跃。",
  },
  puer: {
    medical: "普洱市人民医院为三甲,区域医疗中心。",
    transport: "思茅机场 + 中老铁路普洱站,铁路民航俱全。",
    cost: "中低,房租约 12–20 元/㎡·月。",
    hazard: "海拔约 1320 m,地震活动中等。",
  },
  yongren: {
    medical: "县医院为二级,重症需转楚雄或攀枝花。",
    transport: "无机场无高铁,主要靠公路,近攀枝花。",
    cost: "很低,房租约 8–15 元/㎡·月。",
    hazard: "海拔约 1540 m 干热河谷;处楚雄—南华地震带附近。",
  },
  chongqing: {
    medical: "三甲资源丰富(重医附一院等数十家),医疗强。",
    transport: "江北国际机场 + 高铁枢纽 + 密集地铁,通达度极高。",
    cost: "较高,房租约 25–45 元/㎡·月,物价中上。",
    hazard: "海拔低无高原问题;夏季酷热、山地地形起伏大。",
  },
  shenzhen: {
    medical: "三甲十余家(市人民医院等),医疗水平高。",
    transport: "宝安国际机场 + 深圳北高铁 + 地铁极密,通达度顶尖。",
    cost: "候选城市中最高,房租约 60–120 元/㎡·月。",
    hazard: "海拔低无高原问题;夏秋台风影响明显。",
  },
  qujing: {
    medical: "曲靖市第一人民医院为三甲,医疗尚可。",
    transport: "有高铁曲靖北站;无民航,近昆明长水。",
    cost: "低,房租约 12–20 元/㎡·月。",
    hazard: "海拔约 1875 m,略高于昆明;地震活动中等。",
  },
  xingyi: {
    medical: "黔西南州人民医院为三甲,覆盖州域。",
    transport: "万峰林机场 + 铁路通达,高铁线路持续完善中。",
    cost: "低,房租约 12–20 元/㎡·月。",
    hazard: "海拔约 1190 m;喀斯特地貌,注意岩溶与边坡。",
  },
  renhe: {
    medical: "区内多为二级,三甲在攀枝花市区(约 20 分钟车程)。",
    transport: "近攀枝花保安营机场;有成昆方向动车通达。",
    cost: "中低,房租约 12–20 元/㎡·月。",
    hazard: "海拔约 1100 m 干热河谷;处地震带,需留意。",
  },
  lincang: {
    medical: "市人民医院为三级,重症多转昆明。",
    transport: "临沧机场 + 大临铁路动车,通达度一般。",
    cost: "低,房租约 10–18 元/㎡·月。",
    hazard: "海拔约 1450 m;滇西南地震较活跃,雨季多雨。",
  },
  baoshan: {
    medical: "市人民医院为三级,基本满足日常。",
    transport: "保山机场 + 大瑞铁路动车,通达度一般。",
    cost: "低,房租约 10–18 元/㎡·月。",
    hazard: "海拔约 1650 m;地震活跃区,需关注抗震。",
  },
  gejiu: {
    medical: "有三级医院(红河州第三人民医院),医疗尚可。",
    transport: "无民航机场,靠铁路与公路,近蒙自。",
    cost: "低,房租约 10–18 元/㎡·月。",
    hazard: "海拔约 1690 m 山城;地震带附近,坡地较多。",
  },
  yuanyang: {
    medical: "县医院为二级,重症需转个旧或蒙自。",
    transport: "无机场无高铁,山路为主,元阳—南沙高差大。",
    cost: "很低,房租约 8–15 元/㎡·月。",
    hazard: "南沙镇海拔约 300 m 干热,梯田区约 1600 m 明显更凉;雨季滑坡风险高。",
  },
  lvchun: {
    medical: "县医院为二级,重症需转蒙自或个旧。",
    transport: "无机场铁路,公路为主,弯多路远。",
    cost: "很低,房租约 8–12 元/㎡·月。",
    hazard: "海拔约 1500 m;山高谷深,雨季地质灾害风险较高。",
  },
  honghe: {
    medical: "县域医院以二级为主,重症多转蒙自、个旧。",
    transport: "无民航机场与高铁,以公路为主,近元阳、蒙自。",
    cost: "低,房租约 8–15 元/㎡·月。",
    hazard: "海拔约 1000 m 的河谷县城;雨季滑坡、泥石流风险需留意。",
  },
  mojiang: {
    medical: "县域医院以二级为主,重症多转普洱或昆明。",
    transport: "有玉磨铁路墨江站与昆磨高速;无民航机场。",
    cost: "低,房租约 10–16 元/㎡·月。",
    hazard: "海拔约 1300 m;处地震带附近,雨季降水集中。",
  },
  yuanjiang: {
    medical: "县域医院以二级为主,重症多转玉溪或昆明。",
    transport: "有玉磨铁路元江站与昆磨高速;无民航机场。",
    cost: "低,房租约 8–15 元/㎡·月。",
    hazard: "海拔约 380 m 干热河谷,夏季酷热;注意高温与山洪。",
  },
  dali: {
    medical: "大理州人民医院为三级,大理市医院等满足日常,复杂病例多转昆明。",
    transport: "大理荒草坝机场 + 昆楚大铁路动车,民航与高铁俱全。",
    cost: "中等,房租约 15–28 元/㎡·月;古城与洱海沿岸明显更贵。",
    hazard: "海拔约 1990 m;洱海断陷盆地地震活动较活跃,冬春风大(下关风)。",
  },
  tengchong: {
    medical: "腾冲市人民医院为三级,重症多转保山或昆明。",
    transport: "有腾冲驼峰机场与高速;暂无铁路客运,通达度一般。",
    cost: "中低,房租约 12–20 元/㎡·月。",
    hazard: "海拔约 1640 m;滇西地震活跃区,雨季雨雾多、湿度大。",
  },
  chuxiong: {
    medical: "楚雄州人民医院为三甲,医疗服务覆盖州域。",
    transport: "有高铁楚雄站与昆楚高速;无民航机场,靠昆明长水。",
    cost: "低,房租约 12–20 元/㎡·月。",
    hazard: "海拔约 1770 m;处地震带附近,夏季降雨集中。",
  },
  chengjiang: {
    medical: "市域以二级医院为主,重症多转玉溪或昆明。",
    transport: "无机场与铁路客运,以公路为主,距昆明约 1 小时。",
    cost: "中低,房租约 15–25 元/㎡·月;抚仙湖畔房源偏贵。",
    hazard: "海拔约 1750 m,紧邻抚仙湖深水湖;注意水域安全与日晒。",
  },
  jianshui: {
    medical: "县医院为二级甲等,重症多转蒙自或昆明。",
    transport: "有玉蒙铁路建水站与高速;无民航机场。",
    cost: "低,房租约 10–18 元/㎡·月。",
    hazard: "海拔约 1310 m;地震带附近,夏季多雨。",
  },
  shiping: {
    medical: "县医院为二级,重症多转建水或蒙自。",
    transport: "无机场无高铁,公路为主,近建水。",
    cost: "很低,房租约 8–15 元/㎡·月。",
    hazard: "海拔约 1420 m;异龙湖流域,处地震带附近。",
  },
  mile: {
    medical: "市医院为二级,重症多转蒙自或昆明。",
    transport: "有弥蒙高铁弥勒站与高速;无民航机场。",
    cost: "低,房租约 10–18 元/㎡·月。",
    hazard: "海拔约 1400 m;地震活动中等,夏季雨量集中。",
  },
  luxi: {
    medical: "县医院为二级,重症多转蒙自或昆明。",
    transport: "无机场无高铁,公路为主,近弥勒、泸西高速。",
    cost: "很低,房租约 8–15 元/㎡·月。",
    hazard: "海拔约 1710 m;喀斯特地貌,留意岩溶塌陷与边坡。",
  },
  weishan: {
    medical: "县医院为二级,重症多转大理。",
    transport: "无机场无高铁,公路为主,距大理约 1 小时。",
    cost: "低,房租约 10–18 元/㎡·月。",
    hazard: "海拔约 1720 m;地震带附近,雨季山区易发生滑坡。",
  },
  pingbian: {
    medical: "县医院为二级,重症多转蒙自。",
    transport: "无民航机场,有昆河铁路屏边站;以公路为主。",
    cost: "很低,房租约 8–15 元/㎡·月。",
    hazard: "海拔约 1050 m;大围山区多雨,雨季滑坡、泥石流风险偏高。",
  },
  jingdong: {
    medical: "县医院为二级,重症多转普洱或昆明。",
    transport: "无机场无高铁,公路为主,近普洱。",
    cost: "很低,房租约 8–15 元/㎡·月。",
    hazard: "海拔约 1180 m;处无量山与哀牢山之间,地震较活跃。",
  },
  xichang: {
    medical: "凉山州第一人民医院为三甲,是区域医疗中心。",
    transport: "西昌青山机场 + 成昆铁路动车,通达度尚可。",
    cost: "中低,房租约 12–20 元/㎡·月。",
    hazard: "海拔约 1510 m;安宁河断裂带地震活跃,紫外线强、昼夜温差大。",
  },
  tonghai: {
    medical: "通海县人民医院为二级甲等,是县域紧密型医共体牵头医院;重症多转玉溪或昆明。",
    transport: "昆玉河铁路通海站可乘动车,到昆明南站约 1 小时;昆玉、呈通、通龙等高速在通海交汇,距长水机场约 130 km(车程 1.5 小时)。",
    cost: "低,房租约 10–18 元/㎡·月,古城与杞麓湖畔房源适中。",
    hazard: "海拔约 1800 m,高原反应轻微;杞麓湖畔注意涉水与日晒;雨季(5–10 月)降水集中,地震带边缘需留意。",
  },
  guangzhou: {
    medical: "三甲医院数十家(中山一院、省人民医院等),医疗资源居全国前列。",
    transport: "白云国际机场 + 广州南站高铁枢纽 + 密集地铁,通达度顶尖。",
    cost: "偏高,房租约 35–70 元/㎡·月;老城区与近郊价差大。",
    hazard: "海拔低无高原问题;夏秋台风外围影响,回南天潮湿。",
  },
  zhuhai: {
    medical: "有三甲(珠海市人民医院等),重症可转广州、澳门。",
    transport: "金湾机场 + 珠机与广珠城际,经港珠澳大桥连通港澳。",
    cost: "较高,房租约 28–55 元/㎡·月,横琴与情侣路沿线更贵。",
    hazard: "海拔低无高原问题;台风影响明显,夏秋多雨。",
  },
  shantou: {
    medical: "三甲数家(汕大附一院等),是粤东区域医疗中心。",
    transport: "揭阳潮汕国际机场约 40 分钟 + 汕头站高铁,通达度尚可。",
    cost: "中等,房租约 18–35 元/㎡·月,物价温和。",
    hazard: "海拔低无高原问题;处沿海地震带边缘,台风影响明显。",
  },
  shaoguan: {
    medical: "粤北人民医院为三甲,基本满足日常,重症多转广州。",
    transport: "韶关丹霞机场 + 韶关站高铁,京广线通达。",
    cost: "低,房租约 12–25 元/㎡·月。",
    hazard: "海拔约 100 m 的丘陵盆地;夏季暴雨,山区注意滑坡。",
  },
  zhanjiang: {
    medical: "广东医附院等三甲,是粤西区域医疗中心。",
    transport: "吴川机场 + 湛江西站高铁,通达度尚可。",
    cost: "中低,房租约 15–28 元/㎡·月。",
    hazard: "海拔低无高原问题;台风登陆频繁,夏秋风雨强。",
  },
  meizhou: {
    medical: "梅州市人民医院为三甲,覆盖粤东北。",
    transport: "梅州梅县机场 + 梅州西站高铁,通达度一般。",
    cost: "低,房租约 12–22 元/㎡·月。",
    hazard: "海拔约 80 m 的山间盆地;台风外围与雨季暴雨,注意山区地质灾害。",
  },
  zhaoqing: {
    medical: "肇庆市第一人民医院为三甲,重症可转广州。",
    transport: "肇庆东站高铁约 40 分钟到广州;无民航机场,靠白云。",
    cost: "中低,房租约 15–28 元/㎡·月。",
    hazard: "海拔低无高原问题;西江汛期需防洪水,台风外围有风雨。",
  },
  huizhou: {
    medical: "惠州市中心人民医院等三甲,医疗尚可。",
    transport: "惠州平潭机场 + 惠州北站高铁,近深圳。",
    cost: "中低,房租约 18–32 元/㎡·月。",
    hazard: "海拔低无高原问题;沿海台风影响明显,夏秋多雨。",
  },
  nanning: {
    medical: "广西医科大一附院等三甲,是全区医疗中心。",
    transport: "吴圩国际机场 + 南宁东站高铁枢纽 + 地铁,通达度高。",
    cost: "中低,房租约 18–32 元/㎡·月。",
    hazard: "海拔约 80 m 的盆地;台风外围偶有影响,夏季湿热。",
  },
  liuzhou: {
    medical: "柳州市人民医院等三甲,工业城市医疗较强。",
    transport: "白莲机场 + 柳州站高铁,通达度尚可。",
    cost: "低,房租约 14–26 元/㎡·月。",
    hazard: "海拔约 90 m;喀斯特地貌,注意岩溶塌陷与边坡。",
  },
  guilin: {
    medical: "桂林医学院附院等三甲,医疗尚可。",
    transport: "两江国际机场 + 桂林北站高铁,通达度高。",
    cost: "中低,房租约 15–30 元/㎡·月,景区周边偏贵。",
    hazard: "海拔约 150 m;喀斯特峰林,雨季漓江涨水需防内涝。",
  },
  wuzhou: {
    medical: "梧州市人民医院为三级,重症多转南宁或广州。",
    transport: "西江机场 + 梧州南站高铁,通达度一般。",
    cost: "低,房租约 12–22 元/㎡·月。",
    hazard: "海拔约 50 m;西江汛期洪水风险,山区注意滑坡。",
  },
  beihai: {
    medical: "北海市人民医院为三级,重症多转南宁。",
    transport: "福成机场 + 北海站动车,通达度尚可。",
    cost: "中低,房租约 14–26 元/㎡·月,海景房偏贵。",
    hazard: "海拔低无高原问题;台风影响明显,夏秋多雨。",
  },
  baise: {
    medical: "右江民族医学院附院为三甲,覆盖桂西。",
    transport: "百色巴马机场 + 百色站动车,通达度一般。",
    cost: "低,房租约 12–20 元/㎡·月。",
    hazard: "海拔约 120 m 的河谷;雨季山区滑坡、泥石流风险需留意。",
  },
  hechi: {
    medical: "河池市人民医院为三级,重症多转南宁或柳州。",
    transport: "金城江机场 + 金城江站动车与普速,通达度一般。",
    cost: "低,房租约 10–18 元/㎡·月。",
    hazard: "海拔约 190 m 的山城;喀斯特地貌,注意岩溶与边坡。",
  },
  yulin: {
    medical: "玉林市第一人民医院为三甲,覆盖桂东南。",
    transport: "福绵机场 + 玉林站动车,通达度尚可。",
    cost: "低,房租约 12–22 元/㎡·月。",
    hazard: "海拔约 80 m;台风外围与雨季暴雨,注意山洪与地质灾害。",
  },
  guiyang: {
    medical: "贵州省人民医院等三甲,是全省医疗中心。",
    transport: "龙洞堡国际机场 + 贵阳北站高铁枢纽 + 地铁,通达度高。",
    cost: "中低,房租约 18–32 元/㎡·月。",
    hazard: "海拔约 1100 m,高原反应轻微;喀斯特地貌,冬季湿冷。",
  },
  zunyi: {
    medical: "遵义医科大学附院为三甲,医疗较强。",
    transport: "新舟机场 + 遵义站高铁,通达度尚可。",
    cost: "低,房租约 13–24 元/㎡·月。",
    hazard: "海拔约 850 m;喀斯特地貌,雨季注意滑坡与内涝。",
  },
  liupanshui: {
    medical: "六盘水市人民医院为三级,重症多转贵阳。",
    transport: "月照机场 + 六盘水站高铁,通达度一般。",
    cost: "低,房租约 12–22 元/㎡·月。",
    hazard: "海拔约 1800 m,夏季凉爽;处地震带边缘,山区地质灾害需留意。",
  },
  anshun: {
    medical: "安顺市人民医院为三级,重症多转贵阳。",
    transport: "黄果树机场 + 安顺西站高铁,近贵阳。",
    cost: "低,房租约 12–22 元/㎡·月。",
    hazard: "海拔约 1300 m;喀斯特地貌,注意岩溶塌陷与边坡。",
  },
  bijie: {
    medical: "毕节市第一人民医院为三级,重症多转贵阳。",
    transport: "飞雄机场 + 毕节站高铁,通达度一般。",
    cost: "低,房租约 10–20 元/㎡·月。",
    hazard: "海拔约 1500 m;高原反应轻微,山区雨季地质灾害风险偏高。",
  },
  tongren: {
    medical: "铜仁市人民医院为三级,重症多转贵阳或怀化。",
    transport: "凤凰机场 + 铜仁站高铁,通达度一般。",
    cost: "低,房租约 10–18 元/㎡·月。",
    hazard: "海拔约 300 m 的河谷;雨季暴雨集中,注意山洪与滑坡。",
  },
  kaili: {
    medical: "黔东南州人民医院为三级,重症多转贵阳。",
    transport: "黄平机场就近 + 凯里南站高铁,通达度一般。",
    cost: "低,房租约 10–18 元/㎡·月。",
    hazard: "海拔约 600 m;苗岭山区雨季多雨,注意滑坡与泥石流。",
  },
  chengdu: {
    medical: "华西医院等三甲数十家,医疗资源居全国前列。",
    transport: "双流与天府双机场 + 成都东站高铁 + 密集地铁,通达度顶尖。",
    cost: "偏高,房租约 28–60 元/㎡·月,高新区与市中心价差大。",
    hazard: "海拔约 500 m 的平原;龙门山断裂带在西北侧,冬季湿冷、日照少。",
  },
  mianyang: {
    medical: "绵阳市中心医院等三甲,是川北区域医疗中心。",
    transport: "南郊机场 + 绵阳站高铁,通达度尚可。",
    cost: "中低,房租约 15–28 元/㎡·月。",
    hazard: "海拔约 470 m;龙门山断裂带附近,地震风险较高,雨季山区注意滑坡。",
  },
  yibin: {
    medical: "宜宾市第一人民医院等三甲,医疗尚可。",
    transport: "五粮液机场 + 宜宾西站高铁,通达度尚可。",
    cost: "低,房租约 12–24 元/㎡·月。",
    hazard: "海拔约 280 m 的河谷;夏季湿热,雨季注意山洪与滑坡。",
  },
  luzhou: {
    medical: "西南医科大学附院为三甲,医疗较强。",
    transport: "云龙机场 + 泸州站高铁,通达度尚可。",
    cost: "低,房租约 12–24 元/㎡·月。",
    hazard: "海拔约 240 m 的河谷;夏季酷热,雨季注意山洪与地质灾害。",
  },
  nanchong: {
    medical: "南充市中心医院为三甲,覆盖川东北。",
    transport: "高坪机场 + 南充北站高铁,通达度尚可。",
    cost: "低,房租约 12–22 元/㎡·月。",
    hazard: "海拔约 300 m 的丘陵;夏季湿热,嘉陵江汛期需防洪水。",
  },
  dazhou: {
    medical: "达州市中心医院为三甲,覆盖川东。",
    transport: "金垭机场 + 达州站高铁,通达度一般。",
    cost: "低,房租约 10–20 元/㎡·月。",
    hazard: "海拔约 300 m 的河谷;夏季酷热,雨季山区注意滑坡与山洪。",
  },
  kangding: {
    medical: "甘孜州人民医院为三级,重症多转成都,急救通达差。",
    transport: "康定机场 + 雅康高速;暂无铁路客运(川藏铁路在建)。",
    cost: "中低,房租约 12–20 元/㎡·月,旅游旺季房源紧张。",
    hazard: "海拔约 2560 m,高原反应明显,需逐步适应;地震活动活跃,紫外线强、昼夜温差大。",
  },
  maerkang: {
    medical: "阿坝州人民医院为三级,重症多转成都,路途远。",
    transport: "无民航机场与铁路,以公路为主,近阿坝红原机场。",
    cost: "低,房租约 10–18 元/㎡·月。",
    hazard: "海拔约 2600 m,高原反应明显;地震活跃,冬季寒冷、日照强。",
  },
};
