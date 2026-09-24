import type { Metadata } from "next";
import { DftLabApp } from "@/components/dft/DftLabApp";

export const metadata: Metadata = {
  title: "DFT 听音室 · 工具箱",
  description: "不用公式背,用代码和听的能力弄懂离散傅里叶变换:同声相应,异频相消。",
};

export default function DftLabPage() {
  return <DftLabApp />;
}