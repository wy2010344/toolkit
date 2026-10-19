import type { Metadata } from "next";
import { ClimateApp } from "@/components/climate/ClimateApp";

export const metadata: Metadata = {
  title: "旅居气候对比 · 工具箱",
  description:
    "对比昆明、玉溪、蒙自、普洱、永仁、重庆、深圳的 12 个月气温变化:每月最高温、最低温、平均温一目了然。",
};

export default function ClimatePage() {
  return <ClimateApp />;
}
