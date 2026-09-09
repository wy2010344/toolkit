"use client";

import { useMemo } from "react";
import { diffWordsWithSpace, structuredPatch } from "diff";
import { cn } from "@/components/ui";

interface InlinePart {
  text: string;
  added?: boolean;
  removed?: boolean;
}

interface DiffRow {
  type: "equal" | "left-only" | "right-only" | "change";
  leftNo?: number;
  rightNo?: number;
  leftText?: string;
  rightText?: string;
  leftParts?: InlinePart[];
  rightParts?: InlinePart[];
  noNewlineLeft?: boolean;
  noNewlineRight?: boolean;
}

const INLINE_LIMIT = 4000;

function inlineParts(oldText: string, newText: string): [InlinePart[], InlinePart[]] {
  if (oldText.length + newText.length > INLINE_LIMIT) {
    return [[{ text: oldText }], [{ text: newText }]];
  }
  const changes = diffWordsWithSpace(oldText, newText);
  const left: InlinePart[] = [];
  const right: InlinePart[] = [];
  for (const ch of changes) {
    if (ch.added) right.push({ text: ch.value, added: true });
    else if (ch.removed) left.push({ text: ch.value, removed: true });
    else {
      left.push({ text: ch.value });
      right.push({ text: ch.value });
    }
  }
  return [left, right];
}

function buildRows(oldText: string, newText: string): DiffRow[] {
  const { hunks } = structuredPatch("", "", oldText, newText, undefined, undefined, { context: 4 });
  const rows: DiffRow[] = [];

  for (const hunk of hunks) {
    let oldNo = hunk.oldStart;
    let newNo = hunk.newStart;
    const pending: Array<{ text: string; no: number }> = [];

    const flushLeft = () => {
      for (const p of pending.splice(0)) {
        rows.push({ type: "left-only", leftNo: p.no, leftText: p.text });
      }
    };

    for (const line of hunk.lines) {
      const code = line[0];
      if (code === "\\") {
        const last = rows[rows.length - 1];
        if (last) {
          if (last.type === "left-only") last.noNewlineLeft = true;
          else if (last.type === "right-only") last.noNewlineRight = true;
          else {
            last.noNewlineLeft = true;
            last.noNewlineRight = true;
          }
        }
        continue;
      }
      if (code === "-") {
        pending.push({ text: line.slice(1), no: oldNo++ });
      } else if (code === "+") {
        const rightNo = newNo++;
        const rightText = line.slice(1);
        if (pending.length) {
          const left = pending.shift()!;
          const [leftParts, rightParts] = inlineParts(left.text, rightText);
          rows.push({
            type: "change",
            leftNo: left.no,
            rightNo,
            leftText: left.text,
            rightText,
            leftParts,
            rightParts,
          });
        } else {
          rows.push({ type: "right-only", rightText, rightNo });
        }
      } else {
        flushLeft();
        const text = line.slice(1);
        rows.push({ type: "equal", leftNo: oldNo++, rightNo: newNo++, leftText: text, rightText: text });
      }
    }
    flushLeft();
  }
  return rows;
}

function Cell({
  no,
  text,
  parts,
  empty,
  noNewline,
}: {
  no?: number;
  text?: string;
  parts?: InlinePart[];
  empty?: boolean;
  noNewline?: boolean;
}) {
  if (empty) return <div className="border-b border-line/50" aria-hidden />;
  return (
    <div className="flex min-w-0 border-b border-line/50">
      <span className="w-11 shrink-0 select-none pr-2 text-right text-[11px] leading-[1.7] text-faint">
        {no ?? ""}
      </span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words pl-2 leading-[1.7]">
        {parts
          ? parts.map((p, i) => (
              <span
                key={i}
                className={cn(p.added && "dirdiff-ins", p.removed && "dirdiff-del", (p.added || p.removed) && "rounded-[2px]")}
              >
                {p.text}
              </span>
            ))
          : text}
        {noNewline && <span className="ml-1 text-[10px] text-faint">⏎? 无末尾换行</span>}
      </span>
    </div>
  );
}

export function DiffView({
  leftName,
  rightName,
  leftText,
  rightText,
}: {
  leftName: string;
  rightName: string;
  leftText: string;
  rightText: string;
}) {
  const rows = useMemo(() => buildRows(leftText, rightText), [leftText, rightText]);
  const changeCount = rows.filter((r) => r.type !== "equal").length;

  return (
    <div className="flex h-full flex-col">
      <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-px border-b border-line bg-line">
        {[leftName, rightName].map((n, i) => (
          <div key={i} className="flex items-center gap-2 bg-canvas/70 px-3 py-2">
            <span className={cn("inline-block h-2 w-2 rounded-full", i === 0 ? "bg-acc-red-fg" : "bg-acc-green-fg")} />
            <span className="truncate font-mono text-[11px] text-muted" title={n}>
              {n}
            </span>
          </div>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-1.5">
        <span className="font-mono text-[11px] text-faint">
          {changeCount.toLocaleString("zh-CN")} 处差异 · 共 {rows.length.toLocaleString("zh-CN")} 行
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="grid min-w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-px bg-line">
          {rows.map((row, i) => {
            const leftTone = row.type === "change" || row.type === "left-only";
            const rightTone = row.type === "change" || row.type === "right-only";
            return (
              <div key={i} className="contents">
                <div className={cn("bg-surface", leftTone && "bg-acc-red-bg/55")}>
                  <Cell
                    no={row.leftNo}
                    text={row.leftText}
                    parts={row.leftParts}
                    empty={!row.leftText && row.type === "right-only"}
                    noNewline={row.noNewlineLeft}
                  />
                </div>
                <div className={cn("bg-surface", rightTone && "bg-acc-green-bg/55")}>
                  <Cell
                    no={row.rightNo}
                    text={row.rightText}
                    parts={row.rightParts}
                    empty={!row.rightText && row.type === "left-only"}
                    noNewline={row.noNewlineRight}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}