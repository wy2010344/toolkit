/**
 * 第 2 章:同频共振 —— 点积让同声越叠越响。
 */
"use client";

import { useMemo, useState } from "react";
import { CodeBlock, DemoTray, LessonShell, P, Question, Step } from "@/components/lesson/LessonLayout";
import { ProductPlot } from "../plot";
import { Seg } from "../controls";
import { N, correlateTrace, sineWave } from "@/lib/dft/dft";

const PROBE_OPTIONS = Array.from({ length: 8 }, (_, i) => ({ value: i + 1, label: `k=${i + 1}` }));

export function DftResonate() {
  const signalK = 2;
  const [probeK, setProbeK] = useState(2);

  const signal = useMemo(() => sineWave(signalK, 1, 0, N), [signalK]);
  const trace = useMemo(() => correlateTrace(signal, probeK), [signal, probeK]);
  const matched = probeK === signalK;
  const amp = (trace.total * 2) / N;

  return (
    <LessonShell
      kicker="第 2 章 / 核心动作"
      title="同频共振:探针对上,总和一路涨"
      lead="为什么“乘起来再求和”能听出某个频率?答案就四个字:同声相应。探针与信号同频时,每一帧都在帮忙,总和越叠越响。"
    >
      <Step n={1} title="核心动作:乘起来,再求和(点积)">
        <P>
          拿一根写着“k=2”的探针(就是第 k=2 频的正弦——相位对齐信号),和信号逐帧相乘、再全部加总。
          这个动作有个正式名字叫<strong>点积</strong>,但它的威力不需要名字撑腰——看数字就行。
        </P>
        <CodeBlock
          code={`// 点积:探测“k=2”这声道在信号里有多响
let sum = 0;
for (let n = 0; n < N; n++) {
  const product = signal[n] * probeSin(2, n);   // 逐帧相乘
  sum += product;                                // 再求和
}
// 探针对上(k=2 探量 k=2 的信号)时:
//   乘积全部 ≥ 0 → sum 一路涨到 ≈ N/2`}
        />
      </Step>

      <Step n={2} title="同频:处处同号,越叠越响">
        <P>
          两条同频同相的正弦相乘,结果是 <code className="font-mono">sin²(θ)</code>——永远不可能是负数。
          于是乘积柱图里<strong>一根红条都看不见</strong>,全是绿条;累计和一路往上爬,毫不回头。
          就像推秋千:每次都在同一个节奏上助一把力,越荡越高。
        </P>
      </Step>

      <Step n={3} title="把读数翻译成“声量”">
        <P>
          同频时,总和的终点约等于 <code className="font-mono">N/2 = 32</code>。除以 N/2,就看回信号的调子
          (这里是 1.0):<CodeDemo total={trace.total} amp={amp} matched={matched} />
        </P>
      </Step>

      <DemoTray title="实验:信号恒为 k=2 · amp=1.0,切换探针频率看累计和">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11.5px] text-muted">探针频率</span>
            <Seg options={PROBE_OPTIONS} value={probeK} onChange={setProbeK} />
          </div>
          <ProductPlot products={trace.products} runningSum={trace.runningSum} total={trace.total} size={N} />
          <div className="text-[11.5px] leading-relaxed text-muted">
            {matched ? (
              <>
                探针 k={probeK} 与信号同频:<strong className="text-acc-green-fg">同声相应</strong>——乘积全为正、
                累计和一路爬到 {trace.total.toFixed(1)}(约 N/2),于是声量≈<strong className="text-ink">{amp.toFixed(2)}</strong>。
              </>
            ) : (
              <>
                探针 k={probeK} 与信号不同频:<strong className="text-acc-red-fg">值对不上</strong>——去看看下一个章节,
                为什么它会“自动抵销”。
              </>
            )}
          </div>
        </div>
      </DemoTray>

      <Question>
        <P className="font-medium">思考题</P>
        <P>
          1) 如果信号是 k=2 · amp=1.5,同频探针的总和大概会是多少?(提示:它该是 N/2 的多少倍?)调了以后才发现的坑值得记下来。
        </P>
        <P>
          2) 注意我们现在用了“相位对齐”的探针。如果信号悄悄挪了个相位(比如 90°),同频探针还灵吗?可以跳到第 5 章看答案。
        </P>
      </Question>
    </LessonShell>
  );
}

function CodeDemo({ total, amp, matched }: { total: number; amp: number; matched: boolean }) {
  return (
    <span className="mt-1 inline-block rounded-md bg-canvas px-2 py-0.5 font-mono text-[12px] text-ink">
      sum = {total.toFixed(2)} → 声量 = 2·{total.toFixed(2)}/{N} ={" "}
      <strong className={matched ? "text-acc-green-fg" : ""}>{amp.toFixed(2)}</strong>
    </span>
  );
}