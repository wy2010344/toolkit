/**
 * 架构总览 · 交互式解剖图。
 *
 * 一条真实的"文本→token→…→概率→采样"竖向管道,每个节点都:
 *   - 可点击展开:是什么 / 为什么 / 公式 / 代码位置 / 对应课程;
 *   - 带实时小实验,实验吃的是同一条前向传播(及反向对照),
 *     改一个旋钮,整条管道立即重算。
 *
 * 顶部工具栏就是"可插拔实验台":分词、RoPE、归一化、激活、掩码、
 * 残差、采样全部可以替换/旁路,用来回答「如果不用它,模型会怎样?」。
 */
"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowRight, BookmarkSimple, CaretDown, MapTrifold, SlidersHorizontal } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/components/ui";
import { TRAIN_CONFIG, type LLMConfig } from "@/lib/llm/config";
import { CN_CORPUS } from "@/lib/llm/data";
import { makeBpeSession, makeCharSession } from "@/lib/llm/data";
import { precomputeRope } from "@/lib/llm/embeddings";
import { createWeights } from "@/lib/llm/model";
import { DEFAULT_TWEAK, forwardWith, type ArchTweak } from "@/lib/llm/architecture";
import { ARCH_NODES, TONE_BADGE, type ArchNodeMeta } from "./architectureMeta";
import {
  AttentionDemo,
  EmbedDemo,
  FFNDemo,
  HeadDemo,
  NormDemo,
  RoPEDemo,
  SamplerDemo,
  TokenizerDemo,
} from "./ArchitectureDemos";

function Se({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 rounded-md border border-line bg-canvas px-1.5 font-mono text-[11.5px] text-ink outline-none focus:border-line-strong"
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  );
}

/** 工具栏里的一小格:标签 + 控件。 */
function Knob({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 items-center gap-1.5 text-[10.5px] text-faint">
      <span className="shrink-0">{label}</span>
      {children}
    </label>
  );
}

function SwitchChip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md border px-2 font-mono text-[11px] transition-colors",
        on ? "border-line-strong bg-ink text-white" : "border-line text-faint hover:text-ink",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", on ? "bg-white" : "bg-line-strong")} />
      {label}
    </button>
  );
}

