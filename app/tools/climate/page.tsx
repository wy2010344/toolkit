import type { Metadata } from "next";
import { ClimateApp } from "@/components/climate/ClimateApp";

export const metadata: Metadata = {
  title: "旅居气候对比",
  description:
    "云南旅居气候地图册:把宜居度画成整幅云南的连续等值面,叠加等高线、等温线、等降水线与人口等值线,鼠标移到任意位置即可读出该点的气温与宜居度;另有全部候选城市的逐月气温带、逐月相对湿度与多城折线对比(温度 / 湿度指标可切换)。",
};

export default function ClimatePage() {
  return <ClimateApp />;
}
