import type { Metadata } from "next";
import { LoopApp } from "@/components/loop/LoopApp";

export const metadata: Metadata = {
  title: "Loop Engineering",
  description: "人机闭环工程流程图:质疑-澄清循环 + 拆分-执行重试循环,源码即图,即时编辑。",
};

export default function LoopEngineeringPage() {
  return <LoopApp />;
}