/**
 * ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
 *  LLM 实验室 · 训练机制:反向传播 + AdamW
 * ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
 *
 * 前面我们把模型"算"出来了(前向传播)。这一节回答最关键的疑问:
 * "模型到底是怎么学会东西的?"
 *
 * ── 训练 = 梯度下降 ─────────────────────────────────────────────
 * 1. 前向传播:给定输入,算出预测,与正确答案比较得 loss(错得有多离谱)。
 * 2. 反向传播:用微积分链式法则,算出"每个权重往哪个方向调能让 loss 变小"。
 *    步长 = 学习率(learning rate, lr)。
 * 3. 更新权重:w ← w − lr × 梯度。反复迭代,loss 一路走低。
 *
 * 前沿成果方案在本文件的体现:
 *   - AdamW:带动量与自适应步长 + 权重衰减。今天几乎所有大模型都用它。
 *   - 学习率预热(warmup)+ 余弦退火:前期小步升温稳定训练,后期降温打磨。
 *
 * ⚠️ 教学提示:这里把反向传播写成最直白的行级循环,慢但每一步都可读。
 *    真实框架(PyTorch/JAX)靠自动微分 + GPU 并行实现同样的数学。
 */
import type { LLMConfig } from "./config";
import type { Mat } from "./math";
import { crossEntropy, linearSeq, softmax } from "./math";
import type { MicroGPTWeights } from "./model";
import type { precomputeRope } from "./embeddings";
import { applyRopeInPlace } from "./embeddings";
import { rms, rmsNormSeq } from "./norm";
import { scaledDotProductAttention, splitHeads, mergeHeads } from "./attention";
import { swish } from "./feedforward";

/** 与 MicroGPTWeights 同构的梯度容器,每个参数对应它的偏导数。 */
export interface Gradients {
  emb: Mat;
  blocks: BlockGrads[];
  finalNorm: Mat;
  head: Mat;
}
export interface BlockGrads {
  norm1: Mat;
  wq: Mat;
  wk: Mat;
  wv: Mat;
  wo: Mat;
  norm2: Mat;
  w1: Mat;
  w2: Mat;
  w3: Mat;
}

/** 零梯度容器。 */
export function zeroGradients(w: MicroGPTWeights): Gradients {
  return {
    emb: zeroLike(w.emb),
    blocks: w.blocks.map((b) => ({
      norm1: zeroLike(b.norm1),
      wq: zeroLike(b.wq),
      wk: zeroLike(b.wk),
      wv: zeroLike(b.wv),
      wo: zeroLike(b.wo),
      norm2: zeroLike(b.norm2),
      w1: zeroLike(b.w1),
      w2: zeroLike(b.w2),
      w3: zeroLike(b.w3),
    })),
    finalNorm: zeroLike(w.finalNorm),
    head: zeroLike(w.head),
  };
}
function zeroLike(t: Mat): Mat {
  return new Float32Array(t.length);
}

// ═══════════════════════════════════════════════════════════════════
// ① 反向传播的"基本拼图"(每个抽象层一个小函数)
// ═══════════════════════════════════════════════════════════════════

/**
 * 线性层反传:y[t] = x[t] @ W。
 * 因为 y[j] = Σ_k x[k]·W[k][j],偏导各归各位:
 *   gW[k][j] += x[k]·g_out[j]        ("输入的转发 × 输出的回传")
 *   gx[k]    += Σ_j W[k][j]·g_out[j]  ("输出的回传 × 权重转置")
 */
function linearBack(x: Mat[], W: Mat, gOut: Mat[], inDim: number, outDim: number): { gx: Mat[]; gW: Mat } {
  const gW = new Float32Array(inDim * outDim);
  const gx = x.map(() => new Float32Array(inDim));
  for (let t = 0; t < x.length; t++) {
    const xt = x[t]!;
    const go = gOut[t]!;
    for (let j = 0; j < outDim; j++) {
      const oj = go[j]!;
      if (oj === 0) continue;
      for (let k = 0; k < inDim; k++) {
        gx[t]![k]! += oj * W[k * outDim + j]!;
        gW[k * outDim + j]! += xt[k]! * oj;
      }
    }
  }
  return { gx, gW };
}

