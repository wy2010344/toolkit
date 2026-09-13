/**
 * 第 5 课:多头注意力(Multi-Head Attention)。
 */
"use client";

import { useMemo, useState } from "react";
import { DiceFive } from "@phosphor-icons/react/dist/ssr";
import { Button, cn } from "@/components/ui";
import { CodeBlock, DemoTray, Formula, LessonShell, P, Question, Step } from "../LessonLayout";
import { AttentionHeatmap } from "../AttentionHeatmap";
import { MICRO_CONFIG } from "@/lib/llm/config";
import { createWeights, forward } from "@/lib/llm/model";
import { precomputeRope } from "@/lib/llm/embeddings";
import { CharTokenizer } from "@/lib/llm/tokenizer";

const CODE = `// 多头注意力:把一长条 dModel 维切成 nHeads 段
headDim = dModel / nHeads;   // 每头只看自己的一段

heads = [];
for (h = 0; h < nHeads; h++) {
  q = Q[:, h*headDim : (h+1)*headDim];   // 本头的查询
  k = K[:, h*headDim : (h+1)*headDim];
  v = V[:, h*headDim : (h+1)*headDim];
  heads.push(attention(q, k, v));        // 独立算一遍缩放点积注意力
}
out = concat(heads) @ Wo;                // 拼回去,再投影回 dModel`;

export function LlmLesson5() {
  return (
    <LessonShell
      kicker="第 5 课 / 多头注意力"
      title="多头:让模型同时“关心”多种关系"
      lead="单个头只能捕捉一种“关系模式”。多头的灵感很朴素:既然一种不够,那就同时开几个独立的注意力,再让后续层决定用谁。"
    >
      <Step n={1} title="为什么一个头不够">
        <P>
          “我喜欢苹果”里至少有——「喜欢」与「我」之间的主谓、与「苹果」之间的动宾;如果句子更长还会出现指代、并列、反义……
          这些关系是不同“频道”的信息,挤在一个低维向量里互相干扰。
        </P>
        <P>实例:对一个随机(未训练)的 2 层 2 头模型,下面两个头的注意力分布完全不同。</P>
      </Step>

      <Step n={2} title="怎么切">
        <P>
          多头注意力把 dModel 维向量切成 nHeads 段,每段由一双独立的“眼睛”做缩放点积注意力。
          每头只看到 dModel/nHeads 维的信息,被迫学会“从不同角度压缩语义”。
        </P>
        <CodeBlock code={CODE} />
      </Step>

      <Step n={3} title="合起来再投影">
        <P>
          各头输出按列拼回 dModel,再过一次可学习线性层 Wo。Wo 也是一个“混合大师”,
          决定这一层最终要上报哪些方向的证据给下一层。
        </P>
        <Formula>MultiHead(Q,K,V) = Concat(head₁,…,head_h)·W_o</Formula>
      </Step>

      <DemoTray title="动手:同一句话,不同头关注不同位置">
        <MultiHeadExplorer />
      </DemoTray>

      <Question>
        <P className="font-medium">思考题</P>
        <P>1) 如果头之间完全独立,没有 Wo 的混合,模型会有什么损失?</P>
        <P>2) 把模型改成“1 头”或“8 头”,注意力分布会怎么变?(提示:每头信息量变多/变少)</P>
        <P>3) 真实模型里头的分工是“学出来的”还是“定死的”?</P>
      </Question>
    </LessonShell>
  );
}

function MultiHeadExplorer() {
  const [text, setText] = useState("我喜欢苹果");
  const [head, setHead] = useState(0);

  const tok = useMemo(() => new CharTokenizer("我喜欢苹果香蕉橘子青菜火腿"), []);
  const ids = useMemo(() => tok.encode(text), [tok, text]);

  const weights = useMemo(() => createWeights(MICRO_CONFIG), []);
  const rope = useMemo(() => precomputeRope(MICRO_CONFIG), []);

  const f = useMemo(() => forward(ids, MICRO_CONFIG, weights, rope, true), [ids, weights, rope]);
  const tokens = ids.map((id) => tok.itos[id] ?? "?");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="min-w-40 rounded-md border border-line bg-canvas px-2 py-1 text-sm text-ink outline-none focus:border-accent"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button
          variant="subtle"
          onClick={() => setText((s) => (s === "我喜欢苹果" ? "苹果香蕉" : "我喜欢苹果"))}
        >
          <DiceFive size={14} />
          换一句
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
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
        weights={f.trace!.layers[1]![head]!}
        tokens={tokens}
        label={`第 2 层 · 头 ${head}`}
      />
    </div>
  );
}