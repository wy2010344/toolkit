/**
 * 第 6 课 · Transformer 块:把注意力与前馈组装起来
 * 目标:理解一个块的完整结构,以及残差 + 预归一为何是深网络的救命稻草。
 */
"use client";

import { useMemo, useState } from "react";
import { CodeBlock, DemoTray, Formula, LessonShell, P, Question, Step } from "../LessonLayout";
import { TransformerDiagram } from "../TransformerDiagram";
import { MICRO_CONFIG, TRAIN_CONFIG, type LLMConfig } from "@/lib/llm/config";
import { createWeights, traceMagnitudes } from "@/lib/llm/model";
import { precomputeRope } from "@/lib/llm/embeddings";
import { CharTokenizer } from "@/lib/llm/tokenizer";

const CODE = `// 一个块 = 1 次注意力交流 + 1 次前馈思考,反复 nLayers 次
h = 嵌入序列

for block in 层:
    # ---- 注意力子层(残差 + 预归一) ----
    h = h + MultiHead(RMSNorm(h)) *缩放后的注意力输出

    # ---- 前馈子层(SwiGLU) ----
    h = h + SwiGLU(RMSNorm(h))

# 收尾:归一 + 输出头
logits = finalNorm(h) @ W_head`;

export function LlmLesson6() {
  return (
    <LessonShell
      kicker="第 6 课 / 组装"
      title="Transformer 块"
      lead="注意力负责“横向交流”,前馈网负责“纵向思考”。一个块把两者用残差和预归一焊在一起,再往上堆 nLayers 层。"
    >
      <Step n={1} title="残差连接:给梯度一条“高速公路”">
        <P>
          深网络训练难,难在梯度要穿透很多层。残差连接在每层输出上直接叠加原始输入:{" "}
          <code className="font-mono">x = x + SubLayer(x)</code>。这让“身份映射”几乎零成本出现在网络里,
          梯度可以绕过任意子层直达前方,深层网络从此“训练得动”。ResNet(GNN/视觉)与 Transformer 都因此受益。
        </P>
        <Formula>x ← x + 子层(x)   (子层 = 注意力 或 前馈)</Formula>
      </Step>
      <Step n={2} title="预归一(Pre-Norm)配合 RMSNorm">
        <P>
          早期 Transformer 在子层之后归一化(Post-Norm),深层时容易数值爆炸。现代 GPT/LLaMA 把归一化挪到子层之{" "}
          <strong>前</strong>(Pre-Norm):先归一再让子层干活,残差再把原值加回来。
          LLaMA 更把 LayerNorm 换成 RMSNorm(省略减均值,效果几乎相同、少算一步),训练更稳也更快。
        </P>
        <CodeBlock code={CODE} />
      </Step>
      <Step n={3} title="SwiGLU 前馈:门控式思考">
        <P>
          注意力输出的向量在每个位置被前馈网“精加工”。经典做法是 ReLU 双线性层,而现代模型(LLaMA/PaLM/GPT-4/Qwen)普遍改用{" "}
          <strong>SwiGLU</strong>:一条“候选内容”线 + 一条“门控”线,两者逐元素相乘,再投影回模型宽度。
          门控让网络学会“选择性放行”,同样的参数量下表达能力更好。
        </P>
        <Formula>SwiGLU(x) = (x·W₁) ⊙ Swish(x·W₂) · W₃</Formula>
      </Step>
      <Step n={4} title="把 8 块积木看成一栋楼">
        <P>所有零件到齐,整体结构一目了然。注意最末一次“归一化 + 输出头”是整个网络唯一的“打分”出口。</P>
        <TransformerDiagram cfg={TRAIN_CONFIG} />
      </Step>

      <DemoTray title="动手:观察数据在层间流动时的“尺度”变化">
        <FlowExplorer />
      </DemoTray>

      <Question>
        <P className="font-medium">思考题</P>
        <P>1) 如果去掉残差连接,把 nLayers 从 2 加到 20,训练会发生什么?(第 7 课可亲自验证)</P>
        <P>2) Pre-Norm 与 Post-Norm 哪一种数值更稳定?为什么 Pre-Norm 更受现代模型欢迎?</P>
        <P>3) SwiGLU 相比 ReLU 前馈,多了哪些中间张量?这会导致参数量变多吗?</P>
      </Question>
    </LessonShell>
  );
}

function FlowExplorer() {
  const [text, setText] = useState("我喜欢苹果");

  const rows = useMemo(() => {
    const tok = new CharTokenizer("我喜欢苹果你喜欢香蕉他喜欢橘子");
    const cfg: LLMConfig = {
      ...MICRO_CONFIG,
      vocabSize: Math.max(tok.vocabSize, 8),
      maxSeqLen: 24,
      nLayers: 2,
    };
    const w = createWeights(cfg);
    const rope = precomputeRope(cfg);
    const ids = tok.encode(text);
    const mags = traceMagnitudes(ids, cfg, w, rope);

    const out: Array<{ label: string; value: number }> = [
      { label: "嵌入输出", value: mags[0]! },
    ];
    for (let l = 0; l < cfg.nLayers; l++) {
      out.push({ label: `第 ${l + 1} 块输出`, value: mags[l + 1]! });
    }
    return out;
  }, [text]);

  const maxV = Math.max(...rows.map((r) => r.value), 1e-6);

  return (
    <div className="space-y-3">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="h-8 w-full rounded-md border border-line bg-surface px-2.5 font-mono text-[12.5px] text-ink outline-none focus:border-line-strong"
      />
      <p className="text-[11.5px] leading-relaxed text-faint">
        RMSNorm 把每一层的“向量量级”(整句 L2 范数)压在稳定区间,不会随层数无限放大——
        这就是深层堆叠的底气。
      </p>
      <div className="grid gap-1.5 sm:grid-cols-3">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5">
            <span className="w-24 shrink-0 text-[11px] text-muted">{r.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
              <div className="h-full bg-acc-blue-fg/70" style={{ width: `${(r.value / maxV) * 100}%` }} />
            </div>
            <span className="w-14 shrink-0 text-right font-mono text-[10px] text-faint">{r.value.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}