/**
 * RMSNorm 反传。前向公式见 norm.ts:
 *   y = x / r * γ,  r = √(Σx²/n + ε)
 * 由链式法则推出(这里直接给出结果,推导见课程教案):
 *   gx_i = g_i·γ_i / r − (x_i / (r³·n)) · Σ_j g_j·x_j·γ_j
 *   gγ_i = Σ_t g_t·x_t / r   (跨位置累计)
 */
function rmsNormBack(x: Mat[], gamma: Mat, gOut: Mat[]): { gx: Mat[]; gGamma: Mat } {
  const n = x[0]!.length;
  const gGamma = new Float32Array(n);
  const gx = x.map(() => new Float32Array(n));
  for (let t = 0; t < x.length; t++) {
    const v = x[t]!;
    const g = gOut[t]!;
    const r = rms(v);
    let inner = 0;
    for (let i = 0; i < n; i++) inner += g[i]! * v[i]! * gamma[i]!;
    const coef = inner / (r * r * r * n);
    for (let i = 0; i < n; i++) {
      gx[t]![i]! += (g[i]! * gamma[i]!) / r - v[i]! * coef;
      gGamma[i]! += (g[i]! * v[i]!) / r;
    }
  }
  return { gx, gGamma };
}

/**
 * 缩放点积注意力反传(单头)。
 * 前向:score[i][j] = (q_i·k_j)·scale → w = softmax(score+mask)
 *      out[i] = Σ_j w[i][j]·v[j]
 * 反传:
 *   gW[i][j]        = g_out[i]·v[j]                      (对权重矩阵)
 *   gScore[i][j]    = w[i][j]·(gW[i][j] − Σ_k gW[i][k]·w[i][k]) · scale
 *   gq[i] += Σ_j gScore[i][j]·k[j];  gk[j] += Σ_i gScore[i][j]·q[i]
 *   gv[j] += Σ_i g_out[i]·w[i][j]
 */
function attentionBack(
  q: Mat[],
  k: Mat[],
  v: Mat[],
  w: number[][],
  gOut: Mat[],
  headDim: number,
  scale: number,
): { gq: Mat[]; gk: Mat[]; gv: Mat[] } {
  const T = q.length;
  const gq = q.map(() => new Float32Array(headDim));
  const gk = k.map(() => new Float32Array(headDim));
  const gv = v.map(() => new Float32Array(headDim));

  for (let i = 0; i < T; i++) {
    const gW = new Float32Array(T);
    const gi = gOut[i]!;
    for (let j = 0; j < T; j++) {
      const vj = v[j]!;
      let dot = 0;
      for (let d = 0; d < headDim; d++) dot += gi[d]! * vj[d]!;
      gW[j] = dot;
    }
    let rowSum = 0;
    for (let j = 0; j < T; j++) rowSum += gW[j]! * w[i]![j]!;
    for (let j = 0; j < T; j++) {
      const gScore = w[i]![j]! * (gW[j]! - rowSum) * scale;
      if (gScore === 0) continue;
      const qj = q[i]!;
      const kj = k[j]!;
      for (let d = 0; d < headDim; d++) {
        gq[i]![d]! += gScore * kj[d]!;
        gk[j]![d]! += gScore * qj[d]!;
      }
    }
  }
  for (let j = 0; j < T; j++) {
    for (let i = 0; i < T; i++) {
      const wij = w[i]![j]!;
      if (wij === 0) continue;
      const gi = gOut[i]!;
      for (let d = 0; d < headDim; d++) gv[j]![d]! += gi[d]! * wij;
    }
  }
  return { gq, gk, gv };
}

/** RoPE 的反向:它的前向是正交旋转矩阵,梯度按"负角旋转"传回即可。 */
function unapplyRopeInPlace(vecs: Mat[], pos: number, rope: ReturnType<typeof precomputeRope>): void {
  const c = rope.cos[pos]!;
  const s = rope.sin[pos]!;
  for (const v of vecs) {
    for (let i = 0; i < c.length; i++) {
      const x = v[2 * i]!;
      const y = v[2 * i + 1]!;
      v[2 * i] = x * c[i]! + y * s[i]!;
      v[2 * i + 1] = -x * s[i]! + y * c[i]!;
    }
  }
}

