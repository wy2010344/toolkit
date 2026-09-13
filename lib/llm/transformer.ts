/**
 * ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
 *  LLM 实验室 · Transformer 解码器块
 * ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
 *
 * 把前面所有零件组装成一个"标准积木块"——
 *
 *                          ┌──────────────────────────────┐
 *      x ──▶ PreNorm ─▶ MultiHeadAttention ─┐             │
 *      │                                   │ (+) 残差加法  │
 *      └───────────────────────────────────┘             ▼
 *      x ──▶ PreNorm ─▶ SwiGLU FFN ────────┐            x (出块)
 *      └───────────────────────────────────┘
 *
 * 一个"块" = 一次"注意力横向交流" + 一次"FFN 纵向思考",
 * 这正是 GPT 里的"一层"。模型是 nLayers 个这样的块叠起来,
 * 信息一层层加工,越往后越抽象。
 *
 * 「残差 + 预归一」的结构细节:
 *   - 每个子层输出前都保留一份原始 x(残差连接):x ← x + Sub(Norm(x))
 *   - 归一化放在子层**之前**(Pre-Norm),这让深网络训练稳定得多。
 *     对比一下早期 Transformer 用的 Post-Norm,这是结构上的进化点。
 */
import type { LLMConfig } from "./config";
import type { Mat } from "./math";
import { precomputeRope } from "./embeddings";
import { multiHeadAttention } from "./attention";
import { createNormWeight, rmsNormSeq } from "./norm";
import { swigluSeq } from "./feedforward";

/** 一个块的全部可学习参数。注意:数组下标即层号,方便遍历与可视化。 */
export interface BlockWeights {
  /** 注意力前的归一化权重。 */
  norm1: Mat;
  /** Q / K / V 投影。 */
  wq: Mat;
  wk: Mat;
  wv: Mat;
  /** 注意力输出投影。 */
  wo: Mat;
  /** FFN 前的归一化权重。 */
  norm2: Mat;
  /** SwiGLU 的两个输入分支 + 输出投影。 */
  w1: Mat;
  w2: Mat;
  w3: Mat;
}

/** 按配置初始化一个块的参数(标准正态 × √(2/nLayer) 风格小随机)。 */
export function createBlockWeights(cfg: LLMConfig): BlockWeights {
  const d = cfg.dModel;
  const dFF = cfg.dFF;
  const rand = (n: number) => {
    const w = new Float32Array(n);
    const k = cfg.dModel;
    const scale = Math.sqrt(2 / k);
    for (let i = 0; i < n; i++) w[i] = (Math.random() * 2 - 1) * scale;
    return w;
  };
  return {
    norm1: createNormWeight(d),
    wq: rand(d * d),
    wk: rand(d * d),
    wv: rand(d * d),
    wo: rand(d * d),
    norm2: createNormWeight(d),
    w1: rand(d * dFF),
    w2: rand(d * dFF),
    w3: rand(dFF * d),
  };
}

/**
 * 对 x 跑一个完整的 Transformer 块。
 * @returns 处理后的序列,以及供可视化使用的各头注意力权重。
 */
export interface BlockOutput {
  x: Mat[];
  headsWeights: number[][][];
}

export function runBlock(
  x: Mat[],
  w: BlockWeights,
  cfg: LLMConfig,
  rope: ReturnType<typeof precomputeRope>,
  causal = true,
): BlockOutput {
  // ① 注意力子层:先归一再注意,再残差相加。
  const attn = multiHeadAttention(rmsNormSeq(x, w.norm1), w.wq, w.wk, w.wv, w.wo, rope, cfg, causal);
  const h1 = attn.outputs.map((v, i) => {
    const out = new Float32Array(cfg.dModel);
    const base = x[i]!;
    for (let d = 0; d < cfg.dModel; d++) out[d] = base[d]! + v[d]!;
    return out;
  });

  // ② FFN 子层:同样"先归一再前馈,再残差相加"。
  const ff = swigluSeq(rmsNormSeq(h1, w.norm2), w.w1, w.w2, w.w3);
  const h2 = ff.map((v, i) => {
    const out = new Float32Array(cfg.dModel);
    const base = h1[i]!;
    for (let d = 0; d < cfg.dModel; d++) out[d] = base[d]! + v[d]!;
    return out;
  });

  return { x: h2, headsWeights: attn.headsWeights };
}