/**
 * 第 1 课 · 文本如何变成数字
 * 目标:理解 LLM 的第一步——分词器把任意文本变成整数序列。
 */
"use client";

import { useMemo, useState } from "react";
import { CodeBlock, DemoTray, Formula, LessonShell, P, Question, Step } from "@/components/lesson/LessonLayout";
import { ProblemStrip } from "@/components/lesson/ProblemStrip";
import { trainTokenizer } from "@/lib/llm/tokenizer";
import { DEMO_CORPUS } from "@/lib/llm/data";

const CODE_TRAIN = `// BPE 训练:不断合并语料里出现次数最多的相邻字符对
// 语料 = "我喜欢苹果。我喜欢香蕉。……"
step 1: 统计所有相邻字符对的出现次数
  ("我","喜")×3  ("喜","欢")×3 …  →  "我喜" 合并成新 token
step 2: 重新统计,再合并最高频的一对
  ("喜欢")×3 …  →  "喜欢" 合并成新 token
…直到词表达到目标大小(如 96)。

最终得到:
  词表(vocab):每一个 token 对应一个整数 id
  merges 表:用了哪些合并规则(编码时按此贪心合并)`;

export function LlmLesson1() {
  return (
    <LessonShell
      kicker="第 1 课 / 地基"
      title="文本如何变成数字:分词器"
      lead="神经网络只认数字。所以任何 LLM 的第一站都是『分词器』——它把一段文字拆成一个个 token,并给每个 token 分配一个整数 id。这节课动手看两种主流做法:字符级和 BPE。"
    >
      <ProblemStrip
        problem="电脑只认数字,可人要写句子。怎么把一段话交给它?别急着找答案,先看它难在哪。"
        obstacle="不能一字一字硬塞也不说明白:切法得统一、能复用,还得「粗细得当」——太粗记不住生词,太细学不出词义的组合。"
        solve="分词器把句子切成一个个 token,每个 token 固定发一个编号。看起来机械,但可靠。词表、BPE 这些名字慢慢会出现在你眼前,不必现在记。"
      />
      <Step n={1} title="为什么模型只认数字?">
        <P>
          神经网络本质上是一个数学函数:吃进一串数值、吐出一串数值。它既不懂“苹”这个汉字,也不懂英文单词——世界上的任何符号,在进入网络前都
          必须被翻译成数字 id(然后在“嵌入”阶段变成向量,详见第 2 课)。
        </P>
        <P>所以最底层的分工是:</P>
        <Formula>文本:“我喜欢苹果” → 分词器 → [id₁, id₂, id₃, …] → 模型</Formula>
        <P>
          分词这件事看似平淡,却藏着大量讲究:分词切得太粗(整个词一个 token),词表爆炸、遇到生词就没办法;
          切得太细(一个字母一个 token),序列太长、模型学不出词的组合意义。BPE 就是在“粗细之间”找平衡。
        </P>
      </Step>

      <Step n={2} title="字符级分词:最朴素的基线">
        <P>
          字符级分词把文本拆成单个字符,每个字符一个 id。中文每个字都有含义,效果尚可;英文里{" "}
          <code className="font-mono">“cat”</code> 会被拆成 c、a、t 三个无意义符号——模型要靠三个孤立片段去猜出 cat。
        </P>
        <CodeBlock code={`import { CharTokenizer } from "@/lib/llm/tokenizer";

// 训练:统计语料出现过的所有字符,为每个字符分配一个 id
const tok = new CharTokenizer("我喜欢苹果。你喜欢香蕉。");
tok.vocabSize;          // 例如 11(所有不重复字符的数量)
tok.encode("我喜欢");    // [3, 1, 6]  —— 文本变成了数字序列!
tok.decode([3, 1, 6]);  // "我喜欢"    —— 数字还能变回文本`} />
      </Step>

      <Step n={3} title="BPE:把高频相邻对合并成子词">
        <P>
          BPE(字节对编码)是 GPT 系列沿用至今的分词方案。它的训练是一个贪心过程:
          反复统计语料里<strong>出现次数最多的相邻字符对</strong>,把它合并成一个新 token。
          因为每次只合并“最常见”的对,最终词表会自然包含高频子词(如“欢喜”“苹果”),
          低频部分仍由字符兜底——所以既能覆盖生词,又不必为每个生造词准备 token。
        </P>
        <CodeBlock code={CODE_TRAIN} />
        <P>
          从词表结构上看,BPE 让模型拥有了“层次感”:<code className="font-mono">“苹果”</code> 可能由{" "}
          <code className="font-mono">[“苹”, “果”]</code> 合并而来,词表里既有“苹”也有“苹果”。
          第 7 课里我们用它训练模型,能明显减少要学到的 token 数量。
        </P>
      </Step>

      <Step n={4} title="编码是贪心的,而且可离线">
        <P>
          BPE 训练完以后,只剩下“词表 + merges 表”。真正编码新文本时,算法同样贪心:
          按“先学到的规则优先”,反复尝试把相邻两个已存在于词表的片段合并;合不动了,就输出当前片段序列。
          因为不依赖原始语料、只依赖两张表,所以真实世界的分词器(tiktoken 等)可以完全离线、还跨语言通用。
        </P>
      </Step>

      <DemoTray title="动手:看同一个句子被切成什么样">
        <TokenizerExplorer />
      </DemoTray>

      <Question>
        <P className="font-medium">思考题</P>
        <P>1) 同样一句话,为什么 BPE 的 token 数通常比字符级少?token 数变少对模型训练意味着什么?</P>
        <P>2) 如果给 BPE 设置的目标词表太大,会发生什么?(提示:合并规则会被“稀释”,词表里出现很多低频 token)</P>
        <P>3) 为什么“未知词”不是问题?——回想一下 BPE 的兜底机制是什么。</P>
      </Question>
    </LessonShell>
  );
}

