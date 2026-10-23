import type { Metadata } from "next";
import { DirDiffApp } from "@/components/dirdiff/DirDiffApp";

export const metadata: Metadata = {
  title: "目录对比同步",
  description: "逐文件哈希对比两个目录的内容差异,支持文本差异查看与按方向同步。",
};

export default function DirDiffPage() {
  // Vercel 等云端环境无法访问访客本机的文件系统与 git,此工具仅本地可用。
  const hosted = process.env.VERCEL === "1";
  return <DirDiffApp hosted={hosted} />;
}
