/**
 * ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
 *  LLM 实验室 · 演示数据
 * ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
 *
 * "模型如何从零学会一件小事"是本工具的核心演示。下面几段迷你语料都
 * 经过精心设计:模式重复、规律明显,小模型的容量正好装得下——
 * 于是你能亲眼看到 loss 下降、生成文本从乱码变成有意义的句子。
 */
import { TRAIN_CONFIG, type LLMConfig } from "./config";
import { TrainableBPETokenizer, CharTokenizer } from "./tokenizer";

/** 中文语料:主语 + "喜欢/讨厌" + 水果。反复出现的配对学生成规律。 */
export const CN_CORPUS = `
我喜欢苹果。
我喜欢香蕉。
我喜欢葡萄。
你喜欢苹果。
你喜欢西瓜。
他喜欢橘子。
他喜欢苹果。
我们喜欢西瓜。
我们喜欢葡萄。
我不喜欢苹果。
我讨厌香蕉。
我不喜欢西瓜。
`.trim();

/** 英文迷你语料:最简单的"主-谓-宾"重复句式。 */
export const EN_CORPUS = `
the cat sat
the cat ran
the dog ran
the dog slept
the bird sang
a cat sleeps
a dog barks
the bird sings
`.trim();

/**
 * 训练模型时用的"主实验语料"。为了让 tiny 模型学得又快又有说服力,
 * 采用"模板填空"结构——你可以在 UI 里自己改它并重新训练。
 */
export const DEMO_CORPUS = CN_CORPUS;

/** 课程里第一次跑训练实验推荐的初始文本。 */
export const DEFAULT_PROMPT = "我喜欢";

/**
 * 一次性把语料装成一个可直接使用的"会话":
 * 分词器 + 模型权重 + RoPE 缓存,外加文本编解码的便利方法。
 */
export interface TextSession {
  cfg: LLMConfig;
  tok: CharTokenizer | TrainableBPETokenizer;
  encode(text: string): number[];
  decode(ids: number[]): string;
}

/** 用字符级分词器封装一个会话(课程默认,够快、够直观)。 */
export function makeCharSession(
  config: LLMConfig = TRAIN_CONFIG,
  corpus: string = DEMO_CORPUS,
): TextSession {
  const tok = new CharTokenizer(corpus);
  return {
    cfg: config,
    tok,
    encode: (t) => tok.encode(t),
    decode: (ids) => tok.decode(ids),
  };
}

/** 用 BPE 分词器封装一个会话(作为对比实验。目标词表可调)。 */
export function makeBpeSession(
  config: LLMConfig = TRAIN_CONFIG,
  corpus: string = DEMO_CORPUS,
  bpeVocab = 96,
): TextSession {
  const tok = new TrainableBPETokenizer(corpus, bpeVocab);
  return {
    cfg: config,
    tok,
    encode: (t) => tok.encode(t),
    decode: (ids) => tok.decode(ids),
  };
}