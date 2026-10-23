import type { Metadata } from "next";
import { LlmLabApp } from "@/components/llm/LlmLabApp";

export const metadata: Metadata = {
  title: "LLM 实验室",
  description: "从零手写一个微型 LLM:分词、嵌入、注意力、Transformer、训练与生成,全部在浏览器里跑。",
};

export default function LlmLabPage() {
  return <LlmLabApp />;
}