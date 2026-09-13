/**
 * ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
 *  LLM 实验室 · 数学工具箱
 * ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
 *
 * 整个 LLM 说穿了只有三个基本运算:
 *   1. 矩阵乘法(linear)   —— 神经网络的最底层"做决策"动作
 *   2. softmax            —— 把分数变成"概率分布"(加和为 1)
 *   3. 逐元素运算         —— 加、乘、归一化之类
 *
 * 这个文件把所有数值运算都明明白白写出来,刻意不用任何第三方张量库,
 * 目的是让你看清每一步到底在算什么。真实世界中这些都被 GPU 上的
 * cuBLAS / FlashAttention 碾成了并行指令,但思路完全一致。
 *
 * 命名约定:xs / w / b 一律使用 Float32Array(位宽 32 的浮点数,
 * 和大多数现代深度学习框架的默认精度相同,浏览器中占内存也小)。
 */

/** 二维矩阵,用一维数组平铺(row-major 行优先,即第 [i][j] 个元素在 i*cols+j)。 */
export type Mat = Float32Array;

/**
 * 矩阵乘法:output[i][j] = Σ_k input[i][k] * w[k][j] + bias[j]。
 *
 * 这是全连接层(linear / dense)的计算。每一个输出神经元 j 都等于
 * "输入向量"与"权重矩阵第 j 列"做点积:
 *
 *   output[j] = in·W[:,j] + b[j]
 *
 * 直觉:权重 W 的第 j 列可以理解为一组"模板",输入向量与哪个模板越相似
 * (点积越大),输出就越强烈。神经网络"记住"的东西,全部体现在这些权重的
 * 取值里。
 *
 * @param input  输入向量(inDim)
 * @param w      权重矩阵,行=inDim,列=outDim
 * @param b      偏置(outDim),可省略
 * @returns      输出向量(outDim)
 */
export function linearVector(
  input: Mat,
  w: Mat,
  b?: Mat,
  inDim = input.length,
  outDim = w.length / inDim,
): Mat {
  const out = new Float32Array(outDim);
  for (let j = 0; j < outDim; j++) {
    let sum = 0;
    for (let k = 0; k < inDim; k++) sum += input[k] * w[k * outDim + j];
    if (b) sum += b[j];
    out[j] = sum;
  }
  return out;
}

/**
 * 批量矩阵乘法:out[T][O] = xs[T][I] @ w[I][O] + b[O]。
 * 就是把上面的单向量版本对序列里的每个位置做一遍。T 是序列长度
 * (token 数量),I 是输入维度,O 是输出维度。
 */
export function linearSeq(
  xs: Mat[],
  w: Mat,
  b?: Mat,
  inDim = xs[0]?.length ?? 0,
  outDim = w.length / inDim,
): Mat[] {
  return xs.map((x) => linearVector(x, w, b, inDim, outDim));
}

/**
 * 按行做 softmax:把一行任意实数分数,变成一列非负且总和为 1 的概率。
 *
 *   softmax(x)[i] = e^{x[i]} / Σ_j e^{x[j]}
 *
 * 两个实现细节值得记住:
 *   - 先减去该行最大值,防止 e^{x} 溢出成 Infinity(数值稳定性技巧)。
 *   - 指数"放大差距":分数差 1 倍,概率会被拉开 e≈2.72 倍。这就是为什么
 *     注意力"谁跟谁像"最终会变成近乎 one-hot 的选择。
 */
export function softmax(xs: Mat): Mat {
  const out = new Float32Array(xs.length);
  let max = -Infinity;
  for (let i = 0; i < xs.length; i++) if (xs[i] > max) max = xs[i];
  let sum = 0;
  for (let i = 0; i < xs.length; i++) {
    out[i] = Math.exp(xs[i] - max);
    sum += out[i];
  }
  for (let i = 0; i < xs.length; i++) out[i] /= sum;
  return out;
}

/**
 * 批量 softmax:对每行分别做 softmax,返回二维(平铺成一个数组)。
 */
export function softmaxSeq(rows: Mat[]): Mat[] {
  return rows.map(softmax);
}

/**
 * 采样:给定一个概率分布,按概率随机抽取一个下标。
 * 这就是"生成文本"时每步做的随机选择——概率高的 token 更常被选中,
 * 但偶尔也会选到意料之外的词(这正是 LLM 输出有"创造性"的来源)。
 */
export function sample(probs: Mat): number {
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < probs.length; i++) {
    acc += probs[i];
    if (r < acc) return i;
  }
  return probs.length - 1;
}

/**
 * 在分布上乘温度 temperature 后再 softmax。温度 > 1 使分布更"平"(随机性
 * 变强),温度 < 1 使分布更"尖"(更倾向高分 token)。temperature→0 时退化为
 * 贪心:永远选概率最大的。
 */
export function temperatureSoftmax(logits: Mat, temperature: number): Mat {
  if (temperature <= 0) {
    let best = 0;
    for (let i = 1; i < logits.length; i++) if (logits[i] > logits[best]) best = i;
    const out = new Float32Array(logits.length);
    out[best] = 1;
    return out;
  }
  return softmax(logits.map((x) => x / temperature));
}

/**
 * 交叉熵损失(逐位置):衡量"模型预测分布 p"和"真实答案 one‑hot y"的差距。
 *
 *   loss = -log p[y_true]
 *
 * 直觉:模型给正确答案的概率越接近 1,loss 越接近 0;越离谱(给正确
 * 答案的概率接近 0),log 越接近 -∞,loss 越大。训练就是不断把 loss 压小。
 *
 * @param probs 模型输出的概率分布
 * @param target 正确答案的 token id
 */
export function crossEntropy(probs: Mat, target: number): number {
  const p = probs[target];
  return -Math.log(Math.max(p, 1e-12));
}

/**
 * softmax + 交叉熵梯度的"合体"版。
 *
 * 真正的优化过程只差最后一步:怎么调整权重让 loss 变小。答案是用链式法则
 * 求出"loss 对每个权重"的偏导数(梯度),再朝负梯度方向迈一小步。这里给出
 * 对输入向量的梯度(对权重的梯度在 training.ts 里推)。softmax+CE 恰好有
 * 一个漂亮的解析梯度:
 *
 *   dL / dx = p - one_hot(target)
 *
 * 意思是:当模型高估了正确答案(p[target] 太大)时梯度为正,要让输入往
 * 回拉;低估时梯度为负,要让输入往正确答案方向推。
 */
export function softmaxCrossEntropyGrad(probs: Mat, target: number): Mat {
  const grad = new Float32Array(probs.length);
  for (let i = 0; i < probs.length; i++) grad[i] = probs[i];
  grad[target] -= 1;
  return grad;
}

/**
 * 判断两个向量是否数值上"几乎相等",用于课程的断言/自检。
 */
export function approxEqual(a: Mat, b: Mat, eps = 1e-4): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > eps) return false;
  return true;
}