/**
 * ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
 *  LLM 实验室 · 模型配置与类型定义
 * ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
 *
 * 本文件定义「一个微型 LLM 长得什么样」。现代 LLM(如 GPT、LLaMA、Qwen)
 * 都是"解码器"(decoder-only)架构:输入一串 token,逐个预测下一个 token。
 * 我们在这里用最少的配置项把模型的"骨架"描述清楚,后面的每个模块
 * 都会依赖这两个类型。
 */

/**
 * 超参数配置。
 *
 * 机器翻译成"人话"后的几行参数,就是决定一个模型体积/能力的旋钮:
 *
 *  | 参数        | 含义                                   | 类比         |
 *  |-------------|----------------------------------------|--------------|
 *  | vocabSize   | 模型认识的"词表"大小(token 的种类数)  | 识字量       |
 *  | dModel      | 每个 token 被编码成多少维向量          | 每个词多少脑细胞 |
 *  | nHeads      | 注意力被拆成几个头,并行看几组关系      | 几双眼睛     |
 *  | nLayers     | 把"注意力+前馈网"叠几层                | 思考几轮     |
 *  | maxSeqLen   | 最多能看多长的上文                     | 上下文窗口   |
 *
 * 注意:我们刻意把配置做得很小(见 defaultMicroConfig),是因为在浏览器里
 * 要能几十毫秒内完成一次前向计算。真实 LLM 的 vocabSize 常在 10w 量级、
 * dModel 在 4k~16k,L是 32~100,而这里最小的例子只有几百个可训练参数——
 * 但**原理完全一致**,这就是"微型"的意义:麻雀虽小,五脏俱全。
 */
export interface LLMConfig {
  /** 词表大小:模型一共认识几种 token。 */
  vocabSize: number;
  /** 模型宽度:每个 token 用一个 dModel 维向量表示(embedding 维度)。 */
  dModel: number;
  /** 注意力头数:自注意力"拆成多份各看各的"的数量。 */
  nHeads: number;
  /** 层数:transformer 块叠多少层。 */
  nLayers: number;
  /** 上下文长度:单次最多处理的 token 数(决定 RoPE / 因果掩码矩阵尺寸)。 */
  maxSeqLen: number;
  /** 前馈网内部隐藏层维度(通常为 2~4 × dModel)。 */
  dFF: number;
}

/** 最小可用配置:适合在本工具里逐层观察计算过程。 */
export const MICRO_CONFIG: LLMConfig = {
  vocabSize: 64,
  dModel: 16,
  nHeads: 2,
  nLayers: 2,
  maxSeqLen: 32,
  dFF: 32,
};

/**
 * 训练用的"班级规模":想要模型真学会一点语法,稍大一些才够。
 * 参数量估算 ≈ dModel² × (约 12 × nLayers) ≈ 关于 1.8 万,仍是"微型"。
 */
export const TRAIN_CONFIG: LLMConfig = {
  vocabSize: 96,
  dModel: 32,
  nHeads: 4,
  nLayers: 2,
  maxSeqLen: 48,
  dFF: 64,
};

/** copyTokenConfig:k 的 dModel 必须能被 nHeads 整除,否则没法均分到每个头。 */
export function assertConfig(c: LLMConfig): void {
  if (c.dModel % c.nHeads !== 0) {
    throw new Error(`dModel(${c.dModel}) 必须能被 nHeads(${c.nHeads}) 整除`);
  }
}

/**
 * 推理结果:模型眼中"下一个 token 是谁"。
 */
export interface GenResult {
  /** 采样出的新 token id。 */
  tokenId: number;
  /** 该 token 对应的文本。 */
  tokenText: string;
  /** 每个候选 token 的概率分布(softmax 后),可用于可视化。 */
  probs: Float32Array;
  /** logits:softmax 之前的原始分数(越大说明越有把握)。 */
  logits: Float32Array;
  /** 本次生成是否被 maxTokens 截断(用于 UI 提示)。 */
  truncated: boolean;
}

/** 训练过程中的一次观测点,供 UI 画 loss 曲线。 */
export interface TrainStepInfo {
  step: number;
  loss: number;
  lr: number;
}