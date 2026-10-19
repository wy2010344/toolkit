import type { Metadata } from "next";
import { ClimateApp } from "@/components/climate/ClimateApp";

export const metadata: Metadata = {
  title: "旅居气候对比 · 工具箱",
  description:
    "对比昆明、玉溪、蒙自、普洱、永仁、曲靖、兴义、攀枝花仁和、临沧、保山、个旧、元阳、绿春、重庆、深圳 15 城的 12 个月气温:单城高低温带图,或多城同屏折线对比。",
};

export default function ClimatePage() {
  return <ClimateApp />;
}
