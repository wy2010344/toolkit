import type { Metadata } from "next";
import { DirDiffApp } from "@/components/dirdiff/DirDiffApp";

export const metadata: Metadata = {
  title: "目录对比同步 · 工具箱",
  description: "逐文件哈希对比两个目录的内容差异,支持文本差异查看与按方向同步。",
};

export default function DirDiffPage() {
  return <DirDiffApp />;
}