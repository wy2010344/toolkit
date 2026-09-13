/**
 * ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
 *  LLM 实验室 · 归一化(RMSNorm)
 * ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
 *
 * 归一化的作用一句话:让每一层的输入"量纲稳定"。
 *
 * 神经网络的每一层都会改变数据的尺度(比如注意力输出的值可能忽大忽小),
 * 如果不加控制,几十层叠下来数值会爆炸或消失,梯度也没法正常传播。
 * 归一化层就在每层之间"把数据拉回到标准化状态"。
 *
 * 经典做法是 LayerNorm(对每个向量算均值/方差再归一)。
 * 而 LLaMA 用了更简约的 RMSNorm:只除以"均方根"、省略了减均值这一步,
 * 效果相近但少算 1 个大数,速度更快。这正是"前沿成果"选型的一处体现。
 *
 *   RMSNorm(x) = x / RMS(x) · γ       其中 γ 是一个 per-dim 可学习的缩放。
 *
 * 实践中常常"预归一"(Pre-Norm):归一化放在残差之前。本实现采用与
 * GPT-2 / LLaMA 一致的 Pre-Norm 残差结构:
 *
 *   x ← x + Sublayer(Norm(x))
 *
 * 好处:残差连接总能保留一份"原始的 x"直接往后传,即使某一层梯度消失,
 * 信息也能绕过去,网络更稳(这也是深层网络训练得动的原因之一)。
 */
import type { Mat } from "./math";

/** 计算一个向量的 RMS(除以它的维度,防止维度变大时 RMS 随意变大)。 */
export function rms(x: Mat): number {
  let sum = 0;
  for (let i = 0; i < x.length; i++) sum += x[i]! * x[i]!;
  return Math.sqrt(sum / x.length + 1e-6);
}

/** 单个向量做 RMSNorm。weight(γ)默认恒等(1),训练时才学习。 */
export function rmsNormVector(x: Mat, weight: Float32Array = new Float32Array(x.length).fill(1)): Mat {
  const r = rms(x);
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = (x[i]! / r) * weight[i]!;
  return out;
}

/** 对序列逐位置做 RMSNorm。 */
export function rmsNormSeq(x: Mat[], weight: Mat): Mat[] {
  return x.map((v) => rmsNormVector(v, weight));
}

/** 创建归一化的可学习权重(初始化为 1,即"先不做任何缩放")。 */
export function createNormWeight(dModel: number): Mat {
  return new Float32Array(dModel).fill(1);
}