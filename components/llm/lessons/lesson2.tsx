/**
 * 第 2 课 · 把词变成向量:嵌入(Embedding)
 * 目标:理解 token id 如何变成有语义的稠密向量。
 */
"use client";

import { useMemo, useState } from "react";
import { CodeBlock, DemoTray, Formula, LessonShell, P, Question, Step } from "@/components/lesson/LessonLayout";
import { ProblemStrip } from "@/components/lesson/ProblemStrip";
import { MICRO_CONFIG } from "@/lib/llm/config";
import { embedToken } from "@/lib/llm/embeddings";
import { cn } from "@/components/ui";

const CODE = `// 嵌入层就是一张"可训练的大表":[词表大小, 向量维度]
// 每个 token id 对应一行 dModel 维向量。
const emb = createTokenEmbedding(cfg);       // [vocabSize, dModel]

// 查表:把 id 变成向量
const vec  = embedToken(emb, id, cfg.dModel);
// vec ≈ [0.21, -0.84, 1.02, …]  —— 这个向量会被训练调整

// "相似度" = 两个向量的点积(越大越像)
// sim("好", "坏") > sim("好", "苹果")     // 训练后往往如此`;

export function LlmLesson2() {
  return (
    <LessonShell
      kicker="第 2 课 / 语义"
      title="把词变成向量:嵌入"
      lead="token id 只是序号,没有含义。嵌入层把 id 变成高维向量,让『意思相近的词靠得更近』。语义从这里第一次以数学形式登场。"
    >
      <ProblemStrip
        problem="第 1 课只给了编号,可编号之间没有任何「意思」——模型看不出「苹果」和「香蕉」是同类的。"
        obstacle="直接拿编号当数算(数字 7 加 1 得 8)会骗到模型;我们想要的是「能比较像不像」的表示。"
        solve="查一张表:每个编号换一行数字向量,意思像的词靠训练把它们的向量摆得近。术语「嵌入 / 向量 / 维度」翻译过来就是:查表、一串数字、这串数字有多长。"
      />
      <Step n={1} title="为什么不是 one-hot?">
        <P>
          最直觉的做法是 one-hot:每个词一个“独热”向量,第 i 位为 1、其余为 0。
          但词表有 10 万时,向量就有 10 万维——浪费、稀疏、且任意两个词之间都垂直(相似度为 0),
          完全无法表达“猫≈狗”“喜欢≈爱”这样的关系。
        </P>
        <P>
          嵌入层(Embedding)正是答案:一张形状为{" "}
          <code className="font-mono">[vocabSize, dModel]</code> 的可训练大表,把每个 id 映射成一个{" "}
          <strong>稠密、低维、有意义</strong>的向量。dModel 常见取值 768/4096/8192,远小于词表大小。
        </P>
      </Step>
      <Step n={2} title="查表即可,训练调整">
        <P>
          训练开始时,所有向量都是随机值。随着训练反向传播,每个 token 的向量会被反复推拉,
          直到:语义接近的 token,向量更接近;语义相反的,向量更远。这个“向量空间”里,
          <em>方向</em>往往也承载语义(国王−男人≈女王−女人)——这就是词向量的著名性质。
        </P>
        <CodeBlock code={CODE} />
      </Step>
      <Step n={3} title="相似度:点积与余弦">
        <P>衡量两个向量多像,最简单的是点积,或用归一化版本(余弦相似度):</P>
        <Formula>sim(a, b) = a·b / (‖a‖·‖b‖) ∈ [−1, 1]</Formula>
        <P>注意力机制(第 4 课)用的正是点积思想:向量方向越一致,点积越大,关系越强。</P>
      </Step>

      <DemoTray title="动手:看『随机嵌入』下的词距离(训练前)">
        <EmbeddingExplorer />
      </DemoTray>

      <Question>
        <P className="font-medium">思考题</P>
        <P>1) dModel 太小或太大分别有什么问题?(提示:表达能力 vs 过拟合、算力)</P>
        <P>2) 上图是“随机初始化”的相似度矩阵——它看起来像什么?训练后(见第 7 课)它会变成什么样?</P>
        <P>3) 为什么嵌入向量在训练完成后,常用在聚类/检索任务里?</P>
      </Question>
    </LessonShell>
  );
}

function EmbeddingExplorer() {
  const text = "我喜欢苹果香蕉我们你";
  const chars = Array.from(text);
  const [seed] = useState(() => Math.floor(Math.random() * 1e9));
  // 用固定随机种子生成一张"嵌入表",这样每次刷新可复现,便于观察。
  const table = useMemo(() => buildSeededTable(chars.length, MICRO_CONFIG.dModel, seed), [chars.length, seed]);

  const vectors = useMemo(() => chars.map((_, i) => embedToken(table, i, MICRO_CONFIG.dModel)), [chars, table]);

  const sims = useMemo(() => {
    const n = chars.length;
    return Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => cosine(vectors[i]!, vectors[j]!)),
    );
  }, [vectors, chars.length]);

  return (
    <div className="space-y-3">
      <p className="text-[11.5px] leading-relaxed text-faint">
        下面是随机初始化的 <code className="font-mono">dModel=16</code> 嵌入,右图是两两余弦相似度 —— 颜色越深代表越相似(此时全是噪声)。
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr_1.2fr]">
        <div className="rounded-lg border border-line bg-surface p-3">
          <div className="mb-2 text-[11.5px] font-medium text-ink">每个字符的 16 维向量</div>
          <div className="space-y-1">
            {chars.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-4 shrink-0 text-center font-mono text-[11px] text-muted">{c}</span>
                <div className="flex flex-1 gap-0.5">
                  {Array.from(vectors[i]!).map((v, d) => (
                    <span
                      key={d}
                      className={cn("h-4 flex-1 rounded-[2px]")}
                      style={{
                        background: v > 0 ? `rgba(31,108,159,${Math.min(1, v)})` : `rgba(159,47,45,${Math.min(1, -v)})`,
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 font-mono text-[9.5px] text-faint">蓝=正,红=负(高度即数值)</div>
        </div>

        <div className="rounded-lg border border-line bg-surface p-3">
          <div className="mb-2 text-[11.5px] font-medium text-ink">两两相似度(余弦)</div>
          <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${chars.length}, 1fr)` }}>
            {sims.map((row, i) =>
              row.map((v, j) => (
                <div
                  key={`${i}-${j}`}
                  className="flex h-7 items-center justify-center rounded-[3px] font-mono text-[8.5px] text-white"
                  style={{
                    background:
                      v > 0
                        ? `color-mix(in srgb, var(--color-acc-blue-fg) ${Math.round(v * 100)}%, white)`
                        : `color-mix(in srgb, var(--color-acc-red-fg) ${Math.round(-v * 100)}%, white)`,
                  }}
                  title={`sim(${chars[i]},${chars[j]}) = ${v.toFixed(3)}`}
                >
                  {v.toFixed(1)}
                </div>
              )),
            )}
          </div>
          <div className="mt-1 flex justify-between font-mono text-[9.5px] text-faint">
            <span>列 = {chars.join(" ")}</span>
            <span>行 = 同上</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
}

/** 用固定种子的 LCG 生成一张可复现的随机嵌入表(仅教学演示用)。 */
function buildSeededTable(rows: number, cols: number, seed: number): Float32Array {
  const t = new Float32Array(rows * cols);
  let s = seed;
  const next = () => {
    s = (s * 1664525 + 1013904223) | 0;
    return s;
  };
  const scale = 1 / Math.sqrt(cols);
  for (let i = 0; i < t.length; i++) t[i] = (next() / 0xffffffff) * 2 * scale - scale;
  return t;
}