/**
 * 第 7 课 · 训练:梯度下降与反向传播
 * 目标:亲眼看一个随机模型如何通过几百步迭代学会一门"小语言"。
 */
"use client";

import { CodeBlock, DemoTray, Formula, LessonShell, P, Question, Step } from "../LessonLayout";
import { TrainingPanel } from "../TrainingPanel";
import { DEMO_CORPUS } from "@/lib/llm/data";

const CODE = `// 训练循环(真实、可运行的骨架)
for step in 1..N:
    # 1. 前向:算预测与 loss
    loss = 0
    for t in 位置:  loss += 交叉熵(softmax(logits[t]), 下一个token)

    # 2. 反向:链式法则,得到每个参数的梯度
    grads = 反向传播(loss)

    # 3. 更新:AdamW 顺着梯度下降
    optimizer.step(grads)     # w ← w − lr·m̂ / (√v̂ + ε) − lr·wd·w`;

export function LlmLesson7() {
  return (
    <LessonShell
      kicker="第 7 课 / 学习"
      title="训练:从混沌到有序"
      lead="之前的模型全是随机权重,输出毫无意义。这一节课把这些权重从随机数训练成能『续写中文』的小模型——这就是大模型训练的最小原型。"
    >
      <Step n={1} title="loss:错得有多离谱">
        <P>
          给模型一句“我喜欢苹果”,它的任务是用“我喜欢”预测“苹”。若正确答案的概率是 80%,
          交叉熵损失 = −ln(0.80) ≈ 0.22;若只有 0.1%,损失 ≈ 6.9,非常高。
          训练的全部目标,就是把这个数字压到接近 0。
        </P>
        <Formula>loss = −log P(下一个 token = 正确答案)    全部位置取平均</Formula>
      </Step>
      <Step n={2} title="反向传播:链式法则下山">
        <P>
          loss 是“每个权重的小函数”。微积分告诉我们:朝 loss 的负梯度方向挪动权重,loss 就会变小。
          梯度由链式法则从输出一层层传回输入——对每步变换求偏导再连乘。这就是“反向传播”(backprop)。
        </P>
        <P>
          本仓库把每个模块的反向都手写成小题(见 <code className="font-mono">lib/llm/training.ts</code>)。
          理解重点:softmax+交叉熵的梯度有优雅的全 v 公式 <code className="font-mono">p − one_hot</code>——
          模型高估了正确答案就让相应 logit 走低,低估就推高。
        </P>
      </Step>
      <Step n={3} title="AdamW 与学习率调度">
        <P>
          朴素梯度下降容易震荡。Adam 为每个参数维护“一阶动量”(方向)与“二阶动量”(量级),
          自动调整每一步的步伐大小;AdamW 额外把权重衰减单独结算,是当前大模型的标准炼丹炉。
          学习率再配合“预热 + 余弦退火”:开始小火慢炖防爆,后期小火收尾求精。
        </P>
        <CodeBlock code={CODE} />
      </Step>

      <DemoTray title="动手:训练你自己的第一个微型 LLM">
        <TrainingPanel corpus={DEMO_CORPUS} />
      </DemoTray>

      <Question>
        <P className="font-medium">思考题</P>
        <P>1) 训练 10 步后 loss 大概还有多大?100 步呢?为什么它下降得越来越慢?</P>
        <P>2) 生成一段 “我喜欢…” 的续写——为什么此时模型大概率能写对水果名?</P>
        <P>3) 如果把学习率调成 0 或 1000,会发生什么?(动手在代码里试试,或先预言再验证)</P>
      </Question>
    </LessonShell>
  );
}