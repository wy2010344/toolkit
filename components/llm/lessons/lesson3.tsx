/**
 * 第 3 课 · 让模型分清先后:旋转位置编码(RoPE)
 * 目标:理解"位置信息"为什么必须显式注入,以及 RoPE 用一个旋转就搞定。
 */
"use client";

import { useMemo, useState } from "react";
import { CodeBlock, DemoTray, Formula, LessonShell, P, Question, Step } from "../LessonLayout";
import { ProblemStrip } from "../ProblemStrip";
import { MICRO_CONFIG } from "@/lib/llm/config";

const CODE = `// RoPE:对 dModel 维向量按"二维平面"逐个旋转
// 第 i 个平面旋转角 = pos × base^(-2i/dModel),base=10000
// 位置 p 越靠后,向量在同一维度上"转"得越远。

for (let pos = 0; pos < seqLen; pos++) {
  // 位置 pos:角度 = pos·ω_i
  const angle = pos * (1 / 10000 ** (2 * i / dModel));
  x' = x·cos(angle) − y·sin(angle)
  y' = x·sin(angle) + y·cos(angle)
}

// 关键洞察:两个 token 的注意力分数会自然带上 cos((pos1−pos2)·ω_i)
// —— 也就是"相对距离"的信息,而不是绝对位置。`;

export function LlmLesson3() {
  return (
    <LessonShell
      kicker="第 3 课 / 位置"
      title="让模型分清先后:旋转位置编码"
      lead="注意力天然“不认先后”:“猫追狗”和“狗追猫”对它没有区别。必须把位置信息注入向量。现代 LLM 的主流答案是 RoPE。"
    >
      <ProblemStrip
        problem="机器看完一句话得知道谁先谁后——「狗咬猫」和「猫咬狗」意思正好相反。"
        obstacle="下一课的注意力只算「内容像不像」,天生分不清先后:位置信息压根不在它眼里。"
        solve="给每个位置发一个「旋转角」,把先后顺势夹进相似度打分——位置差越大,打分越受罚。术语「RoPE」现在只用理解成「拧角度」即可。"
      />
      <Step n={1} title="注意力认识不到顺序">
        <P>
          “我喜欢猫”和“猫喜欢我”——如果把两者都交给注意力网络,同一组词,仅仅换了顺序,信息完全不同,
          但注意力“只看两两相似度、不看出现在第几位”。不加位置信息,模型永远分不清谁先谁后。
        </P>
        <P>
          这是所有序列模型共同面对的问题。早期方案是“绝对位置嵌入”(给每个位置加一个固定的偏移向量)——
          简单但难以外推到训练中没见过的更长文本。RoPE 则用<strong>旋转</strong>解决,思路优雅得多。
        </P>
      </Step>
      <Step n={2} title="旋转:把“位置”揉进向量方向">
        <P>
          把 dModel 维向量切成 dModel/2 个二维平面。给每个平面配置一个角速度{" "}
          <code className="font-mono">ωᵢ = 10000^(−2i/dModel)</code>。位置 p 的向量,每个平面旋转{" "}
          <code className="font-mono">p·ωᵢ</code> 弧度。
        </P>
        <P>于是“位置”不再是一个加上的数字,而是改变了向量的<strong>方向</strong>。这就是“旋转嵌入”的名字由来。</P>
        <CodeBlock code={CODE} />
      </Step>
      <Step n={3} title="为什么旋转能表达“相对位置”?">
        <P>
          旋转是正交变换,保持长度不变。两个“被旋转过”的向量做点积,等于“它们未旋转时的点积”再乘上{" "}
          <code className="font-mono">cos((p₁−p₂)·ωᵢ)</code>:
        </P>
        <Formula>q·k (旋转后) = (q·k) × cos(相对距离 × ωᵢ)</Formula>
        <P>
          也就是说:注意力分数自动被“相对距离的余弦”调制——离得近、绕的频率合拍的向量会更容易互相吸引;
          更妙的是它只依赖 <code className="font-mono">pos₁ − pos₂</code> 的相对差值,所以天生对“没见过的更长距离”有更好的外推能力。
        </P>
      </Step>
      <Step n={4} title="RoPE 只作用于 Q 和 K">
        <P>
          位置信息只参与“计算相似度”这一步。所以旋转只加给 Q 和 K,V 以及后面的前馈网都不需要。
          这也降低了 RoPE 的实现成本:每个 block 只需对 Q/K 各做一次旋转。
        </P>
      </Step>

      <DemoTray title="动手:看向量如何随位置旋转">
        <RopeExplorer />
      </DemoTray>

      <Question>
        <P className="font-medium">思考题</P>
        <P>1) 为什么靠前的维度旋转得慢(i 小、ω 大)?以及靠后的维度转得快?这有什么好处?</P>
        <P>2) “绝对位置”与“相对位置”的区别是什么?为什么相对位置对长文本更友好?</P>
        <P>3) 如果 base 从 10000 换到 1000000,旋转会变快还是变慢?这会影响什么?</P>
      </Question>
    </LessonShell>
  );
}

