/**
 * ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
 *  LLM 实验室 · 架构解剖实验台(architecture.ts)
 * ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
 *
 * 这是「架构总览」交互图背后的引擎:一份**可插拔**的前向传播。
 * 每个模块都能被替换 / 旁路,用来回答同一个问题——
 * 「如果不用它,模型会怎样?」
 *
 *   tokenizer  —— 字符级 / BPE
 *   position   —— RoPE / 关闭(丢失先后顺序)
 *   norm       —— RMSNorm / LayerNorm / 关闭(量级失控)
 *   residual   —— 开 / 关(梯度断流)
 *   activation —— SwiGLU / GELU / ReLU(门控 vs 普通激活)
 *   causal     —— 开 / 关(能否偷看未来)
 *   sampler    —— 贪心 / 温度 / Top-k(生成时如何选下一个)
 *
 * 与 lib/llm 的标准引擎(model.forward / training)解耦:标准引擎保持
 * 完整、可训练;这里的实验版只用于观察,不改动学习算法本身。
 */
import type { LLMConfig } from "./config";
import type { Mat } from "./math";
import { linearSeq, softmax, temperatureSoftmax } from "./math";
import { multiHeadAttention } from "./attention";
import { layerNormSeq, rmsNormSeq } from "./norm";
import { gelu, relu, swigluSeq } from "./feedforward";
import type { MicroGPTWeights } from "./model";
import type { BlockWeights } from "./transformer";
import type { precomputeRope } from "./embeddings";

/** 位置编码方案:RoPE 或干脆不做(观察丢失顺序后的注意力长什么样)。 */
export type PosTweak = "rope" | "none";
/** 归一化方案:两种真实归一化,或旁路(观察量级失控)。 */
export type NormTweak = "rmsnorm" | "layernorm" | "none";
/** 前馈激活:门控族 vs 普通激活族。 */
export type ActTweak = "swiglu" | "gelu" | "relu";
/** 采样策略与它需要的参数。 */
export type SamplerTweak = "greedy" | "temperature" | "topk";

/** 实验台的全部旋钮。 */
export interface ArchTweak {
  tokenizer: "char" | "bpe";
  position: PosTweak;
  norm: NormTweak;
  activation: ActTweak;
  residual: boolean;
  causal: boolean;
  sampler: SamplerTweak;
  temperature: number;
  topK: number;
}

/** 默认 = 现代 LLM 的标准配置(RoPE + RMSNorm + SwiGLU + 因果 + 残差)。 */
export const DEFAULT_TWEAK: ArchTweak = {
  tokenizer: "char",
  position: "rope",
  norm: "rmsnorm",
  activation: "swiglu",
  residual: true,
  causal: true,
  sampler: "temperature",
  temperature: 0.9,
  topK: 3,
};

/** 按旋钮选出对应的归一化实现;旁路时原样放行(不做任何归一化)。 */
function pickNorm(kind: NormTweak) {
  return (x: Mat[], gamma: Mat): Mat[] => {
    if (kind === "layernorm") return layerNormSeq(x, gamma);
    if (kind === "none") return x;
    return rmsNormSeq(x, gamma);
  };
}

/** SwiGLU 用三段权重;普通激活用 w1 上投影 + w3 下投影的两段式 FFN。 */
function ffnWith(x: Mat[], w: BlockWeights, cfg: LLMConfig, kind: ActTweak): Mat[] {
  if (kind === "swiglu") return swigluSeq(x, w.w1, w.w2, w.w3);
  const act = kind === "gelu" ? gelu : relu;
  const up = linearSeq(x, w.w1, undefined, cfg.dModel, cfg.dFF).map((v) => {
    const o = new Float32Array(v.length);
    for (let i = 0; i < v.length; i++) o[i] = act(v[i]!);
    return o;
  });
  return linearSeq(up, w.w3, undefined, cfg.dFF, cfg.dModel);
}

/** 两序列逐元素相加(残差连接)。 */
function addSeq(a: Mat[], b: Mat[], d: number): Mat[] {
  return a.map((v, i) => {
    const out = new Float32Array(d);
    const rhs = b[i]!;
    for (let j = 0; j < d; j++) out[j] = v[j]! + rhs[j]!;
    return out;
  });
}

/** 整条序列的 L2 范数(观察"量级在层间如何漂移")。 */
function normOfSeq(x: Mat[]): number {
  let sum = 0;
  for (const v of x) for (const e of v) sum += e * e;
  return Math.sqrt(sum);
}

