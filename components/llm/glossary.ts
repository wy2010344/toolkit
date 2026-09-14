/**
 * 术语表数据。
 *
 * 原则:先给一句"日常类比"让人有直觉抓得住,再给"一句话定义"
 * 把它钉在准确的技术位置上。宁可类比不完美,不要让读者绕着术语猜。
 */

export interface TermDef {
  term: string;
  en: string;
  analogy: string;
  def: string;
}

export interface TermGroup {
  group: string;
  note: string;
  terms: TermDef[];
}

export const GLOSSARY: TermGroup[] = [
  {
    group: "输入与表示",
    note: "把「人话」变成模型能算的东西。这一组回答:句子是怎么变成数字的。",
    terms: [
      {
        term: "token",
        en: "token",
        analogy: "把一句话切成一格一格的积木块,每个块一个编号。",
        def: "模型处理文本的基本单元,可以是一个字、一个子词或一个词。",
      },
      {
        term: "词表",
        en: "vocabulary",
        analogy: "模型会认的「全部生字」,相当于机器的识字量。",
        def: "所有 token 的集合,词表大小 = 模型能表示的不同 token 总数。",
      },
      {
        term: "BPE",
        en: "byte-pair encoding",
        analogy: "先把常一起出现的字捆成「词组」,再教机器连词一起认。",
        def: "字节对编码:反复合并语料中出现次数最多的相邻字符对,生成子词词表。",
      },
      {
        term: "嵌入",
        en: "embedding",
        analogy: "给每个 token 换一张数字纸条,纸条内容靠训练调,意思相近的词纸条也相近。",
        def: "把离散 token 映射成连续向量(查表),是离散符号第一次变成可计算的数。",
      },
      {
        term: "向量 / 维度",
        en: "vector / dModel",
        analogy: "一串数字就是「一个词的脑细胞活动记录」,脑细胞数 = 维度。",
        def: "dModel 维浮点数组.向量可加减、可求相似度;dModel 是模型的宽度超参。",
      },
    ],
  },
  {
    group: "位置",
    note: "模型默认以为每个字都一样,这一组回答:怎么让机器分清先后。",
    terms: [
      {
        term: "位置编码",
        en: "position encoding",
        analogy: "在每个字的脑门贴上「我是第几个」的标签。",
        def: "把先后位置的信息混进向量(或 Q/K)的技术,让模型感知语序。",
      },
      {
        term: "RoPE",
        en: "rotary position embedding",
        analogy: "给 Q/K 拧一个「旋转角」,位置差越大,两个向量转到越不同的方向。",
        def: "旋转位置编码:用旋转矩阵把位置编进 Q/K,位置差会自然反映到注意力打分里。",
      },
    ],
  },
  {
    group: "注意力",
    note: "这一组回答:每个词怎么「看见」整句话并决定自己是什么意思。",
    terms: [
      {
        term: "注意力",
        en: "attention",
        analogy: "阅读理解时眼睛扫全文,跟当前词越相关的词,越要认真看。",
        def: "用相似度对序列各位置加权求和,让每个位置携带的上下文都被调入当前输出。",
      },
      {
        term: "Q / K / V",
        en: "query / key / value",
        analogy: "查字典:Q 是想查的字,K 是字典索引,V 是索引对应的解释页。",
        def: "三个线性投影。Q 代表「我在找什么」,K 代表「被我相关的线索」,V 是实际要取的内容。",
      },
      {
        term: "点积",
        en: "dot product",
        analogy: "两个向量「对暗号」,越像数字越大。",
        def: "逐位相乘再求和,衡量两个向量相似程度的廉价方式。",
      },
      {
        term: "缩放",
        en: "scaling",
        analogy: "数字太大就先除以一个常数,免得 softmax 一上来就「饱和摆烂」。",
        def: "点积分除以 √head_dim,把分数压回温和区间,防止梯度消失。",
      },
      {
        term: "因果掩码",
        en: "causal mask",
        analogy: "考试卷后半截糊住,现在的字不许偷看还没写的答案。",
        def: "把未来位置的打分设为 -∞,softmax 后权重归零;保证生成时只依据过去。",
      },
      {
        term: "多头",
        en: "multi-head",
        analogy: "几双眼睛同时看:一双盯主谓,一双盯动宾,各看各的再合议。",
        def: "把向量切成 nHeads 份并行做注意力,再拼回,让多种关系分频道并存。",
      },
    ],
  },
  {
    group: "深度结构",
    note: "这一组回答:层叠多了为什么不塌,以及每个词凭什么「想得深」。",
    terms: [
      {
        term: "归一化",
        en: "normalization",
        analogy: "每次量体重前先校正秤,让每层进来的数字都回到标准尺度。",
        def: "把每层输入按统计量缩放到稳定区间,防数值变大或消失。",
      },
      {
        term: "RMSNorm",
        en: "root mean square norm",
        analogy: "只用「均方根」校正,不校正中心,快一点、效果也很好(LLaMA 用这个)。",
        def: "对每个向量除以 RMS 再做缩放,省略减均值的一步归一化。",
      },
      {
        term: "残差连接",
        en: "residual connection",
        analogy: "外卖直达:每层算完,把「原始那份」也原封送出去,中途哪层出错也不耽误送达。",
        def: "输出 = 原始输入 + 子层输出,给梯度和信息一条短路通道,深网络才训练得动。",
      },
      {
        term: "前馈网络 FFN",
        en: "feed-forward network",
        analogy: "注意力是群聊,FFN 是聊完后每个人单独再想一遍。",
        def: "逐位置的「扩张—激活—压缩」两层线性网,提供非线性表达力。",
      },
      {
        term: "SwiGLU",
        en: "swish-gated linear unit",
        analogy: "水龙头:一路管进水,一路管放多少,两路乘起来再出去。",
        def: "两个分支(候选内容 × 门控)逐元素相乘后再投影,当代模型的主流 FFN 激活。",
      },
    ],
  },
  {
    group: "输出与生成",
    note: "这一组回答:模型怎么把「下一个词」从一种感觉变成一句话。",
    terms: [
      {
        term: "logits",
        en: "logits",
        analogy: "考试各选项的原始得分,分高高的代表更有把握。",
        def: "输出头给出的未归一化分数,可正可负可任意大。",
      },
      {
        term: "softmax",
        en: "softmax",
        analogy: "把一张张「原始得分」按比例摊成一个 100% 的饼。",
        def: "把 logits 变成非负且和为 1 的概率分布,得分高的份额大。",
      },
      {
        term: "概率分布",
        en: "probability distribution",
        analogy: "全词表对「下一个是谁」的投票结果,每个人的票和是 100%。",
        def: "每个候选 token 一个概率,刻画模型对下一个词的把握。",
      },
      {
        term: "熵",
        en: "entropy",
        analogy: "投票越分散(谁都有可能),熵越高——说明机器很没把握。",
        def: "分布混乱程度的度量:0 = 完全确定,越高越平均、越没把握。",
      },
      {
        term: "采样",
        en: "sampling",
        analogy: "按中奖概率开奖:票越多越容易中,但其他票也可能中。",
        def: "按概率分布随机选一个词,是生成随机性的来源。",
      },
      {
        term: "温度",
        en: "temperature",
        analogy: "空调旋钮:开大更「放飞」,开小更「保守」,冷热都行。",
        def: "生成前把 logits 除以 T 再 softmax,控制分布的尖锐度(多样性)。",
      },
      {
        term: "Top-k",
        en: "top-k sampling",
        analogy: "先锁到夺冠热门前 k 名,再在这几人里抽签下注。",
        def: "只保留概率最高的 k 个候选并重新归一化再采样,兼顾多样与稳妥。",
      },
      {
        term: "自回归",
        en: "autoregressive",
        analogy: "织毛衣:一针一针往前织,每针都要看已经织好的那一截。",
        def: "每次只预测下一个 token,再把它拼回去继续预测,一句句长出来。",
      },
    ],
  },
  {
    group: "训练",
    note: "这一组回答:上面这些参数凭什么会「变聪明」。",
    terms: [
      {
        term: "参数",
        en: "parameters",
        analogy: "机器身上拧来拧去的「旋钮」,每个旋钮都能写成数字。",
        def: "可学习权重(嵌入、矩阵、偏置),它们决定模型的输出。",
      },
      {
        term: "损失",
        en: "loss",
        analogy: "考试错了几题,错得越多分越低。",
        def: "预测与标准答案差距的数值,训练的目标就是把它压小。",
      },
      {
        term: "交叉熵",
        en: "cross-entropy",
        analogy: "只给「正确答案」那一个位置打分:它在概率里排第几、占了多少。",
        def: "对正确答案位置的概率取负对数,正确概率越高损失越小。",
      },
      {
        term: "梯度",
        en: "gradient",
        analogy: "下山时脚下的「哪边更陡」,照着陡的方向走最快到谷底。",
        def: "损失对每个参数的偏导,指示每个旋钮该往哪个方向拧。",
      },
      {
        term: "反向传播",
        en: "backpropagation",
        analogy: "从卷子最后一题的错,一路倒推回每一题该扣多少分。",
        def: "利用链式法则从输出向输入逐层计算梯度,让每一层都拿到修正信号。",
      },
      {
        term: "学习率",
        en: "learning rate",
        analogy: "每次修正迈的步子幅度,太大容易踩过头,太小走不动。",
        def: "参数每次更新的步长,控制下山的节奏。",
      },
      {
        term: "AdamW",
        en: "adam with weight decay",
        analogy: "带「动量 + 自动挑步长 + 定期减重」的升级版下山法。",
        def: "现代主流优化器:动量平滑方向、自适应步长,并带权重衰减防过拟合。",
      },
    ],
  },
];