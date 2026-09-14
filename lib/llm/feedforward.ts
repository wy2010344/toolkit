/**
 * ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
 *  LLM 实验室 · 前馈网络(Feed-Forward Network,FFN)
 * ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
 *
 * 注意力负责"token 之间互相交流",但交流完的信息还需精加工:
 * 在每个 token 自己的位置,把混合好的向量再过一遍全连接网络。
 * 这正是 Transformer 块里"注意力 + 前馈"分工明确的两步:
 *
 *   1. Attention  —— 序列维度上的信息聚合(横向交流)
 *   2. FFN        —— 特征维度上的非线性变换(纵向思考)
 *
 * 经典实现是两个线性层夹一个 ReLU。而 LLaMA / PaLM / GPT-4 / Qwen 等
 * 现代模型大多改用 **SwiGLU**,它比 ReLU 版本效果更好、训练更稳 ——
 * 这就是我们又一处"前沿选型"。
 *
 *   SwiGLU(x) = (x·W1 + b1) ⊙ Swish(x·W2 + b2) · W3
 *
 * 简单翻译:两个并行的门控分支,一个"候选内容"(线性),一个"门控信号"
 * (Swish 激活 0~1),两者逐元素相乘选出内容。门控让网络学会"哪些维度
 * 应该放行"。最后再投影回 dModel 维度。
 */
import type { Mat } from "./math";
import { linearSeq } from "./math";

/** Swish 激活函数:x · sigmoid(x),是 ReLU 的光滑版本。 */
export function swish(x: number): number {
  return x / (1 + Math.exp(-x));
}

/** GELU 激活函数(高斯误差线性单元):ReLU 的另一个平滑近似,倒桶状不上限。 */
export function gelu(x: number): number {
  return 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x * x * x)));
}

/** ReLU 激活函数:负输入直接截断为 0。 */
export function relu(x: number): number {
  return x > 0 ? x : 0;
}

/**
 * SwiGLU 前馈层(对序列的每个位置做)。
 *
 * @param x  输入,序列 [T][dModel]
 * @param w1 候选内容分支权重 [dModel → dFF]
 * @param w2 门控分支权重     [dModel → dFF]
 * @param w3 输出投影权重     [dFF → dModel]
 * @returns  序列 [T][dModel]
 *
 * 中间维度 dFF 通常大于 dModel(扩张-压缩),让模型有更大"思考空间"。
 */
export function swigluSeq(x: Mat[], w1: Mat, w2: Mat, w3: Mat): Mat[] {
  // 分支 1:线性变换 → Swish 激活 → 每个中间神经元成为"候选内容"。
  const hidden1 = linearSeq(x, w1, undefined, x[0]?.length ?? 0, w1.length / (x[0]?.length ?? 1)).map((v) => {
    const out = new Float32Array(v.length);
    for (let i = 0; i < v.length; i++) out[i] = swish(v[i]!);
    return out;
  });
  // 分支 2:线性变换 → 再经过 sigmoid(由 swish 的实现已内含)→ 门控 0~1。
  const gate = linearSeq(x, w2, undefined, x[0]?.length ?? 0, w2.length / (x[0]?.length ?? 1));
  // 逐元素相乘(内容 × 门),再投影回 dModel。
  const gated = linearSeq(
    gate.map((g, i) => {
      const h = hidden1[i]!;
      const out = new Float32Array(h.length);
      for (let d = 0; d < h.length; d++) out[d] = h[d]! * g[d]!;
      return out;
    }),
    w3,
    undefined,
    gate[0]?.length ?? 0,
    w3.length / (gate[0]?.length ?? 1),
  );
  return gated;
}