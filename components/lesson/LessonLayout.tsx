/**
 * 课程通用排版积木:题干、分步讲解、代码块、思考题。
 * 所有课程组件共用这一套视觉语言,保持风格统一。
 */
"use client";

import type { ReactNode } from "react";
import { SealQuestion } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/components/ui";

export function LessonShell({
  kicker,
  title,
  lead,
  children,
}: {
  kicker: string;
  title: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <p className="font-mono text-[11px] uppercase tracking-widest text-acc-yellow-fg">{kicker}</p>
      <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{lead}</p>
      <div className="mt-6 space-y-5">{children}</div>
    </div>
  );
}

export function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-[10px] text-white">
          {n}
        </span>
        {title}
      </h2>
      <div className="mt-2.5 space-y-2.5 text-[12.5px] leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}

export function DemoTray({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-canvas/60 p-4">
      <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
        <span className="h-1.5 w-1.5 rounded-full bg-acc-green-fg" />
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function CodeBlock({ code, className }: { code: string; className?: string }) {
  return (
    <pre
      className={cn(
        "overflow-x-auto rounded-lg border border-line bg-[#1b1a17] p-3 text-[11.5px] leading-relaxed text-[#d8d4c8]",
        className,
      )}
    >
      <code>{code}</code>
    </pre>
  );
}

export function Formula({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-md border border-line bg-surface-mute/60 px-3 py-2 font-mono text-[12px] text-ink">
      {children}
    </div>
  );
}

export function P({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={className}>{children}</p>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-surface-mute px-1 py-px font-mono text-[11px] text-ink">{children}</code>
  );
}

export function Question({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-lg border border-acc-yellow-fg/25 bg-acc-yellow-bg/50 px-3 py-2.5">
      <SealQuestion size={15} className="mt-0.5 shrink-0 text-acc-yellow-fg" weight="fill" />
      <div className="space-y-1.5 text-[12.5px] leading-relaxed text-ink">{children}</div>
    </div>
  );
}