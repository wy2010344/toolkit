import type { ReactNode } from "react";

/**
 * 够用就好的 Markdown 渲染：段落 / 标题 / 列表 / 引用 / 代码块 / 行内粗体与代码。
 * 不引第三方库，回答内容完全是内置的静态演示文本，避免 XSS 面。
 */

function renderInline(text: string, key: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    .filter(Boolean)
    .map((part, i) => {
      const k = `${key}-${i}`;
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={k} className="font-semibold text-ink">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={k} className="rounded bg-surface-mute px-1 py-0.5 font-mono text-[11.5px] text-ink">
            {part.slice(1, -1)}
          </code>
        );
      }
      return <span key={k}>{part}</span>;
    });
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
  const push = (node: ReactNode) => blocks.push(<div key={`b${key++}`}>{node}</div>);

  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i]!.trim().startsWith("```")) {
        body.push(lines[i]!);
        i += 1;
      }
      i += 1;
      push(
        <div className="ct-tile my-3 overflow-hidden rounded-lg">
          {lang && <div className="px-3 pb-0.5 pt-1 font-mono text-[10px] uppercase tracking-wider text-faint">{lang}</div>}
          <pre className="overflow-x-auto px-3 py-2.5 font-mono text-[11.5px] leading-[1.7] text-ink-soft">
            <code>{body.join("\n")}</code>
          </pre>
        </div>,
      );
      continue;
    }

    if (/^#{1,4}\s/.test(trimmed)) {
      const level = trimmed.match(/^#+/)![0].length;
      const content = trimmed.replace(/^#{1,4}\s/, "");
      push(
        <div className={level <= 2 ? "mb-2 mt-4 text-[14px] font-semibold text-ink first:mt-0" : "mb-1.5 mt-3 text-[13px] font-semibold text-ink"}>
          {renderInline(content, `h${key}`)}
        </div>,
      );
      i += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const body: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith(">")) {
        body.push(lines[i]!.trim().replace(/^>\s?/, ""));
        i += 1;
      }
      push(
        <blockquote className="my-3 rounded-r-lg bg-acc-blue-bg/55 px-3 py-2 text-[12.5px] text-muted shadow-[inset_3px_0_0_rgba(31,108,159,0.55)]">
          {body.map((b, n) => (
            <p key={n}>{renderInline(b, `q${key}-${n}`)}</p>
          ))}
        </blockquote>,
      );
      continue;
    }

    const bullet = /^[-*]\s+/.test(trimmed);
    const numbered = /^\d+\.\s+/.test(trimmed);
    if (bullet || numbered) {
      const items: string[] = [];
      while (i < lines.length) {
        const t = lines[i]!.trim();
        if (bullet && /^[-*]\s+/.test(t)) items.push(t.replace(/^[-*]\s+/, ""));
        else if (numbered && /^\d+\.\s+/.test(t)) items.push(t.replace(/^\d+\.\s+/, ""));
        else break;
        i += 1;
      }
      const List = numbered ? "ol" : "ul";
      push(
        <List className={`my-2 space-y-1 pl-5 text-[12.5px] text-ink-soft ${numbered ? "list-decimal" : "list-disc"}`}>
          {items.map((item, n) => (
            <li key={n} className="pl-0.5 marker:text-faint">
              {renderInline(item, `li${key}-${n}`)}
            </li>
          ))}
        </List>,
      );
      continue;
    }

    if (trimmed === "---") {
      push(<div className="ct-fade-rule my-4" />);
      i += 1;
      continue;
    }

    if (!trimmed) {
      i += 1;
      continue;
    }

    const para: string[] = [];
    while (i < lines.length) {
      const t = lines[i]!.trim();
      if (!t || t.startsWith("```") || t.startsWith(">") || /^#{1,4}\s/.test(t) || /^[-*]\s+/.test(t) || /^\d+\.\s+/.test(t) || t === "---") break;
      para.push(t);
      i += 1;
    }
    push(<p className="my-2 text-[12.5px] leading-[1.8] text-ink-soft">{renderInline(para.join(" "), `p${key}`)}</p>);
  }

  return <div className="min-w-0">{blocks}</div>;
}
