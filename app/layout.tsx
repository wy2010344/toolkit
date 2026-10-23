import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://toolkit-flax.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "工具箱",
    template: "%s · 工具箱",
  },
  description: "手写的交互式小工具合集:LLM 原理实验室、DFT 听音室、旅居气候对比、流程图编辑器、目录对比同步。浏览器里实时可玩。",
  openGraph: {
    title: "工具箱",
    description: "手写的交互式小工具合集,浏览器里实时可玩。",
    url: SITE_URL,
    siteName: "工具箱",
    type: "website",
    locale: "zh_CN",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}