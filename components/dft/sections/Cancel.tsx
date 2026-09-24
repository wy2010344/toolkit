/**
 * 第 3 章:异频相消 —— 不同声,自动互相抵消。
 * 这一章是整个 DFT 的心脏:为什么锅里的三种频率,拆的时候互不干扰。
 */
"use client";

import { useMemo, useState } from "react";
import { CodeBlock, DemoTray, LessonShell, P, Question, Step } from "@/components/lesson/LessonLayout";
import { ProductPlot, fmtNum } from "../plot";
import { Slider } from "../controls";
import { N, correlateTrace, sineWave } from "@/lib/dft/dft";

export function DftCancel() {
  const [signalK, setSignalK] = useState(2);
  const [probeK, setProbeK] = useState(4);

  const signal = useMemo(() => sineWave(signalK, 1, 0, N), [signalK]);
  const trace = useMemo(() => correlateTrace(signal, probeK), [signal, probeK]);
  const matched = probeK === signalK;

  // 打表:同一个信号,把 0..10 频道逐个数一遍
  const sweep = useMemo(() => {
    return Array.from({ length: 11 }, (_, k) => {
      const t = correlateTrace(signal, k);
      return { k, total: t.total };
    });
  }, [signal]);

  return (
    <LessonShell
      kicker="第 3 章 / 心脏"
      title="异频相消:不同声,自动互相抵消"
      lead="上一章看到探针对上就“相应”。这一章看另一半:探针对不上时,锅里的声音会自动把自己抵销成 0。把这两种表现放在一起,DFT 就成立了。"
    >
      <Step n={1} title="频率不对:帮忙与顶回,轮流上位">
        <P>
          拿 k=4 的探针去量 2 圈的正弦。相乘之后,乘积<strong>时正时负</strong>——因为两波步调不一致,
          一会儿同向(在帮忙),一会儿反向(在顶回)。单帧看起来毫无规律,但“一堆帮忙、一堆顶回”恰好一样多,这才是关键。
        </P>
      </Step>

      <Step n={2} title="对称抵消:正的面积 = 负的面积">
        <P>
          看上下两个图:上面那排绿条(正)、红条(负)像拉链一样严丝合缝;下面那条累计和,被前后“拽来拽去”,
          最后却乖乖回到 0 附近。这不是巧合——两个整数圈频率相乘,乘积波在一个窗口里必然对称,
          于是<strong>“正的部分”和“负的部分”面积恰好相等</strong>。逐帧求和只是把这个对称如实数出来。
        </P>
        <P>
          直线版的解释只有一句(不想记也行,记住“整数圈 → 正负对称”就够):<CodeBlock code={`// 两个整圈频率相乘,得到“差频”也是整数圈
e^{i·k·θ} · e^{−i·k′·θ} = e^{i(k−k′)·θ}
// (k−k′) 是整数 → 整圈的正弦(或余弦)求和 = 0
// 数学上这叫「单位根求和为 0」,通俗叫法:点积正交`} />
        </P>
      </Step>

      <Step n={3} title="打表:只有对的那个频道有反应">
        <P>
          对同一个信号,把探针从 k=0 一直拧到 k=10,逐频道看总计。结果一目了然:
          <strong>只有 k = {signalK} 那一格有反应</strong>,其他整整十格都是 10⁻¹⁵ 级别的 0。
          换句话说:不同的“声”在彼此的探针下<strong>自动抵销</strong>,互不串台。
        </P>
        <P>
          这个“非对即零”的品格,让锅里的每种频率都能被单独揪出来而互不污染——它就是整台收音机能工作的地基。
        </P>
      </Step>

      <Step n={4} title="“0”不是约等于,是精确到浮点灰尘">
        <P>
          不信请看“总计”那一格:不是 0.01、0.5,而是像 <code className="font-mono">-2.2e-15</code> 这种——那就是浮点运算留下的灰尘级噪声。
          你完全可以把它当成严格的 0。
        </P>
      </Step>

      <DemoTray title="实验:改信号频率,换探针,看“对号入座”">
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Slider label="信号频率" min={1} max={6} step={1} value={signalK} onChange={setSignalK} fmt={(v) => `k=${v}`} />
            <Slider label="探针频率" min={0} max={10} step={1} value={probeK} onChange={setProbeK} fmt={(v) => `k=${v}`} />
          </div>

          <ProductPlot products={trace.products} runningSum={trace.runningSum} total={trace.total} size={N} />

          <div className="rounded-lg border border-line bg-surface p-3">
            <div className="mb-2 text-[11.5px] font-medium text-muted">同一信号逐频道“总计”(点格切换探针)</div>
            <div className="flex flex-wrap gap-1">
              {sweep.map((s) => {
                const isMatch = s.k === signalK;
                return (
                  <button
                    key={s.k}
                    onClick={() => setProbeK(s.k)}
                    className={
                      "rounded px-2 py-1 font-mono text-[10.5px] transition-colors " +
                      (probeK === s.k ? "ring-1 ring-inset ring-ink" : "") +
                      (isMatch ? " bg-acc-green-bg text-acc-green-fg" : s.k === 0 ? " bg-surface-mute text-faint" : " bg-surface-mute text-muted")
                    }
                    title={`k=${s.k} · 总计 ${fmtNum(s.total, 6)}`}
                  >
                    {s.k}→{fmtNum(s.total, isMatch ? 1 : 2)}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 text-[11px] text-faint">
              只有与信号同频(k={signalK})的那一格读到明显值;其余全是 10⁻¹⁵ 级噪声。0 频道读 0,是因为纯正弦没有直流。
            </div>
          </div>

          <div className="text-[11.5px] leading-relaxed text-muted">
            {matched ? (
              <>探针 k={probeK} 与信号 k={signalK} 同频:<strong className="text-acc-green-fg">回应来自同声</strong>,总计 {trace.total.toFixed(2)} ≈ N/2。</>
            ) : (
              <>探针 k={probeK} 读信号 k={signalK}:不同频 → 正负相抵,总计 {trace.total.toExponential(2)} ≈ 0。</>
            )}
          </div>
        </div>
      </DemoTray>

      <Question>
        <P className="font-medium">思考题</P>
        <P>
          1) 把信号调到 k=3、探针调到 k=6:乘积也一样对称吗?把信号调到 k=3、探针 k=5 呢?“对称相消”需要什么前提?(提示:想想这两章的标题——同“频”才相应。)
        </P>
        <P>
          2) 如果探针与信号同频、但探针慢 90°(拿 cos 探信号 sin):还会“一路涨”吗?这埋下了第 5 章的伏笔。
        </P>
      </Question>
    </LessonShell>
  );
}