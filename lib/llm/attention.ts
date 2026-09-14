/**
 * ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
 *  LLM 实验室 · 多头因果自注意力(Self-Attention)
 * ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
 *
 * 这是 Transformer 的灵魂,也是"注意力是你要的一切"(Attention Is All
 * You Need)这句话的来源。请务必逐行读懂本文件,它值得时间。
 *
 * ── 一句话版本 ─────────────────────────────────────────────────
 * 序列里每个 token,都拿自己的"问题 Q"去问所有 token 的"钥匙 K",
 * 点积算相似度,softmax 变成权重,再按这些权重加权求和所有 token 的
 * "值 V"。于是每个 token 的输出 = 全序列信息的加权混音。
 *
 *   Q(查询)  ×  K(键)  →  相似度分数  →  softmax  →  对 V 加权求和
 *   "我在找什么" × "我记着什么" = 找到最相关的内容,再把它取出来
 *
 * ── 为什么叫"自"注意力 ─────────────────────────────────────────
 * Q、K、V 全部由**同一个序列**自己投影而来——自己问自己、自己答自己。
 * 这与"cross-attention"(Q 来自一个序列、K/V 来自另一个)相区别。
 * 解码器只用自注意力,所以叫 decoder-only。
 *
 * ── 为什么"多头" ───────────────────────────────────────────────
 * 一组 Q/K/V 只能学一种"关系"(比如是否押韵、是否同主题)。把 dModel
 * 切成 nHeads 份,每个头在自己的子空间里独立做注意力,最后拼回去。
 * 相当于同时用 nHeads 双眼睛从不同角度观察同一句话。
 *
 * ── 为什么"因果"(causal) ─────────────────────────────────────────
 * 生成文本时模型只能"看着已写的内容"推下一个词,绝不能偷看未来。
 * 方法很简单:计算注意力分数时,把"未来位置"的分数设成 -∞,
 * softmax 后这些位置的权重自动归零。这被称为 mask。
 */

import type { LLMConfig } from "./config";
import type { Mat } from "./math";
import { linearSeq, softmax } from "./math";
import { precomputeRope, applyRopeInPlace } from "./embeddings";

/**
 * ═══════════════════════════════════════════════════════════════════
 * ① 单头缩放点积注意力
 * ═══════════════════════════════════════════════════════════════════
 * 这是最简单的"单个注意力头"完整计算,输出有两个:
 *   - outputs:每个位置的输出向量(headDim 维)
 *   - weights:注意力权重矩阵 [T][T],weight[i][j] = i 位置如何依赖 j 位置。
 *             这是可视化里最漂亮的图 —— 一个真正的"谁在看谁"矩阵。
 *
 * 公式:
 *   scores[i][j] = (q_i · k_j) / √head_dim
 *   weights[i]   = softmax(scores[i] + mask[i])
 *   output[i]    = Σ_j weights[i][j] · v_j
 *
 * 除以 √head_dim 是"缩放"的关键:向量长度变大后点积的方差也变大,
 * softmax 会过早饱和(梯度消失),缩放让它保持在温和区间。
 */
export interface HeadResult {
  outputs: Mat[];
  weights: number[][];
}

export function scaledDotProductAttention(
  qs: Mat[],
  ks: Mat[],
  vs: Mat[],
  headDim: number,
  causal = true,
): HeadResult {
  const T = qs.length;
  const scale = 1 / Math.sqrt(headDim);

  const outputs: Mat[] = [];
  const weights: number[][] = [];

  for (let i = 0; i < T; i++) {
    const scores = new Float32Array(T);
    for (let j = 0; j < T; j++) {
      // ① 点积 = 相似度。
      let dot = 0;
      for (let d = 0; d < headDim; d++) dot += qs[i]![d]! * ks[j]![d]!;
      scores[j] = dot * scale;
      // ② 因果掩码:j > i(未来)→ 设 -∞。
      if (causal && j > i) scores[j] = -Infinity;
    }
    // ③ softmax 得到权重(未来的 -∞ 自动变 0)。
    const w = softmax(scores);
    weights.push(Array.from(w));
    // ④ 加权求和所有 V。
    const out = new Float32Array(headDim);
    for (let j = 0; j < T; j++) {
      for (let d = 0; d < headDim; d++) out[d] += w[j]! * vs[j]![d]!;
    }
    outputs.push(out);
  }

  return { outputs, weights };
}

