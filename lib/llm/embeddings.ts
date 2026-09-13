/**
 * ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
 *  LLM 实验室 · 词嵌入与旋转位置编码(Embedding + RoPE)
 * ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
 *
 * 现在模型面对的是整数 id 序列,但神经网络只能在连续向量上做数学。
 * "词嵌入"就是把每个 token id 查表变成一个 dModel 维向量:
 *
 *   [5] ──查表──▶ [ 0.21, -0.84, 1.02, ... ]  (可训练的向量)
 *
 * 每个 token id 对应一个"可学习"的向量,训练时会被反复推拉,使得:
 *   含义相近的 token → 向量相近(点积大)。
 * 这正是"分布式表征"思想的体现 —— 词的语义不再是一个离散符号,而是
 * 高维空间里的一个坐标。
 *
 * ── 位置信息从哪来?──────────────────────────────────────────────
 * 自注意力天生"不分先后":"
 *   "猫 追 狗" 和 "狗 追 猫"
 * 在注意力眼里只是两组 token,位置被弄丢了。必须显式注入位置信息。
 *
 * 我们采用近年主流的 **RoPE(旋转位置嵌入)**:
 *   给向量按维度切成若干 2 维平面,把每个平面旋转一个与位置相关的角度。
 * 妙处:旋转后,两个 token 的"注意力分数"会自动与它们的**相对**距离相关
 * (相对位置外推性更好),这是 LLaMA / GPT-3.5+ 都在用的方案。
 * 经典 GPT-2 用的"绝对正弦位置"在 RoPE 出现前也很主流,课后对比题会问。
 */

import type { LLMConfig } from "./config";
import type { Mat } from "./math";

/** 词嵌入表:形状 [vocabSize, dModel] 的平铺矩阵,初值用标准正态缩放。 */
export function createTokenEmbedding(cfg: LLMConfig): Mat {
  const table = new Float32Array(cfg.vocabSize * cfg.dModel);
  // 初始化为小随机值:均值 0,标准差 ~ 1/√dModel。
  // 太小梯度消失,太大训练不稳定——1/√dModel 是个常用起点。
  const scale = 1 / Math.sqrt(cfg.dModel);
  for (let i = 0; i < table.length; i++) table[i] = (Math.random() * 2 - 1) * scale;
  return table;
}

/** 查表:给 token id,取出它的嵌入向量(直接借用底层 buffer 的视图)。 */
export function embedToken(table: Mat, id: number, dModel: number): Mat {
  return table.subarray(id * dModel, (id + 1) * dModel);
}

/** 把一整句 token 序列都查表,变成"序列 × dModel"的行列表。 */
export function embedSequence(table: Mat, ids: number[], dModel: number): Mat[] {
  return ids.map((id) => embedToken(table, id, dModel));
}

// ═════════════════════════════════════════════════════════════════════
// RoPE:旋转位置编码
// ═════════════════════════════════════════════════════════════════════
//
// 原理(3 步):
//   1. 把 dModel 维分成 dModel/2 个二维"平面"。
//   2. 每个平面有一个角速度 ω_i = base^(-2i/dModel), base 常用 10000。
//      因此靠前的维度(小 i)旋转慢,靠后的维度(大 i)旋转快。
//   3. 位置 p 的向量,其第 i 个平面旋转角度 p·ω_i。
//
// 数学表达(对第 i 个平面,输入 (x,y)):
//   x' = x·cos(pω) − y·sin(pω)
//   y' = x·sin(pω) + y·cos(pω)
//
// 为什么这样能表达"相对位置"?因为两个"已旋转"向量点积,会等于
// 它们"未旋转"时的点积再乘上 cos((p1−p2)ω), 即注意力分数自然携带
// 相对距离信息。

/** 预计算 cos/sin 缓存表,形状 [maxSeqLen][dModel/2]。position 0 是"原地"。 */
export function precomputeRope(cfg: LLMConfig): { cos: Mat[]; sin: Mat[] } {
  const nPlanes = cfg.dModel / 2;
  const cos: Mat[] = [];
  const sin: Mat[] = [];
  const base = 10000;
  for (let p = 0; p < cfg.maxSeqLen; p++) {
    const c = new Float32Array(nPlanes);
    const s = new Float32Array(nPlanes);
    for (let i = 0; i < nPlanes; i++) {
      const omega = 1 / Math.pow(base, (2 * i) / cfg.dModel);
      const angle = p * omega;
      c[i] = Math.cos(angle);
      s[i] = Math.sin(angle);
    }
    cos.push(c);
    sin.push(s);
  }
  return { cos, sin };
}

/**
 * 对序列每个位置应用旋转(原地修改)。用于 Q 和 K,注意 V 和后续 FFN
 * 都不需要旋转 —— 位置信息只参与"算相似度"这一步。
 */
export function applyRopeInPlace(vecs: Mat[], pos: number, rope: { cos: Mat[]; sin: Mat[] }): void {
  const c = rope.cos[pos]!;
  const s = rope.sin[pos]!;
  for (const v of vecs) {
    for (let i = 0; i < c.length; i++) {
      const x = v[2 * i]!;
      const y = v[2 * i + 1]!;
      v[2 * i] = x * c[i]! - y * s[i]!;
      v[2 * i + 1] = x * s[i]! + y * c[i]!;
    }
  }
}