function TokenizerExplorer() {
  const [text, setText] = useState("我喜欢苹果");
  // 语料 = 演示语料 + 用户输入,保证输入里的字符都在词表内。
  const pair = useMemo(() => trainTokenizer(DEMO_CORPUS + text, 96), [text]);
  const bpe = useMemo(() => pair.bpe.encode(text), [pair, text]);
  const char = useMemo(() => pair.char.encode(text), [pair, text]);

  return (
    <div className="space-y-3">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="h-9 w-full rounded-md border border-line bg-surface px-3 font-mono text-[13px] text-ink outline-none focus:border-line-strong"
        placeholder="输入任意中文/英文……"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-line bg-surface p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11.5px] font-medium text-ink">字符级</span>
            <span className="font-mono text-[10px] text-faint">词表 {pair.char.vocabSize} · {char.length} tokens</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {char.map((id, i) => (
              <span key={i} className="rounded bg-surface-mute px-1.5 py-0.5 font-mono text-[11px] text-ink" title={`id=${id}`}>
                {pair.char.itos[id]}
              </span>
            ))}
          </div>
          <div className="mt-2 break-all font-mono text-[10.5px] leading-relaxed text-faint">{[char].map((r) => `[${r.join(", ")}]`)}</div>
        </div>

        <div className="rounded-lg border border-line bg-surface p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11.5px] font-medium text-ink">BPE</span>
            <span className="font-mono text-[10px] text-faint">词表 {pair.bpe.vocabSize} · merges {pair.bpe.merges.length} · {bpe.length} tokens</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {bpe.map((id, i) => (
              <span key={i} className="rounded bg-acc-yellow-bg px-1.5 py-0.5 font-mono text-[11px] text-acc-yellow-fg" title={`id=${id}`}>
                {pair.bpe.itos[id]}
              </span>
            ))}
          </div>
          <div className="mt-2 break-all font-mono text-[10.5px] leading-relaxed text-faint">[{bpe.join(", ")}]</div>
        </div>
      </div>
    </div>
  );
}