function NodeCard({
  node,
  open,
  onToggle,
  onGoLesson,
  children,
}: {
  node: ArchNodeMeta;
  open: boolean;
  onToggle: () => void;
  onGoLesson: (n: number) => void;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-surface transition-[border-color]",
        open ? "border-line-strong" : "border-line hover:border-faint",
      )}
    >
      <button type="button" onClick={onToggle} className="flex w-full items-start gap-3 px-4 py-3 text-left">
        <span
          className={cn(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-[11.5px] font-bold",
            TONE_BADGE[node.tone],
          )}
        >
          {node.n}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[13.5px] font-semibold tracking-tight text-ink">{node.title}</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-faint">{node.en}</span>
          </span>
          <span className="mt-px block truncate text-[12px] text-muted">{node.role}</span>
        </span>
        <span className="mt-1 shrink-0 text-faint">
          <CaretDown className={cn("h-4 w-4 transition-transform", open ? "rotate-180" : "rotate-0")} weight="bold" />
        </span>
      </button>

      {open && (
        <div className="border-t border-line px-4 py-4">
          <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
            <div className="min-w-0 space-y-3">
              <p className="text-[12.5px] leading-relaxed text-ink-soft">{node.blurb}</p>
              <ul className="space-y-1.5">
                {node.points.map((pt, i) => (
                  <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-muted">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-line-strong" />
                    {pt}
                  </li>
                ))}
              </ul>
              <div className="overflow-x-auto rounded-md border border-line bg-surface-mute/60 px-2.5 py-1.5 font-mono text-[11.5px] text-ink">
                {node.formula}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate rounded bg-canvas px-2 py-1 font-mono text-[10.5px] text-faint">
                  {node.codeRef.file} · {node.codeRef.fn}
                </span>
                <button
                  type="button"
                  onClick={() => onGoLesson(node.lesson)}
                  className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md bg-ink px-2.5 font-mono text-[11px] text-white transition-opacity hover:opacity-85"
                >
                  去第 {node.lesson} 课
                  <ArrowRight size={12} weight="bold" />
                </button>
              </div>
            </div>
            <div className="min-w-0 rounded-xl border border-line bg-canvas/60 p-3">{children}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ArchitectureMap({ onGoLesson }: { onGoLesson: (n: number) => void }) {
  const [tw, setTw] = useState<ArchTweak>(DEFAULT_TWEAK);
  const [layers, setLayers] = useState(2);
  const [heads, setHeads] = useState(4);
  const [text, setText] = useState("我喜欢苹果");
  const [open, setOpen] = useState<string | null>("attention");
  const [rerollNonce, setRerollNonce] = useState(0);

  const upd = (k: keyof ArchTweak, v: string | number | boolean) =>
    setTw((t) => ({ ...t, [k]: v }) as ArchTweak);

  const cfg: LLMConfig = useMemo(
    () => ({ ...TRAIN_CONFIG, nLayers: layers, nHeads: heads }),
    [layers, heads],
  );

  const charSession = useMemo(() => makeCharSession(cfg, CN_CORPUS), [cfg]);
  const bpeSession = useMemo(() => makeBpeSession(cfg, CN_CORPUS, TRAIN_CONFIG.vocabSize), [cfg]);
  const session = tw.tokenizer === "bpe" ? bpeSession : charSession;

  const ids = useMemo(
    () => session.encode(text).slice(0, cfg.maxSeqLen - 1),
    [session, text, cfg.maxSeqLen],
  );
  const tokens = useMemo(() => ids.map((id) => session.decode([id])), [ids, session]);

  const weights = useMemo(() => createWeights(cfg), [cfg]);
  const rope = useMemo(() => precomputeRope(cfg), [cfg]);

  const f = useMemo(() => forwardWith(ids, cfg, weights, rope, tw, true), [ids, cfg, weights, rope, tw]);
  const alt = useMemo(
    () => forwardWith(ids, cfg, weights, rope, { ...tw, position: tw.position === "rope" ? "none" : "rope" }, true),
    [ids, cfg, weights, rope, tw],
  );

  const demo = (node: ArchNodeMeta) => {
    switch (node.id) {
      case "tokenizer":
        return (
          <TokenizerDemo
            sessions={{ char: charSession, bpe: bpeSession }}
            text={text}
            active={tw.tokenizer}
            onPick={(v) => upd("tokenizer", v)}
          />
        );
      case "embedding":
        return <EmbedDemo ids={ids} tokens={tokens} cfg={cfg} w={weights} />;
      case "rope":
        return (
          <RoPEDemo
            f={f}
            alt={alt}
            tokens={tokens}
            value={tw.position}
            onToggle={(v) => upd("position", v)}
          />
        );
      case "attention":
        return (
          <AttentionDemo
            f={f}
            tokens={tokens}
            cfg={cfg}
            causal={tw.causal}
            onCausal={(v) => upd("causal", v)}
          />
        );
      case "block":
        return (
          <NormDemo
            mags={f.mags}
            nLayers={layers}
            norm={tw.norm}
            residual={tw.residual}
            onNorm={(v) => upd("norm", v as ArchTweak["norm"])}
            onResidual={(v) => upd("residual", v)}
          />
        );
      case "ffn":
        return (
          <FFNDemo value={tw.activation} onPick={(v) => upd("activation", v as ArchTweak["activation"])} />
        );
      case "head":
        return <HeadDemo f={f} tokens={tokens} session={session} />;
      case "sampler":
        return (
          <SamplerDemo
            key={`${tw.tokenizer}.${tw.sampler}.${tw.temperature.toFixed(1)}.${tw.topK}.${tw.norm}.${layers}.${heads}.${text}#${rerollNonce}`}
            cfg={cfg}
            weights={weights}
            rope={rope}
            tw={tw}
            session={session}
            text={text}
            onReroll={() => setRerollNonce((n) => n + 1)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-acc-yellow-fg">architecture · 交互式解剖图</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink">造一个会接话的机器</h1>
        </div>
        <button
          type="button"
          onClick={() => onGoLesson(-1)}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-[11.5px] font-medium text-ink transition-colors hover:border-line-strong"
        >
          <BookmarkSimple size={13} weight="fill" className="text-acc-yellow-fg" />
          术语表
        </button>
      </div>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
        一句话需求:让电脑像会聊天的人一样「接话」。可惜它只懂数字,于是每一步都会被逼出难题:得先识字(①②)、
        懂先后(③)、会联系上下文(④⑤)、撑得住叠得深(⑥),最后把「下一个词的概率」变成一句完整的话(⑦⑧)。
        <strong className="text-ink-soft">需求卡出难题,难题造出模块</strong>——这张图就是你要逐个击破的地图。
        先全局看懂 8 步,细节进课程,术语去术语表。
      </p>

      {/* ---- 可插拔实验台 ---- */}
      <div className="mt-5 rounded-xl border border-line bg-surface p-3.5">
        <div className="flex items-center gap-2 text-[12px] font-medium text-ink">
          <SlidersHorizontal size={14} weight="bold" className="text-muted" />
          可插拔实验台
          <span className="ml-auto font-mono text-[10px] text-faint">默认 = 现代 LLM 标准配置</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Knob label="层数">
            <Se value={String(layers)} onChange={(v) => setLayers(+v)} options={[[ "1", "1 层"], ["2", "2 层"], ["3", "3 层"]]} />
          </Knob>
          <Knob label="头数">
            <Se value={String(heads)} onChange={(v) => setHeads(+v)} options={[[ "1", "1"], ["2", "2"], ["4", "4"], ["8", "8"]]} />
          </Knob>
          <Knob label="分词">
            <Se value={tw.tokenizer} onChange={(v) => upd("tokenizer", v)} options={[["char", "字符"], ["bpe", "BPE"]]} />
          </Knob>
          <Knob label="位置">
            <Se value={tw.position} onChange={(v) => upd("position", v)} options={[["rope", "RoPE"], ["none", "旁路"]]} />
          </Knob>
          <Knob label="归一化">
            <Se value={tw.norm} onChange={(v) => upd("norm", v)} options={[["rmsnorm", "RMSNorm"], ["layernorm", "LayerNorm"], ["none", "旁路"]]} />
          </Knob>
          <Knob label="激活">
            <Se value={tw.activation} onChange={(v) => upd("activation", v)} options={[["swiglu", "SwiGLU"], ["gelu", "GELU"], ["relu", "ReLU"]]} />
          </Knob>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-2.5">
          <Knob label="采样">
            <Se value={tw.sampler} onChange={(v) => upd("sampler", v)} options={[["greedy", "贪心"], ["temperature", "温度"], ["topk", "Top-k"]]} />
          </Knob>
          {tw.sampler === "temperature" && (
            <label className="flex min-w-0 items-center gap-1.5 text-[10.5px] text-faint">
              温度
              <input
                type="range"
                min={0.1}
                max={1.5}
                step={0.1}
                value={tw.temperature}
                onChange={(e) => upd("temperature", +e.target.value)}
                className="h-1 w-20 accent-current"
              />
              <span className="w-6 font-mono text-[11px] text-ink">{tw.temperature.toFixed(1)}</span>
            </label>
          )}
          {tw.sampler === "topk" && (
            <label className="flex min-w-0 items-center gap-1.5 text-[10.5px] text-faint">
              k
              <input
                type="range"
                min={1}
                max={8}
                step={1}
                value={tw.topK}
                onChange={(e) => upd("topK", +e.target.value)}
                className="h-1 w-20 accent-current"
              />
              <span className="w-4 font-mono text-[11px] text-ink">{tw.topK}</span>
            </label>
          )}
          <span className="min-w-0 grow" />
          <SwitchChip on={tw.causal} label="因果掩码" onClick={() => upd("causal", !tw.causal)} />
          <SwitchChip on={tw.residual} label="残差连接" onClick={() => upd("residual", !tw.residual)} />
        </div>
      </div>

      {/* ---- 演示文本 ---- */}
      <div className="mt-3 flex items-center gap-2">
        <span className="shrink-0 text-[11px] text-faint">演示句子</span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={cfg.maxSeqLen - 2}
          className="h-8 w-full max-w-sm rounded-md border border-line bg-surface px-2.5 font-mono text-[12.5px] text-ink outline-none focus:border-line-strong"
        />
        <span className="hidden shrink-0 text-[11px] text-faint sm:block">
          {ids.length} token · 宽度 {cfg.dModel} · 词表 {cfg.vocabSize}
        </span>
      </div>

      {/* ---- 竖向管道 ---- */}
      <div className="mt-5 space-y-1.5">
        <div className="flex items-center gap-2 px-1 pb-1 text-[10.5px] font-medium uppercase tracking-widest text-faint">
          <MapTrifold size={13} weight="bold" className="text-muted" />
          推理管道 · decoder-only
        </div>
        {ARCH_NODES.map((node, i) => (
          <div key={node.id}>
            <NodeCard
              node={node}
              open={open === node.id}
              onToggle={() => setOpen(open === node.id ? null : node.id)}
              onGoLesson={onGoLesson}
            >
              {demo(node)}
            </NodeCard>
            {i < ARCH_NODES.length - 1 && (
              <div className="flex justify-center py-1 text-faint">
                <ArrowDown size={13} weight="bold" />
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="mt-6 text-[11.5px] leading-relaxed text-faint">
        想动手验证?点节点右上角的「去第 X 课」,进入对应课程的完整讲解与实验;感觉术语太多,随时去侧边栏的
        「术语表」查人话解释。所有替换/旁路都在浏览器里实时重算,不会污染训练用的标准引擎。
      </p>
    </div>
  );
}