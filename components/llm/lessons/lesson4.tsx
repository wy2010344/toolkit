/**
 * 第 4 课:注意力从零开始 —— 缩放点积注意力。
 */
"use client";

import { useMemo, useState } from "react";
import { DiceFive } from "@phosphor-icons/react/dist/ssr";
import { Button, Toggle, cn } from "@/components/ui";
import { CodeBlock, DemoTray, Formula, LessonShell, P, Question, Step } from "@/components/lesson/LessonLayout";
import { ProblemStrip } from "@/components/lesson/ProblemStrip";
import { AttentionHeatmap } from "../AttentionHeatmap";
import { MICRO_CONFIG } from "@/lib/llm/config";
import { createWeights, forward } from "@/lib/llm/model";
import { precomputeRope } from "@/lib/llm/embeddings";
import { CharTokenizer } from "@/lib/llm/tokenizer";

const CODE = `// 缩放点积注意力(带因果掩码)
// 一次只看"已写完"的过去,不许偷看未来
const d = Q[0].length;
let scores = Q @ Kᵀ / Math.sqrt(d);

// 掩码:把"未来"位置的分数设为 -∞,softmax 后权重自动归零
for (let i = 0; i < T; i++)
  for (let j = i + 1; j < T; j++) scores[i][j] = -Infinity;

const weights = softmaxSeq(scores); // 每行和为 1:[T,T]
const out = weights @ V;            // [T,d] 每个位置都拿到它关注到的信息`;

export function LlmLesson4() {
  return (
    <LessonShell
      kicker="第 4 课 / 注意力"
      title="让每个 token 学会“该关注谁”"
      lead="Transformer 的全部魔力都在这一步:让每个 token 学会“该关注上文的哪几个位置”。这节课用真实运行的微型模型展示它。"
    >
      <ProblemStrip
        problem="每个词要明白自己在整句里的意思(「他」指谁?「苹果」在哪个语境),得先「看到」别的词。"
        obstacle="词与词之间该建立多强的联系,没法一个个写死——联系应该由内容自己决定。"
        solve="注意力:每个词亮出「我想找啥」,对全句的「钥匙」打分,再照相关度取内容。像查字典,机器自己读完一整句。Q/K/V、点积、因果掩码这些名字都服务于这一件事。"
      />
      <Step n={1} title="核心:一句话版">
        <P>
          你在图书馆藏室里问:“有哪本书记得秦始皇?”(Q) —— 每本书背面都贴着“主题标签”(K);
          标签和你问的越像,这本书越值得取出来(V)。注意力做的正是“用相似度选内容、再按相似度叠一起”。
        </P>
        <Formula>score(i,j) = (Qᵢ·Kⱼ) / √d → softmax → 权重 → Σⱼ 权重(i,j)·Vⱼ</Formula>
        <P>
          每个 token 各自当“询问者”去问别人,得到的答案是一个加权平均——这个平均质量的好坏,完全由 Q/K 怎么投影决定的。
        </P>
      </Step>

      <Step n={2} title="为什么要除以 √d?">
        <P>
          点积的大小会随维度 d 一起变大:向量越长,点积的方差越大。如果不去掉这个成长,softmax 会过早“饱和”——
          少数大数吃掉全部概率,注意力几乎变成 one-hot,而梯度趋近于零。
        </P>
        <P>除以 √d 把点积的方差拉回 ~1,softmax 保持在“柔和而敏感”的区域,梯度才好传回去。</P>
        <CodeBlock code={CODE} />
      </Step>

      <Step n={3} title="因果掩码:causal attention">
        <P>
          训练目标是“用前文预测后文”。如果注意力能看到未来,预测就成了抄答案,模型永远学不会“自己续写”。
        </P>
        <P>
          办法极其朴素:把位置 j {">"} i(未来)的分数直接设成 −∞,softmax 后这些位置的权重自动归零。
          于是位置 i 的注意力输出,只包含{"{0,1,…,i}"} 提供的信息。
        </P>
      </Step>

      <DemoTray title="动手:看真实模型每层每头的注意权重">
        <AttentionExplorer />
      </DemoTray>

      <Question>
        <P className="font-medium">思考题</P>
        <P>1) 把因果掩码关掉,权重矩阵的形状会变成什么样?(动手试试)</P>
        <P>2) 数一数:一个位置 i 完成一次注意力需要多少次乘法?(提示:和序列长度成正比)</P>
        <P>3) seed 变一次,注意力分布就完全变样——这说明当前模型处于什么状态?(第 7 课给出答案:还没训练)</P>
      </Question>
    </LessonShell>
  );
}

function AttentionExplorer() {
  const [text, setText] = useState("我喜欢苹果");
  const [causal, setCausal] = useState(true);
  const [layer, setLayer] = useState(0);
  const [head, setHead] = useState(0);

  const tok = useMemo(() => new CharTokenizer("我喜欢苹果香蕉橘子青菜火腿"), []);
  const ids = useMemo(() => tok.encode(text), [tok, text]);

  const weights = useMemo(() => createWeights(MICRO_CONFIG), []);
  const rope = useMemo(() => precomputeRope(MICRO_CONFIG), []);

  const f = useMemo(
    () => forward(ids, MICRO_CONFIG, weights, rope, true, { causal }),
    [ids, causal, weights, rope],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="min-w-40 rounded-md border border-line bg-canvas px-2 py-1 text-sm text-ink outline-none focus:border-accent"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Toggle label="因果掩码(遮住未来)" checked={causal} onChange={setCausal} />
        <Button
          variant="subtle"
          onClick={() => setText((s) => (s === "我喜欢苹果" ? "苹果香蕉" : "我喜欢苹果"))}
        >
          <DiceFive size={14} />
          换一句
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
        <span>layer:</span>
        {[0, 1].map((l) => (
          <button
            key={l}
            className={cn(
              "rounded px-1.5 py-0.5 transition-colors",
              l === layer ? "bg-acc-bg text-acc" : "hover:bg-surface",
            )}
            onClick={() => setLayer(l)}
          >
            {l}
          </button>
        ))}
        <span>head:</span>
        {[0, 1].map((h) => (
          <button
            key={h}
            className={cn(
              "rounded px-1.5 py-0.5 transition-colors",
              h === head ? "bg-acc-bg text-acc" : "hover:bg-surface",
            )}
            onClick={() => setHead(h)}
          >
            {h}
          </button>
        ))}
      </div>

      <AttentionHeatmap
        weights={f.trace!.layers[layer]![head]!}
        tokens={ids.map((id) => tok.itos[id] ?? "?")}
        label={causal ? "causal = 开(右上角强制为 0)" : "causal = 关(全连接)"}
      />
    </div>
  );
}