/**
 * 十五城「城市档案」——气候之外、影响旅居决策的软信息。
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
};
