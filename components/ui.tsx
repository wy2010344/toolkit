import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { X } from "@phosphor-icons/react/dist/ssr";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */
/* Badges                                                               */
/* ------------------------------------------------------------------ */

export interface StatusMeta {
  label: string;
  cls: string;
}

export const STATUS_META: Record<string, StatusMeta> = {
  "left-only": { label: "仅 A", cls: "bg-acc-blue-bg text-acc-blue-fg" },
  "right-only": { label: "仅 B", cls: "bg-acc-yellow-bg text-acc-yellow-fg" },
  modified: { label: "已修改", cls: "bg-acc-red-bg text-acc-red-fg" },
  equal: { label: "相同", cls: "bg-acc-green-bg text-acc-green-fg" },
  conflict: { label: "冲突", cls: "bg-acc-orange-bg text-acc-orange-fg" },
};

export function StatusBadge({ status, muted }: { status: string; muted?: boolean }) {
  const meta = STATUS_META[status] ?? { label: status, cls: "bg-surface-mute text-muted" };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-medium tracking-wider uppercase",
        meta.cls,
        muted && status === "equal" && "opacity-45",
      )}
    >
      {meta.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                              */
/* ------------------------------------------------------------------ */

type ButtonVariant = "primary" | "subtle" | "ghost" | "danger";

export function Button({
  variant = "primary",
  className,
  loading,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean }) {
  const styles: Record<ButtonVariant, string> = {
    primary: "bg-ink text-white hover:bg-ink-soft active:scale-[0.98] disabled:bg-ink/50",
    subtle: "border border-line-strong bg-surface text-ink hover:border-faint hover:bg-surface-mute active:scale-[0.98] disabled:opacity-50",
    ghost: "text-muted hover:bg-surface-mute hover:text-ink disabled:opacity-50",
    danger: "bg-acc-red-fg text-white hover:opacity-90 active:scale-[0.98] disabled:opacity-50",
  };
  return (
    <button
      className={cn(
        "inline-flex h-8 select-none items-center justify-center gap-1.5 rounded-[6px] px-3 text-[13px] font-medium transition-[background,transform,opacity] duration-150 disabled:cursor-not-allowed",
        styles[variant],
        loading && "pointer-events-none opacity-70",
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-mute hover:text-ink",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Inputs                                                               */
/* ------------------------------------------------------------------ */

export function TextField({
  label,
  hint,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string }) {
  return (
    <label className={cn("block", className)}>
      {label && <span className="mb-1 block text-xs font-medium text-muted">{label}</span>}
      <input
        className="h-9 w-full rounded-md border border-line bg-surface px-2.5 font-mono text-[13px] text-ink outline-none placeholder:text-faint focus:border-line-strong focus:ring-2 focus:ring-ink/10"
        {...rest}
      />
      {hint && <span className="mt-1 block text-[11px] text-faint">{hint}</span>}
    </label>
  );
}

export function TextArea({
  label,
  rows = 4,
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; rows?: number }) {
  return (
    <label className={cn("block", className)}>
      {label && <span className="mb-1 block text-xs font-medium text-muted">{label}</span>}
      <textarea
        rows={rows}
        className="w-full resize-y rounded-md border border-line bg-surface px-2.5 py-2 font-mono text-[12px] leading-5 text-ink outline-none placeholder:text-faint focus:border-line-strong focus:ring-2 focus:ring-ink/10"
        {...rest}
      />
    </label>
  );
}

export function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="group flex items-start gap-2.5 text-left">
      <span
        className={cn(
          "mt-0.5 flex h-4.5 w-8 shrink-0 items-center rounded-full p-0.5 transition-colors",
          checked ? "bg-ink" : "bg-line-strong",
        )}
      >
        <span className={cn("h-3.5 w-3.5 rounded-full bg-white transition-transform", checked && "translate-x-3.5")} />
      </span>
      <span>
        <span className="block text-[13px] font-medium text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-[11px] text-faint">{hint}</span>}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Feedback                                                             */
/* ------------------------------------------------------------------ */

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className ?? "h-4 w-4")} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function ProgressBar({ value, className }: { value: number | null; className?: string }) {
  return (
    <div className={cn("h-1 w-full overflow-hidden rounded-full bg-line", className)}>
      {value === null ? (
        <div className="dirdiff-bar-indeterminate h-full w-2/5 rounded-full bg-ink/70" />
      ) : (
        <div
          className="h-full rounded-full bg-ink/70 transition-[width] duration-300"
          style={{ width: `${Math.round(Math.min(100, Math.max(0, value)))}%` }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal                                                                */
/* ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  wide,
  fullscreen = false,
  action,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  wide?: boolean;
  fullscreen?: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className={cn("fixed inset-0 z-50 flex items-center justify-center", !fullscreen && "p-4 sm:p-8")}>
      <div className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative flex flex-col overflow-hidden border border-line bg-surface",
          fullscreen
            ? "h-full w-full border-0"
            : cn(
                "max-h-[88vh] w-full rounded-xl shadow-[0_32px_90px_-24px_rgba(0,0,0,0.45)]",
                wide ? "max-w-5xl" : "max-w-2xl",
              ),
        )}
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-line bg-canvas/60 px-4 py-2.5">
          <div className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{title}</div>
          {action}
          <IconButton label="关闭" onClick={onClose}>
            <X size={15} weight="bold" />
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}

export function Notice({ tone = "muted", children, className }: { tone?: "muted" | "error" | "warn"; children: ReactNode; className?: string }) {
  const tones = {
    muted: "border-line bg-surface-mute/50 text-muted",
    error: "border-acc-red-fg/30 bg-acc-red-bg/50 text-acc-red-fg",
    warn: "border-acc-yellow-fg/30 bg-acc-yellow-bg/60 text-acc-yellow-fg",
  };
  return (
    <div className={cn("rounded-md border px-3 py-2 text-[12.5px] leading-relaxed", tones[tone], className)}>
      {children}
    </div>
  );
}