/**
 * SwiGLU 反传。前向(对每个位置 t):
 *   z1 = x@W1  →  u = swish(z1); gate = x@W2; hidden = u⊙gate; y = hidden@W3
 * 反传顺序:gHidden → (gU = gHidden⊙gate, gGate = gHidden⊙u)
 *         → gate 线性反传、u ⊙ d(swish) 后再线性反传。
 */
function swigluBack(
  x: Mat[],
  W1: Mat,
  W2: Mat,
  W3: Mat,
  z1: Mat[],
  gate: Mat[],
  hidden: Mat[],
  gOut: Mat[],
  dModel: number,
  dFF: number,
): { gx: Mat[]; gW1: Mat; gW2: Mat; gW3: Mat } {
  const T = x.length;
  const gW3 = new Float32Array(dFF * dModel);

  // -- 输出线性层:y = hidden@W3, W3: [dFF, dModel] --
  const gHidden = x.map(() => new Float32Array(dFF));
  for (let t = 0; t < T; t++) {
    const gh = gHidden[t]!;
    const go = gOut[t]!;
    const hd = hidden[t]!;
    for (let d = 0; d < dFF; d++) {
      const hd_d = hd[d]!;
      for (let j = 0; j < dModel; j++) {
        gh[d]! += go[j]! * W3[d * dModel + j]!;
        gW3[d * dModel + j]! += hd_d * go[j]!;
      }
    }
  }

  // -- 门控相乘:hidden = u ⊙ gate --
  const gU = x.map(() => new Float32Array(dFF));
  const gGate = x.map(() => new Float32Array(dFF));
  for (let t = 0; t < T; t++) {
    const ghd = gHidden[t]!;
    const gt = gate[t]!;
    const ut = z1[t]!; // 注意:u = swish(z1),乘的是激活后的 u
    for (let d = 0; d < dFF; d++) {
      gU[t]![d]! = ghd[d]! * gt[d]!;
      gGate[t]![d]! = ghd[d]! * swish(ut[d]!);
    }
  }

  // -- gate = x@W2, W2: [dModel, dFF] --
  const gateRes = linearBack(x, W2, gGate, dModel, dFF);

  // -- u = swish(z1), z1 = x@W1 --
  const gZ1 = x.map(() => new Float32Array(dFF));
  for (let t = 0; t < T; t++) {
    const gud = gU[t]!;
    const zd = z1[t]!;
    for (let d = 0; d < dFF; d++) {
      const z = zd[d]!;
      const sig = 1 / (1 + Math.exp(-z));
      // d/dz swish(z) = σ(z)·(1 + z·(1−σ(z)))
      const dSwish = sig * (1 + z * (1 - sig));
      gZ1[t]![d]! = gud[d]! * dSwish;
    }
  }
  const zRes = linearBack(x, W1, gZ1, dModel, dFF); // W1: [dModel, dFF]

  // -- 汇总输入梯度:两条分支都来自 x --
  const gx = x.map(() => new Float32Array(dModel));
  for (let t = 0; t < T; t++) {
    for (let k = 0; k < dModel; k++) {
      gx[t]![k]! = gateRes.gx[t]![k]! + zRes.gx[t]![k]!;
    }
  }
  return { gx, gW1: zRes.gW, gW2: gateRes.gW, gW3 };
}

// ═══════════════════════════════════════════════════════════════════
// ② 训练用前向:把每一步中间结果都存下来,供反向传播使用
// ═══════════════════════════════════════════════════════════════════

