/**
 * 交互式训练面板:真正在你的浏览器里训练一个微型 GPT。
 *
 * 功能:
 *   1) 用 语料 + 配置 初始化一个随机模型;
 *   2) 点按钮逐步训练(真实的反向传播 + AdamW),实时画 loss 曲线;
 *   3) 训练后输入 prompt + 调节温度,实时自回归生成文本。
 *
 * 训练在事件线程同步执行、每 5 步让位一次渲染,量级很小,不会卡死。
 */
"use client";

import { useMemo, useRef, useState } from "react";
import { Play, Recycle, FastForward } from "@phosphor-icons/react/dist/ssr";
import { Button, cn, Notice } from "@/components/ui";
import { TRAIN_CONFIG, type LLMConfig } from "@/lib/llm/config";
import { sample, temperatureSoftmax } from "@/lib/llm/math";
import { createWeights, nextTokenProbs } from "@/lib/llm/model";
import { precomputeRope } from "@/lib/llm/embeddings";
import { computeLossAndGradients, createOptim, optimStep, scheduleLr } from "@/lib/llm/training";
import { makeCharSession } from "@/lib/llm/data";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function TrainingPanel({
  corpus,
  config = TRAIN_CONFIG,
  defaultPrompt = "我喜欢",
}: {
  corpus: string;
  config?: LLMConfig;
  defaultPrompt?: string;
}) {
  // —— 一次性构建:会话(分词器) + 随机权重 + RoPE ——
  // 注意:权重在物体上原地更新(训练步),重置时整体替换为全新实例。
  const { session, weights } = useMemo(() => {
    const s = makeCharSession(config, corpus);
    const w = createWeights(config);
    return { session: s, weights: w };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [optim, setOptim] = useState(() => createOptim(0.02, 0.01, weights));

  const [lossHist, setLossHist] = useState<Array<{ step: number; loss: number }>>([]);
  const [stepCount, setStepCount] = useState(0);
  const [training, setTraining] = useState(false);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [temperature, setTemperature] = useState(0.9);
  const [genText, setGenText] = useState("");
  const [genSteps, setGenSteps] = useState<Array<{ token: string; prob: number }>>([]);
  const [err, setErr] = useState("");
  const trainReqRef = useRef(0);

  const reset = () => {
    // 重置:权重与优化器全量重建,清空历史。
    const fresh = createWeights(config);
    weights.emb.set(fresh.emb);
    weights.finalNorm.set(fresh.finalNorm);
    weights.head.set(fresh.head);
    for (let l = 0; l < config.nLayers; l++) {
      for (const k of ["norm1", "wq", "wk", "wv", "wo", "norm2", "w1", "w2", "w3"] as const) {
        weights.blocks[l]![k]!.set(fresh.blocks[l]![k]!);
      }
    }
    setOptim(() => createOptim(0.02, 0.01, weights));
    setLossHist([]);
    setStepCount(0);
    setGenText("");
    setGenSteps([]);
  };

  const runSteps = async (n: number) => {
    setErr("");
    setTraining(true);
    const reqId = ++trainReqRef.current;
    const rope = precomputeRope(config);
    let hist = lossHist;
    let steps = stepCount;
    try {
      for (let i = 0; i < n; i++) {
        if (trainReqRef.current !== reqId) return;
        const tokenIds = session.encode(corpus);
        const lr = scheduleLr(steps + 1, 5, 0.02, 600);
        const { loss, grads } = computeLossAndGradients(tokenIds, config, weights, rope);
        optimStep(optim, weights, grads, lr);
        steps += 1;
        hist = [...hist, { step: steps, loss }];
        if (i % 5 === 4 || i === n - 1) {
          setLossHist(hist);
          setStepCount(steps);
          await sleep(0); // 让渲染线程喘口气
        }
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setStepCount(steps);
      setLossHist(hist);
      setTraining(false);
    }
  };

  const doGenerate = () => {
    if (prompt.length === 0) return;
    setErr("");
    const rope = precomputeRope(config);
    const ids = session.encode(prompt);
    let text = prompt;
    const steps: Array<{ token: string; prob: number }> = [];
    try {
      for (let i = 0; i < 24; i++) {
        if (ids.length >= config.maxSeqLen) break;
        const { logits } = nextTokenProbs(ids, config, weights, rope);
        const dist = temperatureSoftmax(logits, temperature);
        const token = sample(dist);
        steps.push({ token: session.decode([token]), prob: dist[token]! });
        text += session.decode([token]);
        ids.push(token);
      }
      setGenText(text);
      setGenSteps(steps);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const chart = useMemo(() => {
    if (lossHist.length < 2) return null;
    const W = 480;
    const H = 120;
    const pad = 4;
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of lossHist) {
      if (p.loss < lo) lo = p.loss;
      if (p.loss > hi) hi = p.loss;
    }
    if (hi - lo < 1e-6) hi = lo + 1;
    const pts = lossHist
      .map((p, i) => {
        const x = pad + (i / (lossHist.length - 1)) * (W - 2 * pad);
        const y = H - pad - ((p.loss - lo) / (hi - lo)) * (H - 2 * pad);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    return { pts, lo, hi, W, H };
  }, [lossHist]);

  return (
    <div className="space-y-3">
      {/* 训练控制 */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void runSteps(1)} loading={training} disabled={training}>+1 步</Button>
        <Button onClick={() => void runSteps(10)} loading={training} disabled={training} variant="subtle">
          训练 10 步
        </Button>
        <Button onClick={() => void runSteps(100)} loading={training} disabled={training} variant="subtle">
          <FastForward size={14} />
          训练 100 步
        </Button>
        <Button onClick={reset} variant="ghost" disabled={training}>
          <Recycle size={14} />
          重置
        </Button>
        <span className="ml-auto font-mono text-[11px] text-faint">
          第 {stepCount} 步
          {lossHist.length > 0 && ` · loss ${lossHist[lossHist.length - 1]!.loss.toFixed(3)}`}
        </span>
      </div>

      {/* loss 曲线 */}
      {chart ? (
        <div>
          <div className="mb-1 flex justify-between font-mono text-[10px] text-faint">
            <span>loss 高(loss ≈ {chart.hi.toFixed(2)})</span>
            <span>期望:一路向下</span>
            <span>loss 低(loss ≈ {chart.lo.toFixed(2)})</span>
          </div>
          <svg viewBox={`0 0 ${chart.W} ${chart.H}`} className="h-28 w-full rounded-lg border border-line bg-surface">
            <polyline points={chart.pts} fill="none" stroke="var(--color-acc-blue-fg)" strokeWidth={1.8} />
          </svg>
        </div>
      ) : (
        <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-line text-[11.5px] text-faint">
          点击「训练 10 步」开始 —— 你会看到 loss 从高处快速下落
        </div>
      )}

      {err && <Notice tone="error">{err}</Notice>}

      {/* 生成区 */}
      <div className="rounded-lg border border-line bg-surface p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11.5px] font-medium text-muted">生成测试</span>
          <label className="flex items-center gap-2 font-mono text-[11px] text-faint">
            温度
            <input
              type="range"
              min={0}
              max={1.6}
              step={0.05}
              value={temperature}
              onChange={(e) => setTemperature(+e.target.value)}
              className="w-24 accent-[--color-ink]"
            />
            <span className="w-8 text-right text-muted">{temperature.toFixed(2)}</span>
          </label>
        </div>
        <div className="flex gap-2">
          <input
            className="h-8 min-w-0 flex-1 rounded-md border border-line bg-canvas px-2.5 font-mono text-[12.5px] text-ink outline-none focus:border-line-strong"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="输入开头……"
          />
          <Button onClick={doGenerate}>
            <Play size={13} weight="fill" />
            生成
          </Button>
        </div>

        {genText && (
          <div className="mt-3 rounded-md bg-canvas/70 p-3 font-mono text-[12.5px] leading-relaxed">
            <span className="text-faint">{genSteps.length === 0 ? genText : genText.slice(0, prompt.length)}</span>
            <span className="text-ink"> {genText.slice(prompt.length)}</span>
          </div>
        )}

        {genSteps.length > 0 && (
          <div className="mt-3 space-y-1">
            <div className="text-[10.5px] font-medium text-faint">逐 token 决策:</div>
            {genSteps.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-7 shrink-0 font-mono text-[10px] text-faint">{i + 1}</span>
                <span className="w-10 shrink-0 rounded bg-surface-mute px-1 py-0.5 text-center font-mono text-[11px] text-ink">
                  {s.token === " " ? "␣" : s.token}
                </span>
                <div className="h-2 w-56 overflow-hidden rounded-full bg-line">
                  <div
                    className={cn("h-full rounded-full", s.prob > 0.4 ? "bg-acc-green-fg" : s.prob > 0.1 ? "bg-acc-yellow-fg" : "bg-acc-blue-fg")}
                    style={{ width: `${s.prob * 100}%` }}
                  />
                </div>
                <span className="font-mono text-[10px] text-faint">{(s.prob * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}