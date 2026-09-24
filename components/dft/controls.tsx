/**
 * DFT 演示用的轻量控件:滑杆与分段按钮。
 */
"use client";

import { cn } from "@/components/ui";

export function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  fmt,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  fmt: (v: number) => string;
}) {
  return (
    <label className="flex items-center gap-2.5 text-[11.5px] text-muted">
      <span className="w-20 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="h-1.5 w-full min-w-0 accent-[--color-ink]"
      />
      <span className="w-16 shrink-0 text-right font-mono text-[11px] text-ink">{fmt(value)}</span>
    </label>
  );
}

export function Seg({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: number; label: string }>;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-7 rounded-md px-2.5 font-mono text-[11px] transition-colors",
            value === o.value
              ? "bg-ink text-white"
              : "border border-line bg-surface text-muted hover:border-line-strong hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}