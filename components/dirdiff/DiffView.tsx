"use client";

import { useMemo } from "react";
import { diffWordsWithSpace, structuredPatch } from "diff";
import hljs from "highlight.js/lib/core";
import { cn } from "@/components/ui";
import { escapeHtml } from "@/lib/dirdiff/lang";

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
const HL_LIMIT = 250_000;

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

/** Whole-file highlight → one escaped-HTML string per line, or null when skipped. */
function highlightLines(text: string, language: string): string[] | null {
  if (text.length > HL_LIMIT || !hljs.getLanguage(language)) return null;
  try {
    return hljs.highlight(text, { language }).value.split("\n");
  } catch {
    return null;
  }
}

/** Highlight a single fragment (word-diff part) with the given language. */
function highlightFragment(text: string, language: string): string {
  try {
    return hljs.highlight(text, { language }).value;
  } catch {
    return escapeHtml(text);
  }
}

/** One inline part → wrapped escape/ highlight HTML, diff marks on added/removed. */
function partHtml(part: InlinePart, language: string): string {
  const core = language === "plaintext" ? escapeHtml(part.text) : highlightFragment(part.text, language);
  if (part.added) return `<span class="dirdiff-ins rounded-[2px]">${core}</span>`;
  if (part.removed) return `<span class="dirdiff-del rounded-[2px]">${core}</span>`;
  return core;
}

/** Change row: word-level marks when present, otherwise whole-line highlight. */
function changeHtml(parts: InlinePart[] | undefined, whole: string | undefined, language: string): string {
  if (parts && parts.some((p) => p.added || p.removed)) {
    return parts.map((p) => partHtml(p, language)).join("");
  }
  return whole ?? escapeHtml(parts?.map((p) => p.text).join("") ?? "");
}

function Cell({
  no,
  html,
  text,
  parts,
  empty,
  noNewline,
}: {
  no?: number;
  html?: string;
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
        {html ? (
          <span dangerouslySetInnerHTML={{ __html: html }} />
        ) : parts ? (
          parts.map((p, i) => (
            <span
              key={i}
              className={cn(p.added && "dirdiff-ins", p.removed && "dirdiff-del", (p.added || p.removed) && "rounded-[2px]")}
            >
              {p.text}
            </span>
          ))
        ) : (
          text
        )}
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
  language,
}: {
  leftName: string;
  rightName: string;
  leftText: string;
  rightText: string;
  language: string;
}) {
  const rows = useMemo(() => buildRows(leftText, rightText), [leftText, rightText]);
  const changeCount = rows.filter((r) => r.type !== "equal").length;

  const lines = useMemo(
    () => ({
      left: highlightLines(leftText, language),
      right: highlightLines(rightText, language),
    }),
    [leftText, rightText, language],
  );

  let leftIdx = 0;
  let rightIdx = 0;

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
            let leftHtml: string | undefined;
            let rightHtml: string | undefined;
            if (lines.left && row.leftText !== undefined) {
              leftHtml =
                row.type === "change"
                  ? changeHtml(row.leftParts, lines.left[leftIdx], language)
                  : lines.left[leftIdx];
              leftIdx++;
            }
            if (lines.right && row.rightText !== undefined) {
              rightHtml =
                row.type === "change"
                  ? changeHtml(row.rightParts, lines.right[rightIdx], language)
                  : lines.right[rightIdx];
              rightIdx++;
            }

            const leftBg =
              row.type === "left-only" ? "dirdiff-del" : row.type === "change" ? "bg-acc-red-bg/55" : "bg-surface";
            const rightBg =
              row.type === "right-only" ? "dirdiff-ins" : row.type === "change" ? "bg-acc-green-bg/55" : "bg-surface";
            return (
              <div key={i} className="contents">
                <div className={cn(leftBg)}>
                  <Cell
                    no={row.leftNo}
                    html={leftHtml}
                    text={row.leftText}
                    parts={row.leftParts}
                    empty={!row.leftText && row.type === "right-only"}
                    noNewline={row.noNewlineLeft}
                  />
                </div>
                <div className={cn(rightBg)}>
                  <Cell
                    no={row.rightNo}
                    html={rightHtml}
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