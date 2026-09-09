import Link from "next/link";
import { GitDiff } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "工具箱",
};

const TOOLS = [
  {
    href: "/tools/dir-diff",
    name: "目录对比同步",
    desc: "逐文件哈希对比两个目录的内容差异,文本文件内联查看 diff,支持按方向同步。",
    icon: <GitDiff size={22} />,
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center bg-canvas px-6 py-16">
      <header className="mb-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">工具箱</h1>
        <p className="mt-2 text-sm text-faint">本地运行的小工具合集</p>
      </header>
      <main className="grid w-full max-w-2xl gap-3">
        {TOOLS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group flex items-start gap-4 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-line-strong hover:bg-surface-mute/60"
          >
            <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-canvas text-muted transition-colors group-hover:text-ink">
              {t.icon}
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-ink">{t.name}</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-faint">{t.desc}</p>
            </div>
          </Link>
        ))}
      </main>
    </div>
  );
}