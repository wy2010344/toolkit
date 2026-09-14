/**
 * 第 8 课 · 生成:自回归采样
 * 目标:理解 LLM 的"续写"本质,并亲手对比贪心 / 温度 / Top-k 三种采样。
 */
"use client";

import { CodeBlock, DemoTray, Formula, LessonShell, P, Question, Step } from "../LessonLayout";
import { ProblemStrip } from "../ProblemStrip";
import { GenerationPanel } from "../GenerationPanel";
import { DEMO_CORPUS } from "@/lib/llm/data";

const CODE = `// 自回归:一次只预测"下一个 token",把新 token 拼回输入,再来一次
ids = encode(prompt)            // "我喜欢苹果"
while TRUE:
    logits = model(ids)         // 只看历史,不看未来(因果掩码)
    p      = softmax(logits[-1])
    next   = sample_or_argmax(p)   // 采样策略:贪心 / 温度 / top-k
    ids.append(next)
    if 到长度上限 or 遇到 <EOS>: break
文本 = decode(ids)`;

export function LlmLesson8() {
  return (
    <LessonShell
      kicker="第 8 课 / 输出"
      title="生成:自回归采样"
      lead="LLM 没有“从头写一篇文章”的开关——它只会一件事:看着已有的字,估计下一个字是谁。所谓生成,就是把这个动作重复几百次。"
    >
      <ProblemStrip
        problem="模型掏了半天,交出的只是一份「下一个词的概率」。怎么把它变成一整句顺口的话?答案和织毛衣一样一针一针来。"
        obstacle="直接总挑最可能的词会出现复读机;完全乱来又满嘴胡话。要在「稳妥」和「多样」之间找平衡。"
        solve="采样器按策略挑词(贪心 / 温度 / Top-k),每挑一个就拼回去,再猜下一个,一句句「长」出来。温度、Top-k、自回归,都是这个织毛衣过程的开关。"
      />
      <Step n={1} title="一次只猜一个:自回归">
        <P>
          你敲出“我喜欢”,模型内部做一次前向,得到“下一个 token”的概率分布:
          可能是“苹” 70%、“香” 15%、“讨” 10%……然后选一个写下来,再把这个新词拼回输入,继续下一次前向。
          每一步都只“翻新”一次上下文末尾。这个“吃一个吐一个”的过程叫自回归生成。
        </P>
        <CodeBlock code={CODE} />
      </Step>
      <Step n={2} title="三个采样旋钮">
        <P>
          <strong>贪心</strong>永远选最高概率——结果最稳定,但也最无聊,还容易陷入重复循环;
          <strong>温度</strong>把 logits 整体除一个 T 再 softmax:T&gt;1 变平坦(更随机),T&lt;1 变陡峭(更果断);
          <strong>Top-k</strong>先把候选砍到前 k 个,再按比例随机——在“可控”与“多样”之间取平衡。
        </P>
        <Formula>
          温度: pᵢ = exp(logitᵢ/T) / Σ exp(logitⱼ/T)      T→0 退化为贪心
        </Formula>
      </Step>
      <Step n={3} title="生成质量的三个信号">
        <P>
          <strong>概率条</strong>:每一步选中的 token 是否胸有成竹;{" "}
          <strong>信息熵</strong>:该步分布有多“没把握”(0 = 完全确定,1 = 均匀瞎猜);{" "}
          <strong>重复率</strong>:贪心策略下模型爱重复,真实产品会叠加屏蔽词与多样解码技巧。
          看完下面实验再回来体会这三件事。
        </P>
      </Step>

      <DemoTray title="动手:同一个模型,三种采样策略">
        <GenerationPanel corpus={DEMO_CORPUS} />
      </DemoTray>

      <Question>
        <P className="font-medium">思考题</P>
        <P>1) 把温度调到近似 0,再和“贪心”对比——结果一样吗?为什么?</P>
        <P>2) Top-k 与温度的差别是什么?什么时候用哪种更适合?</P>
        <P>3) 真实 LLM 的上下文很长——“只看历史”这件事,在工程上还能做什么优化?(提示:KV Cache,还能联想它为什么省算力)</P>
      </Question>
    </LessonShell>
  );
}