/**
 * 第 1 章:波的语言 —— 用代码造一条正弦波。
 */
"use client";

import { useMemo, useState } from "react";
import { CodeBlock, DemoTray, LessonShell, P, Question, Step } from "@/components/lesson/LessonLayout";
import { WavePlot } from "../plot";
import { Slider } from "../controls";
import { N, sineWave, TAU } from "@/lib/dft/dft";

export function DftWaveFactory() {
  const [k, setK] = useState(2);
  const [amp, setAmp] = useState(1);
  const [deg, setDeg] = useState(0);

  const phase = (deg / 360) * TAU;
  const pts = useMemo(() => sineWave(k, amp, phase, N), [k, amp, phase]);

  return (
    <LessonShell
      kicker="第 1 章 / 地基"
      title="波的语言:用几行代码造一条波"
      lead="DFT 只跟一种波形打交道:正弦波(sine)。先把它的每个旋钮点亮,后面所有实验都是在摆弄这根正弦波。"
    >
      <Step n={1} title="一条正弦波,只有四个旋钮">
        <P>
          用代码写正弦,只需要一个函数和四个参数。这里“采样点 n”就像录音机每秒按下的次数样本;
          我们把整段窗口固定成 <code className="font-mono">N = 64</code> 个采样点。
        </P>
        <CodeBlock
          code={`// 第 n 个采样点上的波形高度
const wave = (n: number) =>
  amp * Math.sin((2 * Math.PI * k * n) / N + phase);

// 四个旋钮:
//   N     = 64    采样点数(整段“时间预算”,全实验室统一)
//   k     = ?     圈数 —— 这段窗口里绕几圈(就是频率)
//   amp   = ?     响度 —— 波摆动的幅度
//   phase = ?     初始角 —— 从哪个位置起手`}
        />
      </Step>

      <Step n={2} title="“圈数”就是这里的频率">
        <P>
          物理世界用“每秒多少次”(赫兹)描述频率;但 DFT 眼里只有<strong>窗口里绕几圈</strong>。
          反正窗口长度固定为 64 帧,于是“k 圈”和“真频率”一一对应——k 越大,同一段窗口里就越折腾。
          所以下面代码里的 <code className="font-mono">k</code>,就是我们的频道号。
        </P>
      </Step>

      <Step n={3} title="相位决定“从哪里起手”,不是形状">
        <P>
          相位把整条波整体左移或右移,像是拨了一个起始角。相同 <code className="font-mono">k</code> 的波,
          无论如何折腾相位,都还是同一条“声”,只是错开了起跑线——这一点到第 5 章会变得至关重要。
        </P>
      </Step>

      <DemoTray title="动手:拨四个旋钮(这里只用三个),看波形怎么变">
        <div className="space-y-3">
          <div className="grid gap-2">
            <Slider label="圈数 k" min={1} max={8} step={1} value={k} onChange={setK} fmt={(v) => `${v} 圈`} />
            <Slider label="响度 amp" min={0} max={1.5} step={0.05} value={amp} onChange={setAmp} fmt={(v) => v.toFixed(2)} />
            <Slider label="相位 φ" min={-180} max={180} step={5} value={deg} onChange={setDeg} fmt={(v) => `${v}°`} />
          </div>
          <WavePlot pts={pts} height={150} color={deg === 0 ? "var(--color-acc-blue-fg)" : "var(--color-acc-orange-fg)"} />
          <CodeBlock
            code={`const k   = ${k};      // 圈数
const amp = ${amp.toFixed(2)};  // 响度
const φ   = ${deg}°;            // 初始角 β 转成弧度:${(phase / Math.PI).toFixed(2)}π

const wave = (n) => ${amp.toFixed(2)} * Math.sin(2π·${k}·n / ${N} ${deg === 0 ? "" : `+ ${(phase / Math.PI).toFixed(2)}π`})`}
          />
        </div>
      </DemoTray>

      <Question>
        <P className="font-medium">思考题</P>
        <P>
          1) 把 k 从 1 调到 2,波形“皱”了一倍。如果 N 也跟着翻倍(128 帧),同一根 k=2 的波看起来和原来一样吗?——这告诉我们“频率”必须相对窗口来说才有意义。
        </P>
        <P>
          2) 试试相位 ±180°:波形好像“上下翻转”了。说明“相位 0 的正弦”和“相位 180°的正弦”,数学上其实是同一根波被倒了个头——你能在脑子里把这个关系转过来吗?
        </P>
      </Question>
    </LessonShell>
  );
}