interface LayerAct {
  /** 块的输入(上一层输出或嵌入)。 */
  prev: Mat[];
  /** 注意力归一化后的输入。 */
  attnIn: Mat[];
  /** RoPE 后的 Q/K 与未旋转的 V。 */
  qd: Mat[];
  kd: Mat[];
  vd: Mat[];
  /** 分头后的 Q/K/V,以及各头注意力权重。 */
  headsQ: Mat[][];
  headsK: Mat[][];
  headsV: Mat[][];
  headWeights: number[][][];
  /** 拼头 + Wo 投影后的注意力输出。 */
  merged: Mat[];
  attnOut: Mat[];
  /** 注意力残差相加结果 xA = prev + attnOut。 */
  xA: Mat[];
  /** FFN 输入 = 对 xA 的归一化。 */
  ffnIn: Mat[];
  /** SwiGLU 中间量。 */
  z1: Mat[];
  gate: Mat[];
  hidden: Mat[];
  /** 块输出 xF = xA + ffOut。 */
  xF: Mat[];
}

interface TrainForward {
  input: number[];
  targets: number[];
  x0: Mat[];
  layers: LayerAct[];
  finalNormed: Mat[];
  logits: Mat[];
}

function addSeq(a: Mat[], b: Mat[], dim: number): Mat[] {
  return a.map((av, i) => {
    const out = new Float32Array(dim);
    const bv = b[i]!;
    for (let d = 0; d < dim; d++) out[d] = av[d]! + bv[d]!;
    return out;
  });
}

function trainForward(ids: number[], cfg: LLMConfig, w: MicroGPTWeights, rope: ReturnType<typeof precomputeRope>): TrainForward {
  const input = ids.slice(0, -1);
  const targets = ids.slice(1);
  const T = input.length;
  const headDim = cfg.dModel / cfg.nHeads;

  const x0 = input.map((id) => w.emb.subarray(id * cfg.dModel, (id + 1) * cfg.dModel));
  const layers: LayerAct[] = [];

  let prev = x0.slice();
  for (let l = 0; l < cfg.nLayers; l++) {
    const blk = w.blocks[l]!;

    const attnIn = rmsNormSeq(prev, blk.norm1);
    const qd = linearSeq(attnIn, blk.wq, undefined, cfg.dModel, cfg.dModel);
    const kd = linearSeq(attnIn, blk.wk, undefined, cfg.dModel, cfg.dModel);
    const vd = linearSeq(attnIn, blk.wv, undefined, cfg.dModel, cfg.dModel);
    // 给 Q/K 施加 RoPE(原地旋转)。
    for (let pos = 0; pos < T; pos++) applyRopeInPlace([qd[pos]!, kd[pos]!], pos, rope);

    const headsQ = splitHeads(qd, cfg);
    const headsK = splitHeads(kd, cfg);
    const headsV = splitHeads(vd, cfg);
    const headOuts: Mat[][] = [];
    const headWeights: number[][][] = [];
    for (let h = 0; h < cfg.nHeads; h++) {
      const r = scaledDotProductAttention(headsQ[h]!, headsK[h]!, headsV[h]!, headDim, true);
      headOuts.push(r.outputs);
      headWeights.push(r.weights);
    }
    const merged = mergeHeads(headOuts, cfg);
    const attnOut = linearSeq(merged, blk.wo, undefined, cfg.dModel, cfg.dModel);
    const xA = addSeq(prev, attnOut, cfg.dModel);

    const ffnIn = rmsNormSeq(xA, blk.norm2);
    const z1 = linearSeq(ffnIn, blk.w1, undefined, cfg.dModel, cfg.dFF);
    const u = z1.map((v) => {
      const out = new Float32Array(cfg.dFF);
      for (let i = 0; i < cfg.dFF; i++) out[i] = swish(v[i]!);
      return out;
    });
    const gate = linearSeq(ffnIn, blk.w2, undefined, cfg.dModel, cfg.dFF);
    const hidden = u.map((uv, t) => {
      const out = new Float32Array(cfg.dFF);
      const gv = gate[t]!;
      for (let i = 0; i < cfg.dFF; i++) out[i] = uv[i]! * gv[i]!;
      return out;
    });
    const ffOut = linearSeq(hidden, blk.w3, undefined, cfg.dFF, cfg.dModel);
    const xF = addSeq(xA, ffOut, cfg.dModel);

    layers.push({ prev, attnIn, qd, kd, vd, headsQ, headsK, headsV, headWeights, merged, attnOut, xA, ffnIn, z1, gate, hidden, xF });
    prev = xF;
  }

  const finalNormed = rmsNormSeq(prev, w.finalNorm);
  const logits = linearSeq(finalNormed, w.head, undefined, cfg.dModel, cfg.vocabSize);
  return { input, targets, x0, layers, finalNormed, logits };
}

