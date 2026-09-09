"use client";

import { useState, type ReactNode } from "react";
import { ArrowRight, CheckCircle, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { Button, Modal, Notice, Toggle, cn } from "@/components/ui";
import { basename, formatBytes } from "@/lib/dirdiff/format";
import { executeSync, previewSync } from "@/lib/dirdiff/client";
import type { CompareEntry, SyncDirection, SyncEntryInput, SyncPlan, SyncResult } from "@/lib/dirdiff/types";

const LIST_CAP = 24;

export function SyncPanel({
  open,
  onClose,
  left,
  right,
  entries,
  onApplied,
}: {
  open: boolean;
  onClose: () => void;
  left: string;
  right: string;
  entries: CompareEntry[];
  onApplied: () => void;
}) {
  const [direction, setDirection] = useState<SyncDirection>("left-to-right");
  const [deleteExtra, setDeleteExtra] = useState(false);
  const [plan, setPlan] = useState<SyncPlan | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPlan(null);
    setResult(null);
    setError(null);
    setBusy(false);
  };

  const syncInputs: SyncEntryInput[] = entries
    .filter((e) => e.status !== "equal")
    .map((e) => ({
      rel: e.rel,
      type: e.type,
      status: e.status,
      size: direction === "left-to-right" ? e.left?.size : e.right?.size,
    }));

  const preview = async () => {
    setBusy(true);
    setError(null);
    try {
      setPlan(await previewSync({ left, right, direction, deleteExtra, entries: syncInputs }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!plan) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await executeSync({ left, right, direction, deleteExtra, entries: syncInputs }));
      onApplied();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const srcName = direction === "left-to-right" ? basename(left) : basename(right);
  const dstName = direction === "left-to-right" ? basename(right) : basename(left);

  return (
    <Modal open={open} onClose={onClose} title="同步目录" wide>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-line-strong">
            {(
              [
                ["left-to-right", `${basename(left)} → ${basename(right)}`],
                ["right-to-left", `${basename(right)} → ${basename(left)}`],
              ] as const
            ).map(([dir, label]) => (
              <button
                key={dir}
                onClick={() => {
                  setDirection(dir);
                  setPlan(null);
                }}
                className={cn(
                  "h-8 px-3 font-mono text-[12px] transition-colors",
                  direction === dir ? "bg-ink text-white" : "bg-surface text-muted hover:bg-surface-mute",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-faint">
            以 <b className="text-ink">{srcName}</b> 为源,覆盖 <b className="text-ink">{dstName}</b>
          </span>
        </div>

        <Toggle
          label="删除目标侧独有文件 / 目录"
          hint="即镜像同步:让目标侧与源侧完全一致(危险操作)。"
          checked={deleteExtra}
          onChange={(v) => {
            setDeleteExtra(v);
            setPlan(null);
          }}
        />

        <div className="flex flex-wrap gap-2">
          <Button variant="subtle" loading={busy && !result} onClick={preview}>
            预览计划
          </Button>
          <Button variant="danger" loading={busy && !!result} disabled={!plan || !!result} onClick={apply}>
            执行同步
          </Button>
          {result && (
            <Button variant="ghost" onClick={reset}>
              再次调整
            </Button>
          )}
        </div>

        {error && <Notice tone="error">{error}</Notice>}

        {!plan && !result && (
          <Notice tone="muted">
            点击「预览计划」先看要复制 / 删除哪些内容,确认无误后再执行(冲突条目会被跳过)。
          </Notice>
        )}

        {plan && !result && (
          <PlanSummary plan={plan} dstName={dstName} />
        )}

        {result && (
          <ResultSummary result={result} srcName={srcName} />
        )}
      </div>
    </Modal>
  );
}

function PlanSummary({ plan, dstName }: { plan: SyncPlan; dstName: string }) {
  return (
    <div className="space-y-2 border-t border-line pt-3">
      <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
        <PlanBadge tone="red">{plan.copies.length.toLocaleString("zh-CN")} 项将覆盖为源侧 · {formatBytes(plan.copyBytes)}</PlanBadge>
        <PlanBadge tone="yellow">{plan.deletions.length.toLocaleString("zh-CN")} 项将被删除</PlanBadge>
        <PlanBadge tone="muted">{plan.skipped.length.toLocaleString("zh-CN")} 项跳过</PlanBadge>
      </div>
      <ListGroup title={`将复制到 ${dstName}`} items={plan.copies.map((c) => c.rel)} />
      {plan.deletions.length > 0 && <ListGroup title={`将从 ${dstName} 删除`} items={plan.deletions.map((c) => c.rel)} tone="yellow" />}
      {plan.skipped.length > 0 && <ListGroup title="跳过(含冲突)" items={plan.skipped.map((c) => c.rel)} tone="muted" />}
    </div>
  );
}

function ResultSummary({ result, srcName }: { result: SyncResult; srcName: string }) {
  return (
    <div className="space-y-2 border-t border-line pt-3">
      <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
        <PlanBadge tone="green">
          <CheckCircle size={13} weight="fill" /> 完成 {result.applied.length.toLocaleString("zh-CN")} 项
        </PlanBadge>
        {result.failed.length > 0 && (
          <PlanBadge tone="red">
            <WarningCircle size={13} weight="fill" /> 失败 {result.failed.length.toLocaleString("zh-CN")} 项
          </PlanBadge>
        )}
        <span className="text-[11px] text-faint">来自 {srcName}</span>
      </div>
      {result.failed.length > 0 && (
        <div className="rounded-md border border-acc-red-fg/25 bg-acc-red-bg/40 p-2 font-mono text-[11px] text-acc-red-fg">
          {result.failed.slice(0, LIST_CAP).map((f) => (
            <div key={f.rel} className="truncate">
              {f.rel} — {f.reason}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlanBadge({ tone, children }: { tone: "red" | "yellow" | "green" | "muted"; children: ReactNode }) {
  const tones = {
    red: "bg-acc-red-bg text-acc-red-fg",
    yellow: "bg-acc-yellow-bg text-acc-yellow-fg",
    green: "bg-acc-green-bg text-acc-green-fg",
    muted: "bg-surface-mute text-muted",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px]", tones[tone])}>
      {children}
    </span>
  );
}

function ListGroup({ title, items, tone = "muted" }: { title: string; items: string[]; tone?: "red" | "yellow" | "muted" }) {
  const toneCls = {
    red: "text-acc-red-fg",
    yellow: "text-acc-yellow-fg",
    muted: "text-muted",
  }[tone];
  if (items.length === 0) return null;
  return (
    <div>
      <div className={cn("mb-1 flex items-center gap-1 text-[11px] font-medium", toneCls)}>
        <ArrowRight size={12} /> {title} · {items.length.toLocaleString("zh-CN")}
      </div>
      <div className="max-h-32 overflow-y-auto rounded-md border border-line bg-canvas/40 p-2 font-mono text-[11px] leading-relaxed text-muted">
        {items.slice(0, LIST_CAP).map((rel) => (
          <div key={rel} className="truncate">
            {rel}
          </div>
        ))}
        {items.length > LIST_CAP && <div className="text-faint">… 其余 {items.length - LIST_CAP} 项略</div>}
      </div>
    </div>
  );
}