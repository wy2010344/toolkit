"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Notice, Spinner } from "@/components/ui";
import { ArrowClockwise, Copy, Cube, DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { LOOP_PRESETS, type LoopPreset } from "./presets";

const LIGHT_VARS = {
  background: "#ffffff",
  primaryColor: "#f5f3ee",
  primaryTextColor: "#211f1b",
  primaryBorderColor: "#d6d2c8",
  secondaryColor: "#fbf3db",
  tertiaryColor: "#f9e3e4",
  lineColor: "#76726a",
  textColor: "#211f1b",
  clusterBkg: "#efede8",
  clusterBorder: "#d6d2c8",
  edgeLabelBackground: "#ffffff",
  nodeBorder: "#d6d2c8",
  fontSize: "14px",
};

const DARK_VARS = {
  background: "#171614",
  primaryColor: "#232120",
  primaryTextColor: "#eceae4",
  primaryBorderColor: "#3a3730",
  secondaryColor: "#3b2f0d",
  tertiaryColor: "#4a2426",
  lineColor: "#9b978e",
  textColor: "#eceae4",
  clusterBkg: "#1d1c19",
  clusterBorder: "#3a3730",
  edgeLabelBackground: "#171614",
  nodeBorder: "#3a3730",
  fontSize: "14px",
};

export function LoopApp() {
  const [draft, setDraft] = useState(LOOP_PRESETS[0].code);
  const [code, setCode] = useState(LOOP_PRESETS[0].code);
  const [activeId, setActiveId] = useState<string>(LOOP_PRESETS[0].id);
  const [dark, setDark] = useState(false);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setDark(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const cleanupOrphans = () => {
      document
        .querySelectorAll('body > div[id^="loop-mmd-"], body > svg[id^="loop-mmd-"]')
        .forEach((el) => el.remove());
    };
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
          themeVariables: dark ? DARK_VARS : LIGHT_VARS,
          flowchart: { curve: "basis", padding: 14, nodeSpacing: 42, rankSpacing: 60 },
        });
        const id = `loop-mmd-${Math.random().toString(36).slice(2, 9)}`;
        const { svg: out } = await mermaid.render(id, code);
        if (!cancelled) setSvg(out);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
        cleanupOrphans();
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [code, dark]);

  useEffect(
    () => () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    },
    [],
  );

  const handleChange = (value: string) => {
    setDraft(value);
    setActiveId("");
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => setCode(value), 500);
  };

  const handleRender = () => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    setCode(draft);
  };

  const pickPreset = (p: LoopPreset) => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    setDraft(p.code);
    setCode(p.code);
    setActiveId(p.id);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };

  const handleDownload = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "loop-engineering.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  const activePreset = LOOP_PRESETS.find((p) => p.id === activeId);

  return (
    <div className="flex flex-1 flex-col bg-canvas px-6 py-10">
      <div className="mx-auto w-full max-w-7xl">
        <header className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-ink">Loop Engineering 流程图</h1>
          <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-faint">
            一个人机协作的「闭环工程」模型:入口是用户与 AI 的质疑-修订循环,直到任务被审查通过;随后判定是否需要拆分,
            进入「拆分 → 执行 → 出错 → 换法重拆」的重试循环;重试超过上限则带着失败报告回到澄清循环。
            图即文本——编辑左栏的 Mermaid 源码,右栏实时重绘。
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* editor */}
          <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-surface">
            <header className="flex items-center justify-between border-b border-line bg-canvas/60 px-4 py-2.5">
              <div className="text-[13px] font-medium text-ink">图源代码 · Mermaid</div>
              <div className="flex items-center gap-1.5">
                <Button variant="subtle" className="h-7 px-2 text-xs" onClick={handleCopy}>
                  {copied ? <Cube size={13} /> : <Copy size={13} />}
                  {copied ? "已复制" : "复制源码"}
                </Button>
                <Button variant="subtle" className="h-7 px-2 text-xs" onClick={handleRender}>
                  <ArrowClockwise size={13} />
                  渲染
                </Button>
              </div>
            </header>
            <textarea
              value={draft}
              onChange={(e) => handleChange(e.target.value)}
              spellCheck={false}
              className="h-[420px] w-full resize-none bg-surface px-4 py-3 font-mono text-[12px] leading-5 text-ink outline-none placeholder:text-faint"
            />
            <footer className="flex flex-wrap items-center gap-1.5 border-t border-line bg-surface-mute/50 px-3 py-2.5">
              <span className="mr-1 inline-flex items-center gap-1 text-[11px] font-medium text-faint">
                <Cube size={12} />
                模板
              </span>
              {LOOP_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pickPreset(p)}
                  className={
                    "rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors " +
                    (activeId === p.id
                      ? "bg-ink text-white"
                      : "border border-line-strong bg-surface text-muted hover:border-faint hover:text-ink")
                  }
                >
                  {p.name}
                </button>
              ))}
            </footer>
          </section>

          {/* preview */}
          <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-surface">
            <header className="flex items-center justify-between border-b border-line bg-canvas/60 px-4 py-2.5">
              <div className="text-[13px] font-medium text-ink">
                渲染预览
                {activePreset && <span className="ml-2 font-normal text-faint">{activePreset.desc}</span>}
              </div>
              <Button variant="subtle" className="h-7 px-2 text-xs" onClick={handleDownload} disabled={!svg}>
                <DownloadSimple size={13} />
                下载 SVG
              </Button>
            </header>
            <div className="relative min-h-[420px] flex-1 overflow-auto bg-canvas/40 p-4">
              {error ? (
                <Notice tone="error" className="font-mono text-[11.5px]">
                  {error}
                </Notice>
              ) : svg ? (
                <div
                  className="mx-auto w-fit [&_svg]:max-w-none"
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[12px] text-faint">
                  等待渲染…
                </div>
              )}
              {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface/60">
                  <div className="flex items-center gap-2 text-[12.5px] text-muted">
                    <Spinner className="h-4 w-4" />
                    渲染中…
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        <footer className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11.5px] text-faint">
          <span>
            语法参考:
            <a
              href="https://mermaid.js.org/syntax/flowchart.html"
              target="_blank"
              rel="noreferrer"
              className="ml-1 text-muted underline decoration-line-strong underline-offset-2 hover:text-ink"
            >
              Mermaid flowchart 文档
            </a>
          </span>
          <span>菱形 = 判定 · 圆角 = 盒子 · 双圆 = 起止</span>
          <span>「attempt + 1」为每次重新拆分的尝试计数,上限用 &lt; 号表达</span>
        </footer>
      </div>
    </div>
  );
}