// ═══════════════════════════════════════════════════════════════════
// ③ 一次完整的前向 + 反向
// ═══════════════════════════════════════════════════════════════════

export function computeLossAndGradients(
  ids: number[],
  cfg: LLMConfig,
  w: MicroGPTWeights,
  rope: ReturnType<typeof precomputeRope>,
): { loss: number; grads: Gradients } {
  if (ids.length < 2) throw new Error("训练序列至少需要 2 个 token");
  const f = trainForward(ids, cfg, w, rope);
  const T = f.input.length;
  const grads = zeroGradients(w);
  const headDim = cfg.dModel / cfg.nHeads;
  const scale = 1 / Math.sqrt(headDim);

  // —— 输出头:logits → loss(softmax + 交叉熵)——
  // softmax+CE 的解析梯度:p(y) − one_hot(y_true),见 math.ts。据此无需存中间。
  let loss = 0;
  const gLogits: Mat[] = [];
  for (let t = 0; t < T; t++) {
    const probs = softmax(f.logits[t]!);
    loss += crossEntropy(probs, f.targets[t]!);
    const g = new Float32Array(cfg.vocabSize);
    for (let i = 0; i < cfg.vocabSize; i++) g[i] = probs[i]!;
    g[f.targets[t]!]! -= 1;
    gLogits.push(g);
  }
  loss /= T;

  // —— 最终:finalNorm → head 反传 ——
  const last = f.layers[f.layers.length - 1]!;
  const headBack = linearBack(f.finalNormed, w.head, gLogits, cfg.dModel, cfg.vocabSize);
  grads.head.set(headBack.gW);
  const finalNormBack = rmsNormBack(last.xF, w.finalNorm, headBack.gx);
  grads.finalNorm.set(finalNormBack.gGamma);

  // 现在 gCur = 对"最后一层输出 xF"的梯度。
  let gCur = finalNormBack.gx;

  // —— 逐层反向(从最后一层到第一层)——
  for (let l = cfg.nLayers - 1; l >= 0; l--) {
    const act = f.layers[l]!;
    const blk = w.blocks[l]!;

    // 1) FFN 子层:xF = xA + ffOut
    const ffBack = swigluBack(act.ffnIn, blk.w1, blk.w2, blk.w3, act.z1, act.gate, act.hidden, gCur, cfg.dModel, cfg.dFF);
    grads.blocks[l]!.w1.set(ffBack.gW1);
    grads.blocks[l]!.w2.set(ffBack.gW2);
    grads.blocks[l]!.w3.set(ffBack.gW3);
    const norm2Back = rmsNormBack(act.xA, blk.norm2, ffBack.gx);
    grads.blocks[l]!.norm2.set(norm2Back.gGamma);
    // xA 的梯度 = 直连(残差) + 路过 norm2 的部分。
    const gXA = addSeq(gCur, norm2Back.gx, cfg.dModel);

    // 2) 注意力子层:xA = prev + attnOut
    const woBack = linearBack(act.merged, blk.wo, gXA, cfg.dModel, cfg.dModel);
    grads.blocks[l]!.wo.set(woBack.gW);
    // 拆头 → 每个头反传注意力。
    const gMerged = woBack.gx;
    const gHeads = splitHeads(gMerged, cfg);
    const gqd: Mat[] = f.layers[l]!.headsQ[0]!.map(() => new Float32Array(cfg.dModel));
    const gkd: Mat[] = f.layers[l]!.headsK[0]!.map(() => new Float32Array(cfg.dModel));
    const gvd: Mat[] = f.layers[l]!.headsV[0]!.map(() => new Float32Array(cfg.dModel));
    for (let h = 0; h < cfg.nHeads; h++) {
      const hb = attentionBack(act.headsQ[h]!, act.headsK[h]!, act.headsV[h]!, act.headWeights[h]!, gHeads[h]!, headDim, scale);
      for (let t = 0; t < T; t++) {
        for (let d = 0; d < headDim; d++) {
          gqd[t]![h * headDim + d]! += hb.gq[t]![d]!;
          gkd[t]![h * headDim + d]! += hb.gk[t]![d]!;
          gvd[t]![h * headDim + d]! += hb.gv[t]![d]!;
        }
      }
    }
    // RoPE 反传(旋转还原),再走 Q/K/V 三个线性层。
    for (let pos = 0; pos < T; pos++) unapplyRopeInPlace([gqd[pos]!, gkd[pos]!], pos, rope);
    const qRes = linearBack(act.attnIn, blk.wq, gqd, cfg.dModel, cfg.dModel);
    const kRes = linearBack(act.attnIn, blk.wk, gkd, cfg.dModel, cfg.dModel);
    const vRes = linearBack(act.attnIn, blk.wv, gvd, cfg.dModel, cfg.dModel);
    grads.blocks[l]!.wq.set(qRes.gW);
    grads.blocks[l]!.wk.set(kRes.gW);
    grads.blocks[l]!.wv.set(vRes.gW);

    // 3) 注意力归一化:attnIn = norm(prev); 三路梯度叠加后反传。
    const gAttnIn = addSeq3(qRes.gx, kRes.gx, vRes.gx, cfg.dModel);
    const norm1Back = rmsNormBack(act.prev, blk.norm1, gAttnIn);
    grads.blocks[l]!.norm1.set(norm1Back.gGamma);

    // 块输入梯度 = 残差直连 + norm1 贡献,作为下一循环的 gCur。
    gCur = addSeq(gXA, norm1Back.gx, cfg.dModel);
  }

  // —— 词嵌入:把对 x0 的梯度写回对应 token 行 ——
  for (let t = 0; t < f.input.length; t++) {
    const row = f.input[t]! * cfg.dModel;
    const g = gCur[t]!;
    for (let d = 0; d < cfg.dModel; d++) grads.emb[row + d]! += g[d]!;
  }

  return { loss, grads };
}

