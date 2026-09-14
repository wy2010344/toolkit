/**
 * 问题导向条:每课第一屏先讲"人的事",再谈"技术的事"。
 *
 * 整门课的心法:从需求出发,难点是被需求逼出来的,解法是逐个击破。
 * 所以每课开头固定三问——
 *   我们要解决什么 → 难点在哪 → 怎么击破
 * 先回答这三问,再进入实现细节。专业术语只是给这些"人话"起的名字。
 */
"use client";

import type { ReactNode } from "react";
import { SealCheck, Target, Warning } from "@phosphor-icons/react/dist/ssr";

function Block({
  icon,
  tone,
  label,
  text,
}: {
  icon: ReactNode;
  tone: "blue" | "orange" | "green";
  label: string;
  text: string;
}) {
  const iconBox = {
    blue: "bg-acc-blue-bg text-acc-blue-fg",
    orange: "bg-acc-orange-bg text-acc-orange-fg",
    green: "bg-acc-green-bg text-acc-green-fg",
  };
  return (
    <div className="flex gap-2.5">
      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${iconBox[tone]}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[11px] font-medium tracking-wide text-faint">{label}</div>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">{text}</p>
      </div>
    </div>
  );
}

export function ProblemStrip({
  problem,
  obstacle,
  solve,
}: {
  problem: string;
  obstacle: string;
  solve: string;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <div className="grid gap-3.5 sm:grid-cols-3">
        <Block icon={<Target size={14} weight="fill" />} tone="blue" label="我们要解决什么" text={problem} />
        <Block icon={<Warning size={14} weight="fill" />} tone="orange" label="难在哪" text={obstacle} />
        <Block icon={<SealCheck size={14} weight="fill" />} tone="green" label="怎么逐个击破" text={solve} />
      </div>
    </section>
  );
}