/**
 * 第 5 章:相位与复数 —— 为什么需要两根探针。
 */
"use client";

import { useMemo, useState } from "react";
import { CodeBlock, DemoTray, LessonShell, P, Question, Step } from "@/components/lesson/LessonLayout";
import { fmtNum } from "../plot";
import { Slider } from "../controls";
import { N, amplitudeOf, correlate, probeSin, sineWave, TAU } from "@/lib/dft/dft";

export function DftPhase() {
  const [k, setK] = useState(2);
  const [amp, setAmp] = useState(1);
  const [deg, setDeg] = useState(45);

  const phase = (deg / 360) * TAU;
  const signal = useMemo(() => sineWave(k, amp, phase, N), [k, amp, phase]);

  // 单根 sin 探针:相位一偏就失手
  const naive = useMemo(() => {
    let s = 0;
    for (let n = 0; n < N; n++) s += signal[n]! * probeSin(k, n, N);
    return (s * 2) / N;
  }, [signal, k]);

  // 双探针:re↑(cos)、im↓(−sin),无惧相位
  const bin = useMemo(() => correlate(signal, k), [signal, k]);
  const amp2 = amplitudeOf(bin, k, N);

  // 相位钟:矢量(re, im)的坐标
  const clock = useMemo(() => {
    const s = 44 / N; // 缩放
    const R = amp * (N / 2) * s;
    return { x: bin.re * s, y: -bin.im * s, R };
  }, [bin, amp]);

  const phaseDeg = (Math.atan2(bin.im, bin.re) * 180) / Math.PI;

  return (
    <LessonShell
      kicker="第 5 章 / 补一块拼图"
      title="相位与复数:一根探针会失手,派两根"
      lead="前几章用的都是“相位对齐”的探针。可现实里的声音才不管你的相位对齐——只要声音起了个头(相位 φ≠0),单根探针就量不准了。解法:两根探针一起上。"
    >
      <Step n={1} title="相位一偏,单根探针就“看走眼”">
        <P>
          信号还是 k=2 这声道,只是初始相位设成 φ=90°。拿单根 sin 探针去量,读数直接变成 0——
          因为信号此刻长成了 cos 的样子,而 sin 探针跟 cos “正交”(还记得第 3 章吗?不同相位也相消)。
          差一点的相位,读数就会缩水:不是 1.0,而是 0.8、0.5……
        </P>
        <P>
          于是我们知道:只报一个数,永远没法同时说清“多大声”和“从哪起手”。要两个数,一个抓形状、一个抓起点。
        </P>
      </Step>

      <Step n={2} title="两根探针:cos 抓“形”,−sin 抓“起手”">
        <P>
          一次测量里,同时伸两根探针——余弦探针和负正弦探针(负号是为了后面重建方便)。两个读数凑成一个数对
          <code className="font-mono">(re, im)</code>:
        </P>
        <CodeBlock
          code={`// 第 k 频道 = 两个点积组成的数对
const re = mix.reduce((a, x, n) => a + x * cos(k, n), 0);
const im = mix.reduce((a, x, n) => a - x * sin(k, n), 0);

// 声量 = 数对的“长度”,相位 = 数对的“方向”
const amp   = 2 * Math.hypot(re, im) / N;
const phase = Math.atan2(im, re);`}
        />
      </Step>

      <Step n={3} title="复数:只是“横竖坐标”的别称">
        <P>
          这个数对、这个矢量,数学界给它起了个吓人的名字——<strong>复数</strong>。不必怕它:
          它当两个普通坐标就好,<code className="font-mono">re</code> 是横向读数,<code className="font-mono">im</code> 是纵向读数。
          长度=声量(波有多大),角度=相位(从哪起步)。DFT 的每个频道都装这样一串坐标,这就是“结果是复数”的全部秘密。
        </P>
      </Step>

      <Step n={4} title="验证:相位随便转,声量纹丝不动">
        <P>
          <strong>拖动相位 φ</strong>,数对矢量会绕着原点转圈,但“长度”(声量)始终等于推子值 A。也就是说:
          有了两根探针,任何相位都逃不掉——声量绝不缩水。
        </P>
      </Step>

      <DemoTray title="实验:转相位,看单根探针翻车、双探针稳如泰山">
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <Slider label="圈数 k" min={1} max={6} step={1} value={k} onChange={setK} fmt={(v) => `k=${v}`} />
            <Slider label="响度 A" min={0} max={1.5} step={0.05} value={amp} onChange={setAmp} fmt={(v) => v.toFixed(2)} />
            <Slider label="相位 φ" min={-180} max={180} step={5} value={deg} onChange={setDeg} fmt={(v) => `${v}°`} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-surface p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11.5px] font-medium text-ink">单根 sin 探针</span>
                {Math.abs(naive - amp) > 1e-3 && <span className="text-[10px] font-medium text-acc-red-fg">相位一歪就读不准</span>}
              </div>
              <div className="font-mono text-[20px] text-ink">{fmtNum(naive, 2)}</div>
              <div className="mt-1 text-[11px] text-faint">理想值 {fmtNum(amp, 2)}。φ=0 时准,φ=±90° 时彻底失明。</div>
            </div>

            <div className="rounded-lg border border-line bg-surface p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11.5px] font-medium text-ink">双探针(re, im)</span>
                <span className="text-[10px] font-medium text-acc-green-fg">声量 = {fmtNum(amp2, 3)} · 相位 = {fmtNum(phaseDeg, 0)}°</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="grid flex-1 gap-0.5 font-mono text-[12px] leading-relaxed">
                  <div className="text-muted">
                    re(cos探针)= <span className="text-acc-blue-fg">{fmtNum(bin.re, 1)}</span>
                  </div>
                  <div className="text-muted">
                    im(−sin探针)= <span className="text-acc-blue-fg">{fmtNum(bin.im, 1)}</span>
                  </div>
                  <div className="mt-1 text-ink">
                    |(re, im)| = <strong className="text-acc-green-fg">{fmtNum(amp2, 3)}</strong> ← 兜住声量
                  </div>
                </div>
                <svg viewBox="-80 -80 160 160" className="h-36 w-36 shrink-0">
                  <circle cx={0} cy={0} r={clock.R} className="fill-none stroke-line" strokeWidth={1} strokeDasharray="3 3" />
                  <line x1={-70} y1={0} x2={70} y2={0} className="stroke-line-strong" strokeWidth={1} />
                  <line x1={0} y1={-70} x2={0} y2={70} className="stroke-line-strong" strokeWidth={1} />
                  <line x1={0} y1={0} x2={clock.x} y2={clock.y} stroke="var(--color-acc-green-fg)" strokeWidth={2} />
                  <circle cx={clock.x} cy={clock.y} r={4} fill="var(--color-acc-green-fg)" />
                  <text x={70} y={14} textAnchor="end" className="fill-faint text-[9px]">re(横)</text>
                  <text x={6} y={-64} className="fill-faint text-[9px]">im(纵)</text>
                </svg>
              </div>
            </div>
          </div>

          <div className="text-[11.5px] leading-relaxed text-muted">
            φ={deg}° 时:单根 sin 探针读到 {fmtNum(naive, 2)}(理想 {fmtNum(amp, 2)});
            双探针的长 |(re,im)|={<strong className="text-acc-green-fg">{fmtNum(amp2, 3)}</strong>} 恒等于 A,相位随 φ 转动。
          </div>
        </div>
      </DemoTray>

      <Question>
        <P className="font-medium">思考题</P>
        <P>
          1) 为什么“一个数”永远讲不清一个波的声量与相位?(提示:一个数是数轴上的点;声量+相位是两个自由度。)
        </P>
        <P>
          2) 相位读数是相对余弦基准的:φ=0 的纯正弦,相位恒为 −90°(它比余弦晚到 90°)。验证一下:把 φ 拖到 −90°,双探针会读出……?
        </P>
      </Question>
    </LessonShell>
  );
}