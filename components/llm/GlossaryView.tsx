/**
 * 术语表:专业术语的人话版。
 * 原则:一个词先看日常类比抓住直觉,再看一句话定义钉住准确含义——
 * 不让初学者迷失在术语里。支持关键词过滤。
 */
"use client";

import { useMemo, useState } from "react";
import { BookmarkSimple, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { GLOSSARY } from "./glossary";

export function GlossaryView() {
  const [q, setQ] = useState("");

  const groups = useMemo(() => {
    if (!q.trim()) return GLOSSARY;
    const needle = q.trim().toLowerCase();
    return GLOSSARY.map((g) => ({
      ...g,
      terms: g.terms.filter(
        (t) =>
          t.term.toLowerCase().includes(needle) ||
          t.en.toLowerCase().includes(needle) ||
          t.analogy.toLowerCase().includes(needle) ||
          t.def.toLowerCase().includes(needle),
      ),
    })).filter((g) => g.terms.length > 0);
  }, [q]);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <p className="font-mono text-[11px] uppercase tracking-widest text-acc-yellow-fg">glossary · 术语表</p>
      <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink">专业术语,人话版</h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
        遇到不懂的词就来这里查:每个词先给一句<strong className="text-ink-soft">日常类比</strong>
        让你有直觉,再给一句<strong className="text-ink-soft">人话定义</strong>把它钉准。术语只是给这些熟悉的道理起的名字。
      </p>

      <div className="relative mt-5 max-w-sm">
        <MagnifyingGlass size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索词条……"
          className="h-9 w-full rounded-md border border-line bg-surface pl-8 pr-3 font-mono text-[12.5px] text-ink outline-none placeholder:text-faint focus:border-line-strong"
        />
      </div>

      {groups.length === 0 && (
        <p className="mt-8 rounded-lg border border-line bg-surface p-4 text-[12.5px] text-muted">没搜到这个词,试试拆短一点。</p>
      )}

      {groups.map((g) => (
        <section key={g.group} className="mt-7">
          <h2 className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
            <BookmarkSimple size={14} weight="fill" className="text-acc-yellow-fg" />
            {g.group}
          </h2>
          <p className="mb-3 mt-1 text-[11.5px] leading-relaxed text-faint">{g.note}</p>
          <div className="space-y-2">
            {g.terms.map((t) => (
              <article key={t.term} className="rounded-xl border border-line bg-surface p-3.5">
                <header className="flex flex-wrap items-baseline gap-x-2">
                  <h3 className="font-mono text-[13px] font-semibold text-ink">{t.term}</h3>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-faint">{t.en}</span>
                </header>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
                  <span className="mr-1.5 rounded bg-acc-yellow-bg px-1 py-px font-mono text-[10px] text-acc-yellow-fg">类比</span>
                  {t.analogy}
                </p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{t.def}</p>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}