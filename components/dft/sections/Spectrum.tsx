/**
 * 第 6 章:完整 DFT —— 一个双重循环,把频谱拿到手。
 * 把所有频道一次性量完,画成柱状图;再用反变换把菜谱变回菜。
 */
"use client";

import { useMemo, useState } from "react";
import { SpeakerSimpleHigh } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui";
import { CodeBlock, DemoTray, LessonShell, P, Question, Step } from "@/components/lesson/LessonLayout";
import { SpectrumBars, WavePlot } from "../plot";
import { Seg } from "../controls";
import { N, dft, impulse, mixWaves, noise, resynthesize, sineWave, spectrumAmplitude, squareWave } from "@/lib/dft/dft";

const PRESETS = [
  { id: 0, label: "单音" },
  { id: 1, label: "三和弦" },
  { id: 2, label: "方波" },
  { id: 3, label: "脉冲" },
  { id: 4, label: "噪声" },
] as const;

const NOTES = {
  0: "单音:只有 k=2 一根柱——频谱一看就认出了它",
  1: "三和弦:1、2、3 三根柱清清楚楚(高端:其他频道全部归零)",
  2: "方波:基频 k=1 + 奇次谐波 3、5、7…,高度依次 1/1、1/3、1/5 递减——方波原来是“奇数谐波的合唱”",
  3: "脉冲:一根针尖,却同时鸣响所有频道、且声量几乎相等——越是“尖锐”的信号,越是需要堆满高频",
  4: "噪声:没有固定频率,频谱一片乱麻——没有稳定信号,就没有稳定的柱",
} as const;

function playBin(freqHz: number, amp: number) {
  if (typeof window === "undefined") return;
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freqHz;
  g.gain.value = Math.min(0.2, Math.max(0.02, amp * 0.12));
  osc.connect(g).connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.9);
  setTimeout(() => {
    void ctx.close();
  }, 1100);
}