/** 便捷工具:把序列 [T][dModel] 拼成一个分头视图 [nHeads][T][headDim]。 */
export function splitHeads(x: Mat[], cfg: LLMConfig): Mat[][] {
  const headDim = cfg.dModel / cfg.nHeads;
  const heads: Mat[][] = [];
  for (let h = 0; h < cfg.nHeads; h++) {
    const seq: Mat[] = [];
    for (let t = 0; t < x.length; t++) {
      seq.push(x[t]!.subarray(h * headDim, (h + 1) * headDim));
    }
    heads.push(seq);
  }
  return heads;
}

/** 便捷工具:把分头结果 [nHeads][T][headDim] 拼回 [T][dModel]。 */
export function mergeHeads(heads: Mat[][], cfg: LLMConfig): Mat[] {
  const T = heads[0]!.length;
  const out: Mat[] = [];
  for (let t = 0; t < T; t++) {
    const row = new Float32Array(cfg.dModel);
    for (let h = 0; h < cfg.nHeads; h++) row.set(heads[h]![t]!, h * (cfg.dModel / cfg.nHeads));
    out.push(row);
  }
  return out;
}

/**
 * ═══════════════════════════════════════════════════════════════════
 * ② 多头注意力(一个 Transformer 块内调用)
 * ═══════════════════════════════════════════════════════════════════
 * 完整管线:
 *   x ──(Wq/Wk/Wv 投影)──▶ Q/K/V
 *   Q/K ──(RoPE 旋转)──▶  带位置信息的 Q/K
 *   按头:scaledDotProductAttention(Q_h, K_h, V_h)
 *   拼头 ──(Wo 输出投影)──▶ 多头注意力结果
 *
 * 权重命名借鉴真实实现:Wq/Wk/Wv/Wo 分别是问题、键、值、输出的投影矩阵。
 *
 * @param x        上一层输出,序列 [T][dModel]
 * @param wq Wk Wv  投影权重 [dModel, dModel]
 * @param wo        输出投影权重 [dModel, dModel]
 * @param rope      预计算好的 RoPE 缓存
 * @param cfg       模型配置
 * @param causalMask 是否使用因果掩码(训练/生成用 true,课程演示可关掉)
 * @param applyRoPE 是否施加旋转位置编码(架构总览实验台可关掉看对比)
 * @returns 结果与每个头的权重矩阵(供可视化)
 */
export interface MultiHeadResult {
  outputs: Mat[];
  /** headsWeights[h][i][j] —— 第 h 个头的注意力权重矩阵。 */
  headsWeights: number[][][];
}

export function multiHeadAttention(
  x: Mat[],
  wq: Mat,
  wk: Mat,
  wv: Mat,
  wo: Mat,
  rope: ReturnType<typeof precomputeRope>,
  cfg: LLMConfig,
  causalMask = true,
  applyRoPE = true,
): MultiHeadResult {
  const headDim = cfg.dModel / cfg.nHeads;
  const T = x.length;

  // ① 三个线性投影(Q/K/V)。
  const qd = linearSeq(x, wq, undefined, cfg.dModel, cfg.dModel);
  const kd = linearSeq(x, wk, undefined, cfg.dModel, cfg.dModel);
  const vd = linearSeq(x, wv, undefined, cfg.dModel, cfg.dModel);

  // ② 对 Q 和 K 施加 RoPE(带上位置信息);架构实验台可旁路。
  if (applyRoPE) for (let pos = 0; pos < T; pos++) applyRopeInPlace([qd[pos]!, kd[pos]!], pos, rope);

  // ③ 分头 + 每个头独立注意力。
  const qHeads = splitHeads(qd, cfg);
  const kHeads = splitHeads(kd, cfg);
  const vHeads = splitHeads(vd, cfg);

  const headOutputs: Mat[][] = [];
  const headsWeights: number[][][] = [];

  for (let h = 0; h < cfg.nHeads; h++) {
    const r = scaledDotProductAttention(qHeads[h]!, kHeads[h]!, vHeads[h]!, headDim, causalMask);
    headOutputs.push(r.outputs);
    headsWeights.push(r.weights);
  }

  // ④ 拼头 + 输出投影。
  const merged = mergeHeads(headOutputs, cfg);
  const outputs = linearSeq(merged, wo, undefined, cfg.dModel, cfg.dModel);

  return { outputs, headsWeights };
}