function RopeExplorer() {
  const [plane, setPlane] = useState(0);
  const dModel = MICRO_CONFIG.dModel;
  const nPlanes = dModel / 2;
  const omega = 1 / Math.pow(10000, (2 * plane) / dModel);

  // 位置 0..9 在指定平面上的旋转角
  const angles = useMemo(() => Array.from({ length: 10 }, (_, p) => p * omega), [omega]);

  // 画布参数:画旋转"时钟",角度从 x 正轴起逆时针
  const R = 66;
  const CX = 78;
  const CY = 74;

  const pt = (angle: number) => ({
    x: CX + R * Math.cos(angle),
    y: CY - R * Math.sin(angle),
  });

  // 相对距离调制曲线:cos(Δ·ω),Δ ∈ [-6, 6]
  const mod = useMemo(() => Array.from({ length: 13 }, (_, i) => (i - 6) * omega), [omega]);
  const M = 44;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[11.5px] text-muted">观察平面(维度对)</label>
        {Array.from({ length: nPlanes }, (_, i) => (
          <button
            key={i}
            onClick={() => setPlane(i)}
            className={plane === i ? "rounded-md bg-ink px-2.5 py-1 font-mono text-[11px] text-white" : "rounded-md border border-line bg-surface px-2.5 py-1 font-mono text-[11px] text-muted"}
          >
            {i + 1} 对
          </button>
        ))}
        <span className="ml-auto font-mono text-[10.5px] text-faint">ω{plane} = {omega.toExponential(2)}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-line bg-surface p-3">
          <div className="mb-1 text-[11.5px] font-medium text-ink">同一向量在不同位置的旋转</div>
          <svg viewBox="0 0 156 148" className="mx-auto w-full max-w-[230px]">
            <circle cx={CX} cy={CY} r={R} className="fill-none stroke-line" strokeWidth={1} strokeDasharray="3 3" />
            <line x1={CX - R - 10} y1={CY} x2={CX + R + 10} y2={CY} className="stroke-line-strong" strokeWidth={1} />
            <line x1={CX} y1={CY - R - 10} x2={CX} y2={CY + R + 10} className="stroke-line-strong" strokeWidth={1} />
            {angles.map((a, p) => {
              const pos = pt(a);
              return (
                <g key={p}>
                  <line x1={CX} y1={CY} x2={pos.x} y2={pos.y} stroke={p === 4 ? "var(--color-acc-red-fg)" : "var(--color-faint)"} strokeWidth={p === 4 ? 2 : 1} opacity={p === 4 ? 1 : 0.55} />
                  <circle cx={pos.x} cy={pos.y} r={p === 4 ? 5 : 3} fill={p === 4 ? "var(--color-acc-red-fg)" : "var(--color-acc-blue-fg)"}>
                    <title>位置 {p},角度 {(p * omega).toFixed(2)}</title>
                  </circle>
                  {p % 2 === 0 && (
                    <text x={pos.x + 4} y={pos.y - 4} className="fill-muted font-mono text-[9px]">{p}</text>
                  )}
                </g>
              );
            })}
            <text x={CX} y={CY + R + 12} textAnchor="middle" className="fill-faint text-[9px]">
              位置号标注在点旁;红色 = 位置 4 的向量
            </text>
          </svg>
        </div>

        <div className="rounded-lg border border-line bg-surface p-3">
          <div className="mb-1 text-[11.5px] font-medium text-ink">旋转后,注意力被相对距离调制:cos(Δ·ω)</div>
          <svg viewBox="0 0 240 100" className="mx-auto w-full">
            <line x1={0} y1={50} x2={240} y2={50} className="stroke-line-strong" strokeWidth={1} />
            <line x1={120} y1={8} x2={120} y2={92} className="stroke-line-strong" strokeWidth={1} />
            {mod.map((v, i) => {
              const x = (i / (mod.length - 1)) * 240;
              const y = 50 - v * M;
              return <circle key={i} cx={x} cy={y} r={2.6} fill="var(--color-acc-green-fg)" />;
            })}
            <text x={120} y={7} textAnchor="middle" className="fill-muted text-[9px]">Δ = pos₁ − pos₂</text>
            <text x={8} y={50 - M - 4} className="fill-muted text-[9px]">+1</text>
            <text x={8} y={50 + M + 10} className="fill-muted text-[9px]">−1</text>
          </svg>
          <div className="mt-1 text-center font-mono text-[10px] text-faint">
            距离 0 → 1,距离越远分越弱,且周期性起伏
          </div>
        </div>
      </div>
    </div>
  );
}