export function DftSpectrum() {
  const [preset, setPreset] = useState(0);
  const [selK, setSelK] = useState<number | undefined>(undefined);

  const signal = useMemo(() => {
    switch (preset) {
      case 0:
        return sineWave(2, 1, 0, N);
      case 1:
        return mixWaves(
          [
            { k: 1, amp: 1 },
            { k: 2, amp: 0.5 },
            { k: 3, amp: 0.3 },
          ],
          N,
        );
      case 2:
        return squareWave(1, N);
      case 3:
        return impulse(N);
      default:
        return noise(N, 7);
    }
  }, [preset]);

  const bins = useMemo(() => dft(signal), [signal]);
  const amps = useMemo(() => spectrumAmplitude(signal), [signal]);

  // 反变换把菜谱变回菜:误差应 ≈ 浮点灰尘
  const back = useMemo(() => {
    const re = resynthesize(bins, N);
    let maxErr = 0;
    for (let n = 0; n < N; n++) maxErr = Math.max(maxErr, Math.abs(re[n]! - signal[n]!));
    return { re, maxErr };
  }, [bins, signal]);

  return (
    <LessonShell
      kicker="第 6 章 / 收官"
      title="完整 DFT:一个双重循环,把频谱拿到手"
      lead="把前面所有零碎拼成一件东西:一个函数、两个循环,一次性把 N 个频道全部量完;量出来的柱状图就是频谱。最后再用反变换证明——菜谱能变回菜。"
    >
      <Step n={1} title="完整代码:二层循环,毫无修饰">
        <P>
          “逐个频道探测”被写成两个循环:外层跑频道 k,内层在被这段信号上逐帧做点积。代码短到像哄人,
          却正是离散傅里叶变换本体:
        </P>
        <CodeBlock
          code={`export function dft(signal: number[]) {
  const N = signal.length;
  const bins: Array<{ re: number; im: number }> = [];
  for (let k = 0; k < N; k++) {           // 每个频道
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) {          // 逐帧点积
      re += signal[n] * Math.cos((2*Math.PI*k*n)/N);
      im -= signal[n] * Math.sin((2*Math.PI*k*n)/N);
    }
    bins.push({ re, im });                 // 一对探针读数 → 复数
  }
  return bins;                             // 整张“菜谱”
}`}
        />
      </Step>

      <Step n={2} title="频谱:把菜谱画成柱子">
        <P>
          每个频道的两根读数(re, im)化成“声量”一个数字,按 k 排成柱状图,就是频谱。
          只用画 k=0..N/2 一半。为什么够?实信号的频谱是<strong>镜像</strong>:<code className="font-mono">X[N−k] = conj(X[k])</code>,
          后半段是前半段的回声,信息重复了;所以最多量到 N/2(第 N/2 频是“每帧换半圈”的最高速)。
        </P>
      </Step>

      <Step n={3} title="试一试:五种信号,五种频谱">
        <P>
          —— 点开方波那一档,看频谱从“一根柱”变成“阶梯”:基频 + 奇次谐波按 1、1/3、1/5 往下掉。
          这正是“声音是什么材质”的指纹。点击任意一根柱,还能亲耳听到那个频道的声音。
        </P>
      </Step>

      <Step n={4} title="反向:把菜谱变回菜">
        <P>
          把 N 个频道的(振幅,相位)按各自频率加回去(re×cos − im×sin,直流单独处理),就重建出原波形——
          误差只有 10⁻¹⁴ 量级。这说明 DFT 不是“丢信息的粗略猜”,而是一套整装往返的变换。
        </P>
      </Step>

      <DemoTray title="实验台:选信号 → 看波形与频谱 → 点柱试听 → 看重建误差">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11.5px] text-muted">信号:</span>
            <Seg options={PRESETS.map((p) => ({ value: p.id, label: p.label }))} value={preset} onChange={setPreset} />
            <span className="ml-auto font-mono text-[10.5px] text-faint">N = {N} 点 · 显示 k=0..{N / 2}(镜像只画一半)</span>
          </div>

          <WavePlot pts={signal} height={110} color="var(--color-acc-blue-fg)" label={`波形 · ${PRESETS[preset]!.label}`} />
          <SpectrumBars
            amps={amps}
            showHalf
            selected={selK}
            onSelect={(k) => {
              setSelK(k);
              playBin(k * 110, amps[k]!);
            }}
            label={`频谱 · ${NOTES[preset as keyof typeof NOTES]}`}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-surface p-3">
              <div className="mb-1 text-[11.5px] font-medium text-ink">挑一根柱试听</div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="subtle"
                  disabled={selK === undefined}
                  onClick={() => selK !== undefined && playBin(selK * 110, amps[selK]!)}
                >
                  <SpeakerSimpleHigh size={13} />
                  播 {selK !== undefined ? `${selK * 110} Hz` : "选一根柱"}
                </Button>
                <span className="font-mono text-[10.5px] text-faint">k=0 是静默的直流,听不到</span>
              </div>
            </div>

            <div className="rounded-lg border border-line bg-surface p-3">
              <div className="mb-1 text-[11.5px] font-medium text-ink">反向重建自检</div>
              <div className="font-mono text-[12px] text-ink">
                重建 vs 原波形最大误差:<strong className={back.maxErr < 1e-9 ? "text-acc-green-fg" : "text-acc-red-fg"}>{back.maxErr.toExponential(2)}</strong>
                <span className="ml-1 text-[10.5px] text-faint">{back.maxErr < 1e-9 ? "· 信息没丢,菜谱完整" : "· 咦?"}</span>
              </div>
            </div>
          </div>
        </div>
      </DemoTray>

      <Question>
        <P className="font-medium">思考题</P>
        <P>
          1) 为什么方波只在奇数倍频(1、3、5…)处有柱?给个直觉提示:偶数倍谐波天生会把奇对称……(想一想方波的上下对称性。)
        </P>
        <P>
          2) 脉冲那么“尖”,为什么需要 <strong>所有</strong> 频道一起合唱才能复制它?越尖锐的东西,越需要高频帮忙——这个直觉以后学采样定理也用得上。
        </P>
        <P>
          3) mp3/音频的“频谱削尖再反向”就是这个思路:先量频谱,再丢掉那些声量极小的频道——人耳听不出,菜谱却小了一大截。
        </P>
      </Question>
    </LessonShell>
  );
}