/**
 * 可插拔的完整前向:与 model.forward 结构一致,但每一步都尊重 tweak。
 * @returns logits、逐层注意力 trace、以及每层输出量级 mags。
 */
export function forwardWith(
  ids: number[],
  cfg: LLMConfig,
  w: MicroGPTWeights,
  rope: ReturnType<typeof precomputeRope>,
  tw: ArchTweak,
  collectTrace = true,
): { logits: Mat[]; trace: { layers: number[][][][] } | null; mags: number[] } {
  const norm = pickNorm(tw.norm);
  const trace: { layers: number[][][][] } = { layers: [] };
  const mags: number[] = [];

  let x = ids.map((id) => w.emb.subarray(id * cfg.dModel, (id + 1) * cfg.dModel));
  mags.push(normOfSeq(x));

  for (const block of w.blocks) {
    // ① 注意力子层(归一化 → RoPE → 多头注意力 → 残差)。
    const attn = multiHeadAttention(
      norm(x, block.norm1),
      block.wq,
      block.wk,
      block.wv,
      block.wo,
      rope,
      cfg,
      tw.causal,
      tw.position === "rope",
    );
    const h1 = tw.residual ? addSeq(x, attn.outputs, cfg.dModel) : attn.outputs;
    if (collectTrace) trace.layers.push(attn.headsWeights);

    // ② FFN 子层(归一化 → 激活版本 → 残差)。
    const h2 = ffnWith(norm(h1, block.norm2), block, cfg, tw.activation);
    x = tw.residual ? addSeq(h1, h2, cfg.dModel) : h2;
    mags.push(normOfSeq(x));
  }

  // ③ 最终归一化 + 输出头。
  const normed = norm(x, w.finalNorm);
  const logits = linearSeq(normed, w.head, undefined, cfg.dModel, cfg.vocabSize);

  return { logits, trace: collectTrace ? trace : null, mags };
}

/** 取出"下一个位置"的 top-k 概率(输出头 / softmax 演示)。 */
export function lastTopK(logits: Mat[], k = 5): Array<{ id: number; p: number }> {
  const last = logits[logits.length - 1]!;
  const probs = softmax(last);
  return Array.from({ length: probs.length }, (_, id) => ({ id, p: probs[id]! }))
    .sort((a, b) => b.p - a.p)
    .slice(0, k);
}

/** 下一个位置的分布熵(0 = 完全确定,1 = 完全均匀),观察差模型的熵。 */
export function lastEntropy(logits: Mat[]): number {
  const last = logits[logits.length - 1]!;
  const probs = softmax(last);
  let h = 0;
  for (const p of probs) if (p > 1e-9) h -= p * Math.log(p);
  return h / Math.log(probs.length);
}

/** Top-k 重归一化为概率分布(未选中的候选概率为 0)。 */
export function topKDist(last: Mat, k: number): Float32Array {
  const probs = softmax(last);
  const cutoff = Array.from(probs)
    .map((p, id) => ({ p, id }))
    .sort((a, b) => b.p - a.p)
    .slice(0, Math.max(1, k))[k - 1]!.p;
  let sum = 0;
  for (let i = 0; i < probs.length; i++) {
    if (probs[i]! < cutoff) probs[i] = 0;
    else sum += probs[i]!;
  }
  if (sum > 0) for (let i = 0; i < probs.length; i++) probs[i]! /= sum;
  return probs;
}

/**
 * 按 tweak 的采样策略,从最后位置 logits 选一个 token id(供生成演示)。
 * 只在事件回调里调用(内含 Math.random)。
 */
export function sampleNext(
  logits: Mat[],
  tw: ArchTweak,
  session: { decode: (ids: number[]) => string },
): { id: number; token: string; prob: number } {
  const last = logits[logits.length - 1]!;
  let probs: Float32Array;
  if (tw.sampler === "temperature") {
    probs = temperatureSoftmax(last, tw.temperature);
  } else if (tw.sampler === "topk") {
    probs = topKDist(last, tw.topK);
  } else {
    probs = softmax(last);
  }
  let chosen: number;
  if (tw.sampler === "greedy") {
    chosen = 0;
    probs.forEach((p, id) => (p > probs[chosen]! ? (chosen = id) : undefined));
  } else {
    let r = Math.random();
    chosen = probs.length - 1;
    for (let i = 0; i < probs.length; i++) {
      r -= probs[i]!;
      if (r <= 0) {
        chosen = i;
        break;
      }
    }
  }
  return { id: chosen, token: session.decode([chosen]), prob: probs[chosen]! };
}