function addSeq3(a: Mat[], b: Mat[], c: Mat[], dim: number): Mat[] {
  return a.map((av, i) => {
    const out = new Float32Array(dim);
    const bv = b[i]!;
    const cv = c[i]!;
    for (let d = 0; d < dim; d++) out[d] = av[d]! + bv[d]! + cv[d]!;
    return out;
  });
}

// ═══════════════════════════════════════════════════════════════════
// ④ AdamW 优化器
// ═══════════════════════════════════════════════════════════════════
//
// 拿到梯度后"怎么走路"也是学问。Adam 为每个参数维护两个滑动统计:
//   m —— 一阶动量(梯度的方向);
//   v —— 二阶动量(梯度的量级,自适应步长分母);
// 更新规则(β1=0.9, β2=0.999 为 Adam 原文经验值):
//   m ← β1·m + (1−β1)·g ;  v ← β2·v + (1−β2)·g²
//   ŵ ← w − lr·( m̂/(√v̂+ε) ) − lr·weightDecay·w
// 其中 m̂ = m/(1−β1^t)、v̂ = v/(1−β2^t) 为偏差修正。
// 相比朴素 SGD,Adam 在梯度稀疏、尺度不一时稳健得多,是 GPT 系列默认。
// weightDecay(AdamW 与 Adam 的差异)从梯度中分离,能更有效抑制过拟合。

export interface OptimState {
  m: Float32Array[];
  v: Float32Array[];
  t: number;
  lr: number;
  weightDecay: number;
}

const BETA1 = 0.9;
const BETA2 = 0.999;
const EPS = 1e-8;

/** 按固定顺序收集模型全部可训练参数。 */
export function flattenParams(w: MicroGPTWeights): Float32Array[] {
  const ps: Float32Array[] = [w.emb, w.finalNorm, w.head];
  for (const b of w.blocks) ps.push(b.norm1, b.wq, b.wk, b.wv, b.wo, b.norm2, b.w1, b.w2, b.w3);
  return ps;
}

