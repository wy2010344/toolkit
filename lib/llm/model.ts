/**
 * ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
 *  LLM 实验室 · 微型 GPT 模型(Micro-GPT)
 * ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
 *
 * 把所有积木拼成最终形态。这是现代 LLM 的完整骨架(decoder-only GPT):
 *
 *   token ids ─▶ Embedding ─▶  [Layers × Block]  ─▶ FinalNorm ─▶ Linear(词表)
 *
 * 最后那个 Linear 叫"输出头"(unembed / lm_head)。它把 dModel 维的向量
 * 映射回"每个候选 token 一个分数"(logits)。softmax 后就是"下一个
 * 该写哪个词"的概率分布。所以模型训练的实质就是:
 *
 *   让"下一个 token 是正确答案"在分布里的概率尽量大。
 *
 * 真实工程里输出头常常与词嵌入权重共享(weight tying,GPT-2 起常用),
 * 我们在 generate 的注释里点明;为避免失真仍用独立权重。
 */
import type { GenResult, LLMConfig } from "./config";
import type { Mat } from "./math";
import { crossEntropy, linearSeq, sample, softmax, temperatureSoftmax } from "./math";
import { createTokenEmbedding, embedSequence, precomputeRope } from "./embeddings";
import { createBlockWeights, runBlock, type BlockWeights } from "./transformer";
import { createNormWeight, rmsNormSeq } from "./norm";

/** 模型全部参数:词嵌入 + nLayers 个块 + 最终归一化 + 输出头。 */
export interface MicroGPTWeights {
  emb: Mat; // [vocabSize, dModel]
  blocks: BlockWeights[];
  finalNorm: Mat;
  head: Mat; // [dModel, vocabSize]
}

export function createWeights(cfg: LLMConfig): MicroGPTWeights {
  return {
    emb: createTokenEmbedding(cfg),
    blocks: Array.from({ length: cfg.nLayers }, () => createBlockWeights(cfg)),
    finalNorm: createNormWeight(cfg.dModel),
    head: new Float32Array(cfg.dModel * cfg.vocabSize),
  };
}

/** 输出头权重初始化:标准正态 × 0.02(GPT 论文的经验值)。 */
export function initHeadRandom(head: Mat): void {
  for (let i = 0; i < head.length; i++) head[i] = (Math.random() * 2 - 1) * 0.02;
}

/**
 * 前向传播:token ids → logits(每个位置的每个候选 token 一个分数)。
 *
 * @param ids token id 序列(任意长度 ≤ maxSeqLen)
 * @param collectTrace 为 true 时返回每层各头注意力权重(可视化用,稍慢)
 */
export interface TraceSnapshot {
  /** layers[l] = 第 l 层各头的注意力权重矩阵 [nHeads][T][T]。 */
  layers: number[][][][];
}

export function forward(
  ids: number[],
  cfg: LLMConfig,
  w: MicroGPTWeights,
  rope: ReturnType<typeof precomputeRope>,
  collectTrace = false,
  opts: { causal?: boolean } = {},
): { logits: Mat[]; trace: TraceSnapshot | null } {
  const causal = opts.causal ?? true;
  let x = embedSequence(w.emb, ids, cfg.dModel);
  const trace: TraceSnapshot = { layers: [] };

  for (const block of w.blocks) {
    const r = runBlock(x, block, cfg, rope, causal);
    x = r.x;
    if (collectTrace) trace.layers.push(r.headsWeights);
  }

  // 最终归一化 + 输出头 → logits。
  const normed = rmsNormSeq(x, w.finalNorm);
  const logits = linearSeq(normed, w.head, undefined, cfg.dModel, cfg.vocabSize);

  return { logits, trace: collectTrace ? trace : null };
}

/**
 * 自回归生成:给定前缀,逐个预测并追加下一个 token。
 *
 * 朴素实现每次重新前向整条序列。真实模型为了提速会用"KV 缓存"
 * (把已算过的 Key/Value 存起来只算新位置),这是上一篇显而易见的
 * 优化方向,课程思考题会提到。
 */
export function generate(
  ids: number[],
  cfg: LLMConfig,
  w: MicroGPTWeights,
  rope: ReturnType<typeof precomputeRope>,
  maxTokens: number,
  temperature: number,
): GenResult[] {
  const history: GenResult[] = [];
  for (let step = 0; step < maxTokens; step++) {
    if (ids.length >= cfg.maxSeqLen) break;
    const { logits } = forward(ids, cfg, w, rope, false);
    const last = logits[logits.length - 1]!;
    const probs = temperatureSoftmax(last, temperature);
    const tokenId = temperature <= 0 ? argmax(last) : sample(probs);
    history.push({
      tokenId,
      tokenText: tokenId.toString(),
      probs,
      logits: last,
      truncated: false,
    });
    ids.push(tokenId);
  }
  return history;
}

/** 快速的 argmax。 */
function argmax(logits: Mat): number {
  let best = 0;
  for (let i = 1; i < logits.length; i++) if (logits[i]! > logits[best]!) best = i;
  return best;
}

/**
 * 计算"下一个 token"的概率分布与信息熵(H)。
 *   熵 H = -Σ p·log p。
 * 熵接近 0 表示模型信心十足,接近 log(vocabSize) 表示毫无把握。
 * 课程里用它可视化"训练让模型从茫然走向笃定"。
 */
export function nextTokenProbs(
  ids: number[],
  cfg: LLMConfig,
  w: MicroGPTWeights,
  rope: ReturnType<typeof precomputeRope>,
): { probs: Mat; logits: Mat; entropy: number } {
  const { logits } = forward(ids, cfg, w, rope, false);
  const last = logits[logits.length - 1]!.subarray(0);
  const probs = softmax(last);
  let entropy = 0;
  for (const p of probs) if (p > 0) entropy -= p * Math.log(p);
  return { probs, logits: last, entropy };
}

/**
 * 一次性返回整个序列的交叉熵总和(训练/验证用)。
 */
export function sequenceLoss(
  ids: number[],
  cfg: LLMConfig,
  w: MicroGPTWeights,
  rope: ReturnType<typeof precomputeRope>,
): number {
  if (ids.length < 2) return 0;
  const { logits } = forward(ids.slice(0, -1), cfg, w, rope, false);
  let total = 0;
  for (let t = 0; t < logits.length; t++) {
    const probs = softmax(logits[t]!);
    total += crossEntropy(probs as unknown as Mat, ids[t + 1]!);
  }
  return total / logits.length;
}

/**
 * 追踪数据流经各阶段的"向量量级"(L2 范数),供课程可视化用。
 * 返回:["嵌入", 每块输出(0..nLayers−1)]。
 */
export function traceMagnitudes(
  ids: number[],
  cfg: LLMConfig,
  w: MicroGPTWeights,
  rope: ReturnType<typeof precomputeRope>,
): number[] {
  let x = embedSequence(w.emb, ids, cfg.dModel);
  const mags: number[] = [normOfSeq(x)];
  for (const block of w.blocks) {
    x = runBlock(x, block, cfg, rope, true).x;
    mags.push(normOfSeq(x));
  }
  return mags;
}

/** 序列所有向量 L2 范数总和(可视为"信息总量"的粗糙度量)。 */
function normOfSeq(xs: Mat[]): number {
  let sum = 0;
  for (const v of xs) for (const d of v) sum += d * d;
  return Math.sqrt(sum);
}