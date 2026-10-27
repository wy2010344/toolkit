import Link from "next/link";
import { GitDiff, Atom, FlowArrow, Waveform, Thermometer } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "工具箱",
};

const TOOLS: {
  href: string;
  name: string;
  desc: string;
  icon: React.ReactNode;
  localOnly?: boolean;
}[] = [
  {
    href: "/tools/climate",
    name: "旅居气候对比",
    desc: "把宜居度画成整幅云南的连续等值面,鼠标移到任意位置即可读出气温与分数;另有 31 座候选城市的单城温度带、多城折线与偏好排行。",
    icon: <Thermometer size={22} />,
  },
  {
    href: "/tools/llm-lab",
    name: "LLM 实验室",
    desc: "从零手写一个微型 LLM,8 节课带你走完分词到生成的完整原理,全部代码可读、可改、可跑。",
    icon: <Atom size={22} />,
  },
  {
    href: "/tools/dft-lab",
    name: "DFT 听音室",
    desc: "不用背公式,用可跑的 TS 例程弄懂离散傅里叶变换:同声相应、异频相消。",
    icon: <Waveform size={22} />,
  },
  {
    href: "/tools/loop-engineering",
    name: "Loop Engineering 流程图",
    desc: "人机闭环工程模型:澄清循环 + 拆分执行重试循环,源码即图,改 Mermaid 文本即时重绘。",
    icon: <FlowArrow size={22} />,
  },
  {
    href: "/tools/dir-diff",
    name: "目录对比同步",
    desc: "逐文件哈希对比两个目录的内容差异,文本文件内联查看 diff,支持按方向同步。",
    icon: <GitDiff size={22} />,
    localOnly: true,
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center bg-canvas px-6 py-16">
      <header className="mb-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">工具箱</h1>
        <p className="mt-2 text-sm text-faint">手写的交互式小工具合集,浏览器里实时可玩</p>
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
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                {t.name}
                {t.localOnly && (
                  <span className="rounded border border-line bg-canvas px-1.5 py-0.5 text-[10.5px] font-normal text-faint">
                    仅本地运行
                  </span>
                )}
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-faint">{t.desc}</p>
            </div>
          </Link>
        ))}
      </main>
    </div>
  );
}
