/**
 * 架构总览 · 每个节点的实时小实验。
 * 所有演示都吃同一条真实前向传播(以及它的"反向对照组"),
 * 改任何旋钮,数字立刻重算——没有假数据。
 */
"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { Recycle } from "@phosphor-icons/react/dist/ssr";
import type { LLMConfig } from "@/lib/llm/config";
import type { MicroGPTWeights } from "@/lib/llm/model";
import type { precomputeRope } from "@/lib/llm/embeddings";
import { forwardWith, lastEntropy, lastTopK, sampleNext, type ArchTweak } from "@/lib/llm/architecture";
import type { TextSession } from "@/lib/llm/data";
import { cn } from "@/components/ui";
import { AttentionHeatmap } from "./AttentionHeatmap";

type Rope = ReturnType<typeof precomputeRope>;
type Fwd = ReturnType<typeof forwardWith>;

/* ------------------------------------------------------------------ */
/* 通用小板件                                                          */
/* ------------------------------------------------------------------ */

function Se({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
      className={cn(
        "h-7 rounded-md border border-line bg-canvas px-1.5 font-mono text-[11.5px] text-ink outline-none focus:border-line-strong",
        className,
      )}
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-7 rounded-md border px-2 font-mono text-[11px] transition-colors",
        active
          ? "border-ink bg-ink text-white"
          : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}

function DemoHint({ children }: { children: string }) {
  return <p className="mt-2.5 text-[11.5px] leading-relaxed text-faint">{children}</p>;
}

/* ------------------------------------------------------------------ */
/* ① 分词:两种分词器把同一句话切成什么                                  */
/* ------------------------------------------------------------------ */

export function TokenizerDemo({
  sessions,
  text,
  active,
  onPick,
}: {
  sessions: { char: TextSession; bpe: TextSession };
  text: string;
  active: "char" | "bpe";
  onPick: (v: "char" | "bpe") => void;
}) {
  const rows = useMemo(() => {
    const enc = (s: TextSession) => s.encode(text).map((id) => ({ tok: s.decode([id]), id }));
    return [
      { key: "char", name: "字符级 char", list: enc(sessions.char) },
      { key: "bpe", name: "BPE 子词", list: enc(sessions.bpe) },
    ] as const;
  }, [sessions, text]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {rows.map((r) => (
          <Chip key={r.key} label={r.name} active={active === r.key} onClick={() => onPick(r.key)} />
        ))}
      </div>
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.key} className={cn("rounded-lg border px-2.5 py-2", r.key === active ? "border-line-strong bg-surface" : "border-line bg-surface/40 opacity-70")}>
            <div className="mb-1.5 text-[10.5px] font-medium uppercase tracking-wider text-faint">
              {r.name} · {r.list.length} 个 token
            </div>
            <div className="flex flex-wrap gap-1">
              {r.list.map((t, i) => (
                <span key={i} title={`id=${t.id}`} className="rounded-md bg-acc-yellow-bg px-1.5 py-0.5 font-mono text-[11.5px] text-ink">
                  {t.tok}
                  <span className="ml-1 text-[9px] text-faint">#{t.id}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <DemoHint>
        同一句话,字符分词切成单个汉字;BPE 会把高频相邻字对合并成子词,词表更紧凑。模型拿到的其实是右下角那串 id。
      </DemoHint>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ② 嵌入:token id → dModel 维向量(查表)                              */
/* ------------------------------------------------------------------ */

export function EmbedDemo({
  ids,
  tokens,
  cfg,
  w,
}: {
  ids: number[];
  tokens: string[];
  cfg: LLMConfig;
  w: MicroGPTWeights;
}) {
  const maxAbs = useMemo(() => {
    let m = 1e-6;
    for (const id of ids) {
      const row = w.emb.subarray(id * cfg.dModel, (id + 1) * cfg.dModel);
      for (const v of row) m = Math.max(m, Math.abs(v));
    }
    return m;
  }, [ids, cfg, w]);

  const shown = Math.min(ids.length, 10);
  const dims = Math.min(cfg.dModel, 24);

  return (
    <div className="space-y-2.5">
      <div className="flex justify-between text-[10.5px] text-faint">
        <span>Embedding 表:词表 {cfg.vocabSize} × 维度 {cfg.dModel}</span>
        <span className="font-mono">每格 = 一个维度上的数值</span>
      </div>
      <div className="space-y-1 overflow-x-auto">
        {ids.slice(0, shown).map((id, t) => (
          <div key={t} className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-center font-mono text-[10.5px] text-muted">{tokens[t]}</span>
            <div className="flex gap-px">
              {Array.from({ length: dims }).map((_, d) => {
                const v = w.emb[id * cfg.dModel + d]! / maxAbs;
                const a = Math.max(0, Math.min(1, Math.abs(v)));
                const bg =
                  v >= 0
                    ? `color-mix(in srgb, var(--color-acc-blue-fg) ${Math.round(a * 100)}%, transparent)`
                    : `color-mix(in srgb, var(--color-acc-yellow-fg) ${Math.round(a * 100)}%, transparent)`;
                return <span key={d} className="h-3.5 w-3.5 rounded-[3px]" style={{ background: bg }} title={`dim ${d}: ${v.toFixed(3)}`} />;
              })}
            </div>
            <span className="shrink-0 font-mono text-[9px] text-faint">#{id}</span>
          </div>
        ))}
      </div>
      <DemoHint>
        每个 token 都从表格里取一行(蓝=正值,黄=负值)。这些连续向量是所有计算的基础,语义相近的词在训练后向量靠近。
      </DemoHint>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ③ RoPE:开着 vs 旁路,同一句话的注意力对比                            */
/* ------------------------------------------------------------------ */

export function RoPEDemo({
  f,
  alt,
  tokens,
  value,
  onToggle,
}: {
  f: Fwd;
  alt: Fwd;
  tokens: string[];
  value: "rope" | "none";
  onToggle: (v: "rope" | "none") => void;
}) {
  const head0 = (r: Fwd) => r.trace!.layers[0]![0]!;
  const wOn = head0(f);
  const wOff = head0(alt);
  const on = value === "rope";
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip label="RoPE 开(标准)" active={on} onClick={() => onToggle("rope")} />
        <Chip label="RoPE 旁路" active={!on} onClick={() => onToggle("none")} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <AttentionHeatmap weights={wOn} tokens={tokens} label="RoPE 开:打分层后,远近位置在打分中区分开" />
        <AttentionHeatmap weights={wOff} tokens={tokens} label="RoPE 关:位置信息消失,只剩内容相似度" />
      </div>
      <DemoHint>
        左右两图来自同一模型、同一句话,唯一的差别是 Q/K 有没有被旋转。关了 RoPE,「苹果」在两个位置就无法被区分——语序全乱了。
      </DemoHint>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ④ 多头注意力:挑一层、一个头看"谁在看谁"                             */
/* ------------------------------------------------------------------ */

export function AttentionDemo({
  f,
  tokens,
  cfg,
  causal,
  onCausal,
}: {
  f: Fwd;
  tokens: string[];
  cfg: LLMConfig;
  causal: boolean;
  onCausal: (v: boolean) => void;
}) {
  const [layer, setLayer] = useState(0);
  const [head, setHead] = useState(0);
  const w = f.trace!.layers[Math.min(layer, f.trace!.layers.length - 1)]![Math.min(head, cfg.nHeads - 1)]!;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Se value={String(Math.min(layer, f.trace!.layers.length - 1))} onChange={(v) => setLayer(+v)} options={Array.from({ length: cfg.nLayers }, (_, i) => [String(i), `第 ${i + 1} 层`])} />
        <Se value={String(Math.min(head, cfg.nHeads - 1))} onChange={(v) => setHead(+v)} options={Array.from({ length: cfg.nHeads }, (_, i) => [String(i), `头 ${i + 1}`])} />
        <Chip label={causal ? "因果掩码:不能偷看未来" : "掩码旁路:可以看到未来"} active={causal} onClick={() => onCausal(!causal)} />
      </div>
      <AttentionHeatmap weights={w} tokens={tokens} label="attention[i][j] = 第 i 个位置看了多少第 j 个位置" />
      <DemoHint>
        把掩码旁路打开,右上三角(未来位置)的权重从 0 变成真值——模型就「作弊」了。训练/生成时必须关回来。
      </DemoHint>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ⑤ 残差 + 归一化:量级在层间怎么走                                    */
/* ------------------------------------------------------------------ */

export function NormDemo({
  mags,
  nLayers,
  norm,
  residual,
  onNorm,
  onResidual,
}: {
  mags: number[];
  nLayers: number;
  norm: string;
  residual: boolean;
  onNorm: (v: string) => void;
  onResidual: (v: boolean) => void;
}) {
  const maxV = Math.max(...mags, 1e-6);
  const labels = ["嵌入输出", ...Array.from({ length: nLayers }, (_, i) => `第 ${i + 1} 块输出`)];
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Se value={norm} onChange={onNorm} options={[["rmsnorm", "RMSNorm"], ["layernorm", "LayerNorm"], ["none", "旁路(不归一化)"]]} />
        <Chip label={residual ? "残差连接:开" : "残差连接:关"} active={residual} onClick={() => onResidual(!residual)} />
      </div>
      <div className="space-y-1.5">
        {mags.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-28 shrink-0 text-[11px] text-muted">{labels[i]}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
              <div
                className={cn("h-full", norm === "none" ? "bg-acc-red-fg/80" : "bg-acc-green-fg/80")}
                style={{ width: `${Math.min(100, (v / maxV) * 100)}%` }}
              />
            </div>
            <span className="w-12 shrink-0 text-right font-mono text-[10px] text-faint">{v.toFixed(2)}</span>
          </div>
        ))}
      </div>
      <DemoHint>
        整条序列的 L2 量级随层数变化。把归一化旁路掉(红色条),量级会随层数滚雪球——层一深就数值爆炸;残差再关掉,信号更没法稳定往下传。
      </DemoHint>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ⑥ 前馈激活:三种激活的曲线对比                                       */
/* ------------------------------------------------------------------ */

function actCurve(kind: string, x: number): number {
  if (kind === "swiglu") return x / (1 + Math.exp(-x));
  if (kind === "gelu") return 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x * x * x)));
  return x > 0 ? x : 0;
}

const ACT_LINE: Record<string, string> = {
  swiglu: "stroke-acc-yellow-fg",
  gelu: "stroke-acc-blue-fg",
  relu: "stroke-acc-green-fg",
};

const ACT_TXT: Record<string, string> = {
  swiglu: "SwiGLU(门控·轨道平滑)",
  gelu: "GELU",
  relu: "ReLU",
};

function FFNCurve({ kind }: { kind: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const path = useMemo(() => {
    const pts: string[] = [];
    for (let x = -4; x <= 4.001; x += 0.1) {
      const px = 20 + ((x + 4) / 8) * 360;
      const y = actCurve(kind, x);
      const py = 70 - ((y + 1.2) / 5.8) * 62;
      pts.push(`${pts.length ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`);
    }
    return pts.join(" ");
  }, [kind]);
  return (
    <svg viewBox="0 0 400 84" className="h-24 w-full" onPointerMove={(e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const x = ((px / rect.width) * 400 - 20) / 45 * 4;
      setHover(Math.round(x * 20) / 20);
    }} onPointerLeave={() => setHover(null)}>
      {[-2, 0, 2, 4].map((gy) => {
        const py = 70 - ((gy + 1.2) / 5.8) * 62;
        return <g key={gy}>
          <line x1="20" y1={py} x2="380" y2={py} className="stroke-line" strokeWidth="1" />
          <text x="384" y={py + 3} fontSize="9" className="fill-faint font-mono">{gy}</text>
        </g>;
      })}
      <path d={path} fill="none" className={cn(ACT_LINE[kind], "transition-colors")} strokeWidth="2.2" strokeLinecap="round" />
      {hover !== null && <circle cx={20 + ((hover + 4) / 8) * 360} cy={70 - ((actCurve(kind, hover) + 1.2) / 5.8) * 62} r="3" className="fill-canvas stroke-ink" strokeWidth="1.5" />}
    </svg>
  );
}

export function FFNDemo({
  value,
  onPick,
}: {
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(ACT_TXT) as string[]).map((k) => (
          <Chip key={k} label={ACT_TXT[k]} active={value === k} onClick={() => onPick(k)} />
        ))}
      </div>
      <div className="rounded-lg border border-line bg-surface px-2 pt-2">
        <FFNCurve kind={value} />
      </div>
      <DemoHint>
        三种激活给 FFN 提供「非线性」,但手感不同:ReLU 硬截断,GELU/Swish 平滑过渡,而 SwiGLU 额外用一路门控决定放行多少。SwiGLU 是当代主流。
      </DemoHint>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ⑦ 输出头 + Softmax:下一个词的概率分布                               */
/* ------------------------------------------------------------------ */

export function HeadDemo({ f, tokens, session }: { f: Fwd; tokens: string[]; session: TextSession }) {
  const top = useMemo(() => lastTopK(f.logits, 6), [f]);
  const entropy = useMemo(() => lastEntropy(f.logits), [f]);
  const maxP = top[0]?.p ?? 1;
  const prev = tokens.slice(-4).join("");

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
        <span className="rounded bg-surface-mute px-1.5 py-0.5 font-mono">…{prev} ▍</span>
        <span>之后该接哪个?</span>
        <span className="ml-auto rounded bg-surface-mute px-1.5 py-0.5 font-mono">熵 {entropy.toFixed(2)}</span>
      </div>
      <div className="space-y-1">
        {top.map((t, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-14 shrink-0 truncate rounded bg-surface-mute px-1.5 py-0.5 text-center font-mono text-[11px] text-ink">
              {session.decode([t.id]) || "(unk)"}
            </span>
            <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-line">
              <div className="h-full bg-acc-blue-fg/80" style={{ width: `${Math.max(1, (t.p / maxP) * 100)}%` }} />
            </div>
            <span className="w-12 shrink-0 text-right font-mono text-[10px] text-faint">{(t.p * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
      <DemoHint>
        这是模型对「下一个词是谁」的全部认知:softmax 把分数变成非负且和为 1 的概率。注意,现阶段权重还没训练,所以它几乎一无所知——这正是第 7 课训练的意义。
      </DemoHint>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ⑧ 采样:三种策略同一模型生成出来的句子                                */
/* ------------------------------------------------------------------ */

export function SamplerDemo({
  cfg,
  weights,
  rope,
  tw,
  session,
  text,
  onReroll,
}: {
  cfg: LLMConfig;
  weights: MicroGPTWeights;
  rope: Rope;
  tw: ArchTweak;
  session: TextSession;
  text: string;
  onReroll: () => void;
}) {
  const [steps] = useState<Array<{ token: string; prob: number }>>(() => {
    const seed = session.encode(text).slice(0, cfg.maxSeqLen - 1);
    if (seed.length === 0) return [];
    let seq = seed;
    const out: Array<{ token: string; prob: number }> = [];
    for (let i = 0; i < 18 && seq.length < cfg.maxSeqLen; i++) {
      const { logits } = forwardWith(seq, cfg, weights, rope, tw, false);
      const r = sampleNext(logits, tw, session);
      out.push({ token: r.token, prob: r.prob });
      if (seq.length + 1 >= cfg.maxSeqLen) break;
      seq = [...seq, r.id];
    }
    return out;
  });

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted">
          用当前采样策略连续生成 {steps.filter((s) => s.token).length} 步
        </span>
        <button
          type="button"
          onClick={onReroll}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-surface px-2 font-mono text-[11px] text-muted transition-colors hover:border-line-strong hover:text-ink"
        >
          <Recycle size={12} weight="bold" />
          重跑
        </button>
      </div>
      <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-2">
        {steps.length === 0 && <span className="px-1 py-2 text-[11px] text-faint">输入太短,先写长一点再生成</span>}
        {steps.map((s, i) => (
          <span
            key={i}
            title={`概率 ${(s.prob * 100).toFixed(1)}%`}
            className={cn(
              "rounded px-1.5 py-0.5 font-mono text-[12px]",
              s.prob > 0.9 ? "bg-acc-green-bg text-ink" : s.prob > 0.6 ? "bg-acc-green-bg/70 text-ink-soft" : "bg-surface-mute text-muted",
            )}
          >
            {s.token === "" ? "·" : s.token}
          </span>
        ))}
      </div>
      <DemoHint>
        同样一个模型,贪心最稳但容易复读,温度越高越「放飞」,Top-k 在稳妥和随机之间取平衡。左上方工具栏随时切换,重跑对比风格。
      </DemoHint>
    </div>
  );
}