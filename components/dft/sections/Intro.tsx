/**
 * 序曲:一锅声音,为什么难拆开。
 */
"use client";

import { useMemo } from "react";
import { CodeBlock, DemoTray, LessonShell, P, Question, Step } from "@/components/lesson/LessonLayout";
import { ProblemStrip } from "@/components/lesson/ProblemStrip";
import { WavePlot } from "../plot";
import { N, sineWave } from "@/lib/dft/dft";

const PARTS = [
  { k: 1, amp: 1.0 },
  { k: 2, amp: 0.5 },
  { k: 3, amp: 0.3 },
] as const;

export function DftIntro() {
  return (
    <LessonShell
      kicker="第 0 章 / 把问题摆上桌"
      title="一锅声音,为什么拆不开"
      lead="你录下一段和弦:小提琴、长笛、鼓点同时响。录音里只剩一条弯弯曲曲的波形。问题是——怎么从这一条线里,把每个乐器各自的声音“拔”出来?"
    >
      <ProblemStrip
        problem="一段录音是一锅“合音”:任意时刻,麦克风只压出一个数——所有声音此刻的总和。乐器们叠在一起,看起来只是乱糟糟的一条波形。"
        obstacle="单个瞬间永远看不出门道:无数种不同频率的波,都能在同一个时刻凑出同一个值。想分开声音,只盯着一帧是不可能的。"
        solve="换一种思路:眼光放到整个窗口长度上。频率不同的波有一个“量子天生的毛病”——正负互相抵消;频率相同的波,同向的总是叠在一起。把「配对求和」对每个频率各做一遍,一锅合音就自动解开了。"
      />

      <Step n={1} title="任意一帧,只有总和">
        <P>
          下面这锅“混音”其实很简单:三条正弦波,频率分别为 1、2、3(意思:在这段窗口里各自绕 1、2、3 圈),
          大小分别是 1.0、0.5、0.3。单独看,每一条都清清楚楚;
          但把它们逐帧相加之后,你看到的是右下角那条不再像正弦的曲线——这就是录音看到的东西。
        </P>
        <P>
          现在的问题是:给你右下角这条曲线,不看上面三条,你能不能说出“里面有几种声音、各多大”?直观地回答不了。
          这就是傅里叶要解决的事。
        </P>
        <DemoTray title="同一锅混音:三条线 vs 一条线">
          <MixPeek />
        </DemoTray>
      </Step>

      <Step n={2} title="灵光:换个“配对求和”的思路">
        <P>
          拆声音的办法,古人早就取好了名字——<strong>同声相应</strong>。把你要找的音,和锅里的声音逐帧<strong>乘起来再求和</strong>:
        </P>
        <CodeBlock
          code={`// 用一根“探针”逐帧相乘,再加总
let sum = 0;
for (let n = 0; n < N; n++) sum += mix[n] * probe(n);

// 神奇的是:
//   探针与锅中某一声音“频率相同”→ 乘积同号 → 总和越叠越响(相应)
//   探针与锅中声音“频率不同”→ 乘积正负参半 → 总和自动归零(相消)`}
        />
        <P>
          等下一章你会亲手拨这根探针,亲眼看“同声相应”是怎样发生的。先把结论挂在这儿:
          这个“乘起来,再求和”的动作,对每个频率 k 都做一遍,就得到一张表——
          <strong>每个频道各自听到了多大声</strong>。这张表就是<strong>频谱</strong>,整套动作就是<strong>离散傅里叶变换(DFT)</strong>。
        </P>
      </Step>

      <Step n={3} title="后面几章怎么走">
        <P>
          我们把整个问题切成七小步,每一小步都有能动手的演示:
        </P>
        <CodeBlock
          code={`① 造一条波        —— 用代码写正弦,k=圈数、amp=响度
② 同频共振        —— 探针对上,总和一路涨
③ 异频相消        —— 对不上,正负自动抵消
④ 拆开混音        —— 一锅合音,逐个频道量回去
⑤ 一根探针会失手  —— 相位偏移,得派两根探针
⑥ 完整 DFT        —— 一个双重循环,频谱到手`}
        />
      </Step>

      <Question>
        <P className="font-medium">思考题</P>
        <P>
          1) 为什么“看某一瞬间的数值”认不出里面的声音?能不能举一个反例:两个完全不同的配方,在同一瞬间挤出完全相同的值?
        </P>
        <P>
          2) 猜测一下:如果锅里的三条波频率是 1、2、3,那用“2 圈探针”去量它,结果应该大于 0 还是近似 0?后面试验时记得回来验证。
        </P>
      </Question>
    </LessonShell>
  );
}

/** 三条单音 + 混音波形预览。 */
function MixPeek() {
  const waves = useMemo(
    () => PARTS.map((p) => sineWave(p.k, p.amp, 0, N)),
    [],
  );
  const mix = useMemo(() => {
    const out = new Array<number>(N).fill(0);
    for (const w of waves) for (let n = 0; n < N; n++) out[n]! += w[n]!;
    return out;
  }, [waves]);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        {PARTS.map((p, i) => (
          <div key={p.k}>
            <WavePlot pts={waves[i]!} height={92} label={`k=${p.k} · amp=${p.amp.toFixed(1)}`} />
          </div>
        ))}
      </div>
      <WavePlot pts={mix} height={110} label="麦克风听到的混音(三条线叠起来)" color="var(--color-acc-red-fg)" />
    </div>
  );
}