import type { Metadata } from "next";
import { ClimateApp } from "@/components/climate/ClimateApp";

export const metadata: Metadata = {
  title: "旅居气候对比",
  description:
    "对比 30 座候选城市(云南为主,兼顾四川、贵州、重庆、广东)的 12 个月气温:单城高低温带图,或多城同屏折线对比。",
};

export default function ClimatePage() {
  return <ClimateApp />;
}