/** 与 flattenParams 同序的梯度数组。 */
export function flattenGrads(g: Gradients): Float32Array[] {
  const ps: Float32Array[] = [g.emb, g.finalNorm, g.head];
  for (const b of g.blocks) ps.push(b.norm1, b.wq, b.wk, b.wv, b.wo, b.norm2, b.w1, b.w2, b.w3);
  return ps;
}

export function createOptim(lr: number, weightDecay: number, w: MicroGPTWeights): OptimState {
  const ps = flattenParams(w);
  return {
    m: ps.map((p) => new Float32Array(p.length)),
    v: ps.map((p) => new Float32Array(p.length)),
    t: 0,
    lr,
    weightDecay,
  };
}

/** 执行一步 AdamW 更新(可临时覆盖学习率)。 */
export function optimStep(optim: OptimState, w: MicroGPTWeights, g: Gradients, lrOverride?: number): void {
  const ps = flattenParams(w);
  const gs = flattenGrads(g);
  if (ps.length !== optim.m.length || ps.length !== gs.length) {
    throw new Error(`参数(${ps.length})/梯度(${gs.length})/动量(${optim.m.length}) 长度不一致`);
  }
  optim.t += 1;
  const lr = lrOverride ?? optim.lr;
  const inv1 = 1 - Math.pow(BETA1, optim.t);
  const inv2 = 1 - Math.pow(BETA2, optim.t);
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i]!;
    const gr = gs[i]!;
    const m = optim.m[i]!;
    const v = optim.v[i]!;
    for (let j = 0; j < p.length; j++) {
      const gj = gr[j]!;
      m[j] = BETA1 * m[j]! + (1 - BETA1) * gj;
      v[j] = BETA2 * v[j]! + (1 - BETA2) * gj * gj;
      const mHat = m[j]! / inv1;
      const vHat = v[j]! / inv2;
      const step = (lr * mHat) / (Math.sqrt(vHat) + EPS);
      p[j] = p[j]! - step - lr * optim.weightDecay * p[j]!;
    }
  }
}

/** 学习率调度:预热 + 余弦退火。 */
export function scheduleLr(step: number, warmup: number, peak: number, totalSteps: number): number {
  if (step < warmup) return peak * (step / Math.max(1, warmup));
  const progress = (step - warmup) / Math.max(1, totalSteps - warmup);
  return peak * 0.1 * (1 + Math.cos(Math.PI * Math.min(1, progress)));
}

// ═══════════════════════════════════════════════════════════════════
// ⑤ 浏览器内的训练循环
// ═══════════════════════════════════════════════════════════════════

export interface TrainStepResult {
  step: number;
  loss: number;
  lr: number;
}

/**
 * 训练若干步。tokenIds 由调用方用与推断侧相同的分词器编码——
 * 保证"训练看到的世界"和"生成使用时的世界"完全一致。
 *
 * 步骤逻辑:每次从语料里切一个滑动窗口(长度 maxSeqLen−1)训练,
 * 走完一轮自动折回开头。窗口重叠一点,保证任何衔接处都被看过。
 */
export function runTrainingWithTokens(
  tokenIds: number[],
  cfg: LLMConfig,
  w: MicroGPTWeights,
  rope: ReturnType<typeof precomputeRope>,
  optim: OptimState,
  steps: number,
  onStep: (r: TrainStepResult) => void,
): void {
  if (tokenIds.length < 8) throw new Error("训练语料太短(至少要 8 个 token)");
  const win = Math.min(cfg.maxSeqLen - 1, tokenIds.length);
  let start = 0;
  for (let s = 0; s < steps; s++) {
    const seg = tokenIds.slice(start, start + win);
    if (seg.length < 2) break;
    const lr = scheduleLr(s + 1, 5, optim.lr, steps);
    const { loss, grads } = computeLossAndGradients(seg, cfg, w, rope);
    optimStep(optim, w, grads, lr);
    onStep({ step: s + 1, loss, lr });
    // 滑动:前进 win−10,末尾折返(轻微重叠保证连续性)。
    start += win - 10;
    if (start + 10 >= tokenIds.length) start = 0;
  }
}