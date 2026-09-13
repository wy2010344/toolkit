/**
 * ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
 *  LLM 实验室 · 分词器(Tokenizer)
 * ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
 *
 * 模型不认识文字,只认识"整数"。分词器就是文本 ⇄ token id 之间的翻译官:
 *
 *   "猫" → [ 1 ] → 模型 → [ 3 ] → "鱼"
 *
 * 现代 LLM(如 GPT-4、Qwen、DeepSeek)使用的都是 BPE(Byte Pair Encoding,
 * 字节对编码)。这里给你两种实现,从易到难:
 *
 *   1. 字符级(CharTokenizer) —— 每个"字"一个 id,直观,但在英文上
 *      效率低,也难以传达到"子词"概念。
 *   2. BPE(TrainableBPETokenizer) —— 从语料里自动统计出"常见子词",
 *      这正是 GPT 原论文提出的路线,今天所有主流模型仍在沿用。
 *
 * 需要牢记心法:BPE 的核心思想是"反复合并语料里出现频率最高的相邻对,
 * 把最小的字符逐渐拼成常用的词"。合并规则只要存下来,就能离开语料
 * 独立编码/解码(真实世界的 tiktoken 就是这么做的)。
 */

/** token 文本 → id 的映射。 */
interface VocabMap {
  [token: string]: number;
}

/** ---- 1. 字符级分词器 ------------------------------------------------ */
export class CharTokenizer {
  /** 词表:id → 字符 */
  readonly itos: string[];
  /** 反向映射:字符 → id */
  readonly stoi: VocabMap;

  /** 训练:统计语料出现的所有字符,分配 id。可额外加特殊 token。 */
  constructor(corpus: string, special: string[] = []) {
    const chars = Array.from(new Set([...(corpus + special.join(""))]));
    this.stoi = {};
    chars.forEach((c, i) => {
      this.stoi[c] = i;
    });
    this.itos = chars;
  }

  get vocabSize(): number {
    return this.itos.length;
  }

  /** 文本 → id。每个字符一个 id。 */
  encode(text: string): number[] {
    return Array.from(text).map((c) => this.stoi[c] ?? 0);
  }

  /** id → 文本。 */
  decode(ids: number[]): string {
    return ids.map((id) => this.itos[id] ?? "").join("");
  }
}

// ---- BPE 的"合并规则"表 ----------------------------------------------
interface MergeRule {
  /** 规则先后顺序(先学到的 rank 小,编码时优先尝试)。 */
  rank: number;
  /** 构成这个新 token 的两个旧 token id。 */
  a: number;
  b: number;
  /** 合并出来的新 token id。 */
  c: number;
}

/** ---- 2. BPE 分词器(可训练) ------------------------------------------ */
export class TrainableBPETokenizer {
  /** id → 文本 */
  readonly itos: string[];
  /** 文本 → id */
  readonly stoi: VocabMap;
  /** 学习到的合并规则表。 */
  readonly merges: MergeRule[];
  /** 供算法课快速使用的规则查询表:key = `a,b` → MergeRule。 */
  private ruleByPair = new Map<string, MergeRule>();

  constructor(corpus: string, targetVocab: number, addSpecial: string[] = []) {
    // 初始词表:所有单字符(+ 可选特殊 token)。
    const init = Array.from(new Set([...(corpus + addSpecial.join(""))]));
    if (targetVocab < init.length) {
      throw new Error(`目标词表(${targetVocab})不能小于基础字符数(${init.length})`);
    }

    this.stoi = {};
    init.forEach((t, i) => {
      this.stoi[t] = i;
    });
    this.itos = [...init];

    // ---- 训练:反复合并最频繁的相邻对 ----------------------------------
    // 语料转成 id 流,后面每一步都原地更新。
    let ids = Array.from(corpus).map((c) => this.stoi[c]!);
    // 相邻对 → 出现次数。
    const counts = new Map<string, number>();
    const bump = (a: number, b: number) => {
      const key = `${a},${b}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    };
    for (let i = 0; i < ids.length - 1; i++) bump(ids[i]!, ids[i + 1]!);

    this.merges = [];
    while (this.stoi.size < targetVocab && counts.size > 0) {
      // 找出现次数最多的一对。
      let bestKey = "";
      let bestCount = -1;
      for (const [key, cnt] of counts) {
        if (cnt > bestCount) {
          bestCount = cnt;
          bestKey = key;
        }
      }
      if (bestCount <= 0) break;
      const [a, b] = bestKey.split(",").map(Number) as [number, number];
      const newToken = this.itos[a]! + this.itos[b]!;
      const c = this.stoi.size;
      this.stoi[newToken] = c;
      this.itos.push(newToken);

      const rule: MergeRule = { rank: this.merges.length, a, b, c };
      this.merges.push(rule);
      this.ruleByPair.set(bestKey, rule);

      // 把语料中相邻的 a,b 本当、一次性替换成 c,并重建计数。
      // 注意可能重叠,例如 [a,a,b] 中的 "a,a" 与 "a,b" 需依次处理。
      const next: number[] = [];
      let i = 0;
      while (i < ids.length) {
        if (i < ids.length - 1 && ids[i] === a && ids[i + 1] === b) {
          next.push(c);
          i += 2;
        } else {
          next.push(ids[i]!);
          i += 1;
        }
      }
      counts.clear();
      for (let k = 0; k < next.length - 1; k++) bump(next[k]!, next[k + 1]!);
      ids = next;
    }
  }

  get vocabSize(): number {
    return this.itos.length;
  }

  /**
   * 编码:把文本拆成 token 序列。
   *
   * 对"未知字符"统一退回 bytes 处理(这里用 TextEncoder 直接取 UTF-8 字节,
   * 再用特殊前缀拼进词表里对应的 id——因为我们的教学词汇表规模极小,
   * 这一步仅用来保证任意输入都能编码,不追求和真实 tiktoken 完全一致)。
   */
  encode(text: string): number[] {
    const chars: number[] = [];
    const encoder = new TextEncoder();
    for (const ch of Array.from(text)) {
      const id = this.stoi[ch];
      if (id === undefined) chars.push(...Array.from(encoder.encode(ch)));
      else chars.push(id);
    }

    // 贪心 BPE 编码:反复寻找"学过的 merge 规则里 rank 最小且存在"的一对。
    while (chars.length > 1) {
      let best: { i: number; rule: MergeRule } | null = null;
      for (let i = 0; i < chars.length - 1; i++) {
        const rule = this.ruleByPair.get(`${chars[i]},${chars[i + 1]}`);
        if (rule && (best === null || rule.rank < best.rule.rank)) {
          best = { i, rule };
        }
      }
      if (!best) break;
      chars.splice(best.i, 2, best.rule.c);
    }
    return chars;
  }

  /** 解码:id → 文本(展开 bytes 段)。 */
  decode(ids: number[]): string {
    return ids
      .map((id) => {
        const t = this.itos[id];
        if (t !== undefined) return t;
        // 未知 id(由 bytes 产生的特殊段)回退成空串。
        return "";
      })
      .join("");
  }
}

/** 便捷工厂:同时训练字符级与 BPE 两种分词器,便于课程对比。 */
export function trainTokenizer(corpus: string, bpeVocab = 64): { char: CharTokenizer; bpe: TrainableBPETokenizer } {
  return {
    char: new CharTokenizer(corpus),
    bpe: new TrainableBPETokenizer(corpus, bpeVocab),
  };
}

/** 把文本切好并标注每个 token,供课程 UI 展示。 */
export function tokenizePreview(
  text: string,
  tok: { itos: string[] } & { encode(t: string): number[] },
): Array<{ text: string; id: number }> {
  const ids = tok.encode(text);
  return ids.map((id) => ({ text: tok.itos[id] ?? "?", id }));
}