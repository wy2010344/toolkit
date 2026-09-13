/**
 * Transformer 架构图:PURE SVG,按真实前向流程从左到右串联。
 * 用于课程第 6/7 课,一图看全"token → 嵌入 → N×Transformer块 → 概率"。
 */
"use client";

import type { LLMConfig } from "@/lib/llm/config";

export function TransformerDiagram({ cfg, layers }: { cfg: LLMConfig; layers?: number }) {
  const L = layers ?? cfg.nLayers;
  const boxH = 46;
  const mid = 105; // 主干线 y
  const stepW = 128;
  const gapX = 22;

  const embW = 110;
  const embLeft = 10;
  const block0Left = 60 + stepW;
  const blockW = stepW;
  const totalW = block0Left + (blockW + gapX) * L + gapX + 96 + gapX + 110 + 130;

  const lastBlockRight = block0Left + (blockW + gapX) * L;
  const normLeft = lastBlockRight + gapX;
  const headLeft = normLeft + 96 + gapX;

  const arrow = (x1: number, x2: number) => (
    <line x1={x1} y1={mid} x2={x2} y2={mid} stroke="var(--color-faint)" strokeWidth={1.6} markerEnd="url(#arr)" />
  );

  const box = (left: number, w: number, kind: string, label: string, sub?: string, yOff = 0) => {
    const y = mid - boxH / 2 + yOff;
    return (
      <g>
        <rect
          x={left}
          y={y}
          width={w}
          height={boxH}
          rx={10}
          className={
            kind === "io" || kind === "head"
              ? "fill-acc-blue-bg/70 stroke-acc-blue-fg/40"
              : kind === "attn"
                ? "fill-acc-yellow-bg/80 stroke-acc-yellow-fg/30"
                : kind === "ffn"
                  ? "fill-acc-green-bg/80 stroke-acc-green-fg/30"
                  : "fill-surface-mute stroke-line-strong"
          }
          strokeWidth={1.4}
        />
        <text x={left + w / 2} y={y + boxH / 2 - (sub ? 7 : 0)} textAnchor="middle" className="fill-ink text-[11px] font-medium">
          {label}
        </text>
        {sub && (
          <text x={left + w / 2} y={y + boxH / 2 + 12} textAnchor="middle" className="fill-muted text-[9px]">
            {sub}
          </text>
        )}
      </g>
    );
  };

  return (
    <svg viewBox={`0 0 ${totalW} 210`} className="w-full" role="img" aria-label="Transformer 架构">
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={7} markerHeight={7} orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--color-faint)" />
        </marker>
      </defs>

      {/* 输入 token 区块 */}
      <text x={embLeft} y={30} className="fill-ink text-[10px] font-medium">
        输入:token id 序列
      </text>
      <g className="font-mono text-[9px]">
        {["[12]", "[3]", "[77]", "[1]"].map((t, i) => (
          <rect key={i} x={embLeft + i * 28} y={38} width={24} height={18} rx={4} className="fill-surface-mute stroke-line-strong" strokeWidth={1} />
        ))}
        {["[9]", "[5]", "[24]", "[2]"].map((t, i) => (
          <rect key={i} x={embLeft + 4 + i * 28} y={62} width={24} height={18} rx={4} className="fill-surface-mute stroke-line-strong" strokeWidth={1} />
        ))}
      </g>
      <text x={embLeft + 106} y={50} className="fill-muted text-[9px]">
        …
      </text>

      {/* 嵌入 → 块 */}
      {box(embLeft, embW, "io", "Token 嵌入")}
      {arrow(embLeft + embW, block0Left)}
      <text x={(embLeft + embW + block0Left) / 2} y={mid - 22} className="fill-muted text-[9px]">
        查表 → dModel 维向量
      </text>

      {/* N 层 Transformer 块 */}
      {Array.from({ length: L }, (_, l) => {
        const left = block0Left + (blockW + gapX) * l;
        const yOff = l % 2 === 0 ? -16 : 16;
        return (
          <g key={l}>
            {box(left, blockW, l % 2 === 0 ? "attn" : "ffn", `块 ${l + 1}`, l % 2 === 0 ? "注意力交流" : "前馈思考", yOff)}
          </g>
        );
      })}
      {arrow(block0Left, block0Left + blockW * L + gapX * (L - 1) + gapX)}
      <text x={(block0Left + block0Left + (blockW + gapX) * L) / 2} y={30} className="fill-muted text-[9px]">
        {L} 层:残差 + 预归一 (RMSNorm) + 多头注意力 (RoPE) + SwiGLU
      </text>

      {/* 尾部 */}
      {box(normLeft, 96, "norm", "最终归一化")}
      {arrow(lastBlockRight, normLeft)}
      {box(headLeft, 110, "head", "输出头 (词表)")}
      {arrow(normLeft + 96, headLeft)}

      {/* 输出概率 */}
      <text x={headLeft + 110 + 8} y={mid - 18} className="fill-ink text-[10px] font-medium">
        下一个
      </text>
      <text x={headLeft + 110 + 8} y={mid - 6} className="fill-ink text-[10px] font-medium">
        token 概率
      </text>
      <rect x={headLeft + 110 + 8} y={mid + 2} width={74} height={8} rx={4} className="fill-surface-mute" />
      <rect x={headLeft + 110 + 8} y={mid + 2} width={50} height={8} rx={4} className="fill-acc-green-fg/60" />
      <text x={headLeft + 110 + 8} y={mid + 30} className="font-mono text-[8px] text-faint">
        softmax
      </text>
    </svg>
  );
}