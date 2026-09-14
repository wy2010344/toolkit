/**
 * 架构总览 · 节点元数据。
 * 每个节点对应:一张展开卡片(是什么 / 为什么 / 公式 / 代码位置 / 对应课程)
 * 以及一个木人全部"已接通电源"的实时小实验(见 ArchitectureDemos)。
 * id 与 1~8 课程一一对应,"跳到第 X 课"就能逐个击破。
 */

export type ArchTone = "blue" | "yellow" | "green" | "gray";

export interface ArchNodeMeta {
  id: string;
  /** 编号,与课程号一致。 */
  n: number;
  title: string;
  en: string;
  tone: ArchTone;
  /** 一句话职责。 */
  role: string;
  /** 展开后的背景说明(中文,口语化)。 */
  blurb: string;
  /** 核心公式(纯文本)。 */
  formula: string;
  /** 代码入口:lib/llm 里的文件与函数。 */
  codeRef: { file: string; fn: string };
  /** 对应课程的"学到手"链接。 */
  lesson: number;
  /** 展开后展示的观察要点。 */
  points: string[];
}

export const ARCH_NODES: ArchNodeMeta[] = [
  {
    id: "tokenizer",
    n: 1,
    title: "分词 Tokenizer",
    en: "tokenize",
    tone: "blue",
    role: "把文本切成模型认识的 token",
    blurb:
      "模型不认识汉字,只认识一个整数表。分词就是把「我喜欢苹果」切成一个个 token(字符或 BPE 子词),每个 token 固定一个 id,交给后面的嵌入层。词表越大,识字量越大,但嵌入表也越大。",
    formula: "chars / BPE subwords  →  vocab ids",
    codeRef: { file: "lib/llm/tokenizer.ts", fn: "CharTokenizer / TrainableBPETokenizer" },
    lesson: 1,
    points: [
      "字符级:每个汉字一个 token,词表小、规则朴素;",
      "BPE:从字节对频次合并出子词,能压缩常见词,词表更「聪明」;",
      "对中文,字符分词已够用;对英文,BPE 能跨词复用子词。",
    ],
  },
  {
    id: "embedding",
    n: 2,
    title: "嵌入 Embedding",
    en: "lookup table",
    tone: "blue",
    role: "把 token id 换成连续向量",
    blurb:
      "这是模型唯一的「查表」:第 id 行就是一个 dModel 维向量,把「苹果」从离散符号变成可加减、可内积的数值。语义相近的 token,它们的向量在空间里靠得近。",
    formula: "x_t = Emb[ id_t ]   ∈ ℝ^dModel",
    codeRef: { file: "lib/llm/embeddings.ts", fn: "embedToken" },
    lesson: 2,
    points: [
      "离散 id → 连续向量,深度学习的一切从这里开始;",
      "嵌入行本身是可学习参数,靠训练调整位置关系;",
      "下面的每一层都在「重写」这些向量,层数越深越抽象。",
    ],
  },
  {
    id: "rope",
    n: 3,
    title: "旋转位置编码 RoPE",
    en: "rotary position",
    tone: "yellow",
    role: "给 Q/K 打上「位置」标记",
    blurb:
      "注意力本身分不清先后:自注意力公式里完全没有「第几个」这个概念。RoPE 把位置信息以旋转矩阵的方式旋进 Q 和 K,让「相近位置内积大、远位置内积小」,模型才能感知语序——「猫咬狗」和「狗咬猫」不是一回事。",
    formula: "q←R(θ·p)·q,  k←R(θ·p)·k        ⟨q_p,k_j⟩≈(p−j) 的函数",
    codeRef: { file: "lib/llm/embeddings.ts", fn: "applyRopeInPlace" },
    lesson: 3,
    points: [
      "在注意力打分前给 Q/K 旋转,位置差越大,打分越被惩罚;",
      "试试把位置旁路关掉:热力图里「位置感」会立刻表情;",
      "RoPE 是 LLaMA / Qwen 等主流模型的标准选择。",
    ],
  },
  {
    id: "attention",
    n: 4,
    title: "多头注意力 Multi-Head Attention",
    en: "self-attention",
    tone: "yellow",
    role: "token 之间互相交流、聚合上下文",
    blurb:
      "每个 token 拿着自己的 Q 去匹配所有 token 的 K,算出相似度,softmax 成权重,再按权重加权求和所有 token 的 V——于是每个位置都「听到了」整句话,这就是上下文。(因果)掩码保证它只能听过去,听不到未来。多头 = 同时从几个角度观察。",
    formula: "softmax( QKᵀ / √head_dim + mask ) · V",
    codeRef: { file: "lib/llm/attention.ts", fn: "multiHeadAttention" },
    lesson: 4,
    points: [
      "q·k 点积衡量两个 token 的相关程度;",
      "除以 √head_dim 缩放,防止 scores 饱和、梯度消失;",
      "因果掩码把右上三角(未来)填成 -∞,softmax 后归零。",
    ],
  },
  {
    id: "block",
    n: 5,
    title: "残差 + 归一化 Residual & Norm",
    en: "skip + normalize",
    tone: "gray",
    role: "让每层量的量级稳定、深度堆得动",
    blurb:
      "深层网络两大杀手:量级爆炸和梯度失效。归一化把每层输入「拉回标准量级」(RMSNorm 只除均方根,LayerNorm 还做居中);残差连接让原始信号总能绕道直通后层。合起来,才允许你把 2 层叠成 20 层甚至 100 层。",
    formula: "x ← x + Sublayer( Norm(x) )            (Pre-Norm)",
    codeRef: { file: "lib/llm/transformer.ts", fn: "runBlock" },
    lesson: 5,
    points: [
      "看看把归一化旁路掉:层间量级(下方条形)会一路疯长;",
      "LayerNorm 先居中再归一,RMSNorm 只归一(更省算力);",
      "预归一 Pre-Norm 是让深网络训练得动的最关键结构。",
    ],
  },
  {
    id: "ffn",
    n: 6,
    title: "前馈 FFN + 激活",
    en: "feed-forward",
    tone: "green",
    role: "每个 token 自己「想清楚」",
    blurb:
      "注意力是横向的群聊,FFN 是纵向的个人思考:把每个 token 的向量扩张到 dFF 维、过一遍非线性激活、再压缩回来。现代模型用 SwiGLU——多一个「门控」分支,决定哪些信息放行,比 ReLU 的硬截断更平滑、效果更好。",
    formula: "SwiGLU: Swish(xW₂)·(xW₁)·W₃      ReLU/GELU: act(xW₁)·W₃",
    codeRef: { file: "lib/llm/feedforward.ts", fn: "swigluSeq / gelu / relu" },
    lesson: 6,
    points: [
      "非线性激活是 FFN 的「思考」来源:没有它,多层就退化成一层;",
      "SwiGLU 比 ReLU 多一路门控(参数略多,效果更好);",
      "下面这张曲线是三种激活的对比,拖动鼠标看走势。",
    ],
  },
  {
    id: "head",
    n: 7,
    title: "输出头 + Softmax",
    en: "classifier",
    tone: "blue",
    role: "把隐向量变成「下一个词的概率」",
    blurb:
      "最后一步:把最后一个位置的隐向量投影成 vocabSize 个分数(logits),softmax 变成和为 1 的概率分布——这就是模型对「下一个词是谁」的全部认知。分布越尖,模型越自信;越平,越没谱。",
    formula: "p = softmax( x_final · W_head )",
    codeRef: { file: "lib/llm/model.ts", fn: "forward → linearSeq + softmax" },
    lesson: 7,
    points: [
      "打分(分数)可以任意大小,概率必须和为 1 且非负,靠 softmax 兼;",
      "熵接近 0 说明下一个词几乎被锁死,接近 1 说明完全没把握;",
      "这是推理的最后一步,也是训练中算损失(cross-entropy)的入口。",
    ],
  },
  {
    id: "sampler",
    n: 8,
    title: "采样 Sampler",
    en: "decode",
    tone: "green",
    role: "从概率分布里挑「下一个词」",
    blurb:
      "模型只给概率,说话的是采样器:贪心永远挑最可能的那一个(确定但容易复读);温度让分布变平(多样)或变尖(保守);Top-k 只在最可能的 k 个里重归一化再抽。三者组合,决定一个模型的「性格」。",
    formula: "temp: pᵢ ∝ exp(scoreᵢ/T)    topk: 只在 top-k 里重归一化",
    codeRef: { file: "lib/llm/math.ts", fn: "sample / temperatureSoftmax" },
    lesson: 8,
    points: [
      "贪心 = 保底稳妥;温度低更准,温度高更有想象力;",
      "Top-k 防止极端冷门词抢戏,又保留随机性;",
      "左上工具栏随时切换采样方式,重跑对比句子风格。",
    ],
  },
];

export const TONE_BADGE: Record<ArchTone, string> = {
  blue: "bg-acc-blue-fg/12 text-acc-blue-fg",
  yellow: "bg-acc-yellow-fg/12 text-acc-yellow-fg",
  green: "bg-acc-green-fg/12 text-acc-green-fg",
  gray: "bg-surface-mute text-muted",
};