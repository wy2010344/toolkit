/**
 * 第 4 章:拆开混音 —— 一台可以听的收音机。
 * 把三条波拌成一锅,再用“频道探测器”把配方原样读回来,还可以亲耳听。
 */
"use client";

import { useMemo, useState } from "react";
import { SpeakerSimpleHigh } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui";
import { CodeBlock, DemoTray, LessonShell, P, Question, Step } from "@/components/lesson/LessonLayout";
import { WavePlot, fmtNum } from "../plot";
import { Slider } from "../controls";
import { N, amplitudeOf, correlate, mixWaves, spectrumAmplitude } from "@/lib/dft/dft";

const BASE_PARTS = [
  { k: 1, amp: 1.0 },
  { k: 2, amp: 0.5 },
  { k: 3, amp: 0.3 },
] as const;

function play(parts: Array<{ k: number; amp: number }>) {
  if (typeof window === "undefined") return;
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0.1;
  master.connect(ctx.destination);
  const t = ctx.currentTime + 0.02;
  for (const p of parts) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = p.k * 110; // k=1 → 110Hz(A2), k=2 → 220Hz(A3), k=3 → 330Hz(E4)
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, p.amp), t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + 1.9);
  }
  setTimeout(() => {
    void ctx.close();
  }, 2300);
}

export function DftMixer() {
  const [faders, setFaders] = useState<number[]>(() => BASE_PARTS.map((p) => p.amp));
  const [channel, setChannel] = useState(1);

  const parts = useMemo(() => BASE_PARTS.map((p, i) => ({ k: p.k, amp: faders[i]! })), [faders]);
  const mix = useMemo(() => mixWaves(parts, N), [parts]);

  const reading = useMemo(() => {
    const bin = correlate(mix, channel);
    return { amp: amplitudeOf(bin, channel, N), phase: Math.atan2(bin.im, bin.re) };
  }, [mix, channel]);

  // 逐频道检测一遍(0..8),和下方的“真相”配方对照。
  const sweep = useMemo(() => {
    const amps = spectrumAmplitude(mix).slice(0, 9);
    return amps.map((a, k) => ({ k, amp: a }));
  }, [mix]);

  const trim = (v: number) => (Math.abs(v) < 1e-6 ? 0 : Number(v.toFixed(4)));

  return (
    <LessonShell
      kicker="第 4 章 / 会听的本领"
      title="拆开混音:一台可以听的收音机"
      lead="把上一章的道理用起来:三条波拌成一锅,再用“探针当收音机调台旋钮”,把当初放了多少料逐格量回来。这一章你会亲眼看见、亲耳听见 DFT。
"
    >
      <Step n={1} title="拌一锅混音:三条正弦,三个旋钮">
        <P>
          把 k=1、2、3 三条正弦按“配方”拌成一锅(逐帧相加)。下面的波形就是麦克风收到的那条线——
          三条单音已经“溶”进一条乱七八糟的曲线里了。
        </P>
        <P>
          记住这份配方:1.0 / 0.5 / 0.3。接下来的任务就是<strong>不问配方,只量这锅汤</strong>。
        </P>
      </Step>

      <Step n={2} title="频道探测器:想来哪根频率就量哪根">
        <P>
          选一个频道 k,把探针(cos 和 −sin 两根)伸进去做点积,读数除以 N/2 就是这一格的“声量”。
          这就是上一章打表动作的正规化版本:
        </P>
        <CodeBlock
          code={`// 探测第 k 频道:re = Σ x·cos(kθ), im = −Σ x·sin(kθ)
const bin = correlate(mix, k);          // 两根探针的读数(复数)
const amp = 2 * Math.hypot(bin.re, bin.im) / N;   // 声量`}
        />
      </Step>

      <Step n={3} title="真相对照:量回来的 = 当初放的">
        <P>
          逐频道量一遍(0~8),把结果和配方对在一起:1、2、3 三个频道准确读出 1.0、0.5、0.3,
          其余频道 0.0000。<strong>探测器完全没有串台</strong>——这就是“异频相消”换来的干净。
        </P>
      </Step>

      <Step n={4} title="听一听:分离的单音,和完整和弦">
        <P>
          耳朵是终审法官。点“完整和弦”听到三者叠在一起的声音;再分别点 1 号、2 号、3 号单音——
          你会听出:2 号比 1 号高八度,3 号再往上跳,而且各自分明。这台“收音机”不只量得准,还放得清。
        </P>
      </Step>

      <DemoTray title="实验:拨推子 → 看波形与探测器读数">
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            {BASE_PARTS.map((p, i) => (
              <Slider
                key={p.k}
                label={`k=${p.k} 声量`}
                min={0}
                max={1.5}
                step={0.05}
                value={faders[i]!}
                onChange={(v) => setFaders((fs) => fs.map((x, j) => (j === i ? v : x)))}
                fmt={(v) => v.toFixed(2)}
              />
            ))}
          </div>

          <WavePlot pts={mix} height={120} color="var(--color-acc-red-fg)" label={`混音波形(配方 ${parts.map((p) => `${p.k}:${p.amp.toFixed(1)}`).join(" · ")} )`} />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-surface p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-[11.5px] font-medium text-ink">频道探测器</span>
                <Slider label="频道 k" min={0} max={8} step={1} value={channel} onChange={setChannel} fmt={(v) => `k=${v}`} />
              </div>
              <div className="font-mono text-[12px] leading-relaxed text-ink">
                k={channel}:声量 ={" "}
                <strong className={reading.amp > 1e-6 ? "text-acc-green-fg" : "text-faint"}>
                  {fmtNum(reading.amp, 4)}
                </strong>
                {channel > 0 && <> · 相位 {fmtNum(reading.phase, 3)} rad</>}
              </div>
              <div className="mt-1 text-[11px] text-faint">只有放进推子的 k=1/2/3 才有声量,其他频道读 0。</div>
            </div>

            <div className="rounded-lg border border-line bg-surface p-3">
              <div className="mb-2 text-[11.5px] font-medium text-ink">逐频道扫描(k=0..8)</div>
              <div className="flex flex-wrap gap-1">
                {sweep.map((s) => (
                  <span
                    key={s.k}
                    className={
                      "rounded px-2 py-1 font-mono text-[10.5px] " +
                      (Math.abs(s.amp) > 1e-6 ? "bg-acc-green-bg text-acc-green-fg" : "bg-surface-mute text-faint")
                    }
                  >
                    {s.k}:{fmtNum(trim(s.amp), s.k !== 0 ? 2 : 4)}
                  </span>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="subtle" onClick={() => play(parts)}>
                  <SpeakerSimpleHigh size={13} />
                  完整和弦
                </Button>
                {BASE_PARTS.map((p) => (
                  <Button key={p.k} variant="ghost" onClick={() => play([{ k: p.k, amp: faders[p.k - 1]! }])}>
                    只听 k={p.k}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DemoTray>

      <Question>
        <P className="font-medium">思考题</P>
        <P>
          1) 把所有推子拖成 0,再点“逐频道扫描”——为什么每个频道都读 0?这提示“探测”这条约定的另一头是什么。
        </P>
        <P>
          2) 如果配方里加一条“直流”(k=0,整段抬高一个固定值),频道 0 会读到多少?而这会儿纯正弦的 0 频道读 0,正好说明它“没有抬波形”。
        </P>
      </Question>
    </LessonShell>
  );
}