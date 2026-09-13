/**
 * 生成实验面板:三种主流采样策略在同一个模型上对比。
 *  - 贪心(greedy):每步选概率最大的 token —— 最稳,但呆板、爱重复;
 *  - 温度(temperature):按概率随机抽,温度越高越"发散";
 *  - Top-k:先把候选砍到概率最高的 k 个,再按比例抽(白眼名单)。
 */
"use client";

import { useMemo, useRef, useState } from "react";
import { Play, Recycle } from "@phosphor-icons/react/dist/ssr";
import { Button, cn } from "@/components/ui";
import { TRAIN_CONFIG, type LLMConfig } from "@/lib/llm/config";
import { sample, softmax } from "@/lib/llm/math";
import { createWeights, nextTokenProbs } from "@/lib/llm/model";
import { precomputeRope } from "@/lib/llm/embeddings";
import { makeCharSession } from "@/lib/llm/data";

type Strategy = "greedy" | "temperature" | "topk";

interface GenStep {
  chosen: { token: string; prob: number };
  top: Array<{ tokenId: number; token: string; prob: number }>;
  entropy: number;
}

export function GenerationPanel({
  corpus,
  config = TRAIN_CONFIG,
  defaultPrompt = "我喜欢",
}: {
  corpus: string;
  config?: LLMConfig;
  defaultPrompt?: string;
}) {
  const { session, weights } = useMemo(() => {
    const s = makeCharSession(config, corpus);
    return { session: s, weights: createWeights(config) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

const [prompt, setPrompt] = useState(defaultPrompt);
  const [strategy, setStrategy] = useState<Strategy>("greedy");
  const [temperature, setTemperature] = useState(0.9);
  const [k, setK] = useState(3);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const reqRef = useRef(0);

  const [steps, setSteps] = useState<GenStep[]>([]);

  const doGenerate = () => {
    if (!prompt) return;
    setErr("");
    const reqId = ++reqRef.current;
    const rope = precomputeRope(config);
    const ids = session.encode(prompt);
    const chunk: GenStep[] = [];
    let out = prompt;
    try {
      for (let i = 0; i < 20; i++) {
        if (reqRef.current !== reqId) return;
        if (ids.length >= config.maxSeqLen) break;
        const { probs, logits, entropy } = nextTokenProbs(ids, config, weights, rope);

        // —— 三种策略对"下一个 token 分布"的不同处理 ——
        let dist: Float32Array;
        let chosen: number;
        if (strategy === "greedy") {
          let best = 0;
          for (let t = 0; t < probs.length; t++) if (probs[t]! > probs[best]!) best = t;
          const oneHot = new Float32Array(probs.length);
          oneHot[best] = 1;
          dist = oneHot;
          chosen = best;
        } else if (strategy === "temperature") {
          dist = temperatureProbs(logits, temperature);
          chosen = sample(dist);
        } else {
          // top-k:只保留前 k 个候选,重归一化后再按概率抽。
          const ranked = Array.from({ length: probs.length }, (_, t) => t).sort((a, b) => probs[b]! - probs[a]!);
          const keep = ranked.slice(0, Math.max(1, k));
          const filtered = new Float32Array(probs.length);
          for (const t of keep) filtered[t] = probs[t]!;
          dist = filtered;
          chosen = sample(dist);
        }

        const token = session.decode([chosen]);
        out += token;
        ids.push(chosen);

        const top = Array.from({ length: probs.length }, (_, t) => t)
          .sort((a, b) => probs[b]! - probs[a]!)
          .slice(0, 3)
          .map((t) => ({ tokenId: t, token: session.decode([t]), prob: distortion(t, dist, probs[t]!) }));

        chunk.push({ chosen: { token, prob: dist[chosen]! }, top, entropy });
      }
      setText(out);
      setSteps(chunk);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const reset = () => setSteps([]);

  const perStratLabel = {
    greedy: "每步必取概率最高",
    temperature: "按概率随机,温度越高越发散",
    topk: `只在前 ${Math.max(1, Math.min(k, 3))} 名里随机`,
  }[strategy];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["greedy", "贪心"],
            ["temperature", "温度"],
            ["topk", "Top-k"],
          ] as Array<[Strategy, string]>
        ).map(([s, label]) => (
          <button
            key={s}
            onClick={() => setStrategy(s)}
            className={cn(
              "rounded-md px-2.5 py-1.5 font-mono text-[11px] transition-colors",
              strategy === s ? "bg-ink text-white" : "border border-line bg-surface text-muted",
            )}
          >
            {label}
          </button>
        ))}

        {strategy === "temperature" && (
          <label className="flex items-center gap-2 font-mono text-[11px] text-faint">
            温度
            <input type="range" min={0.2} max={1.6} step={0.05} value={temperature}
              onChange={(e) => setTemperature(+e.target.value)} className="w-20 accent-[--color-ink]" />
            <span className="w-7 text-right text-muted">{temperature.toFixed(2)}</span>
          </label>
        )}
        {strategy === "topk" && (
          <label className="flex items-center gap-2 font-mono text-[11px] text-faint">
            K
            <input type="range" min={1} max={6} step={1} value={k}
              onChange={(e) => setK(+e.target.value)} className="w-20 accent-[--color-ink]" />
            <span className="w-7 text-right text-muted">{k}</span>
          </label>
        )}
        <span className="ml-auto text-[10.5px] text-faint">{perStratLabel}</span>
      </div>

      <div className="flex gap-2">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="h-8 min-w-0 flex-1 rounded-md border border-line bg-surface px-2.5 font-mono text-[12.5px] text-ink outline-none focus:border-line-strong"
        />
        <Button onClick={doGenerate}>
          <Play size={13} weight="fill" />
          生成
        </Button>
        <Button variant="ghost" onClick={reset}>
          <Recycle size={14} />
        </Button>
      </div>

      {err && <div className="rounded-md border border-acc-red-fg/30 bg-acc-red-bg/50 px-3 py-2 text-[12px] text-acc-red-fg">{err}</div>}

      {text && (
        <div className="rounded-md bg-canvas/70 p-3 font-mono text-[12.5px] leading-relaxed">
          <span className="text-faint">{text.slice(0, prompt.length)}</span>
          <span className="text-ink">{text.slice(prompt.length)}</span>
        </div>
      )}

      {steps.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10.5px] font-medium text-faint">每步的候选与选择(前 3):</div>
          {steps.map((s, i) => {
            const w = s.chosen.token === " " ? "␣" : s.chosen.token;
            return (
              <div key={i} className="rounded-md border border-line bg-surface px-2.5 py-1.5">
                <div className="mb-0.5 flex gap-1">
                  {s.top.map((t, j) => {
                    const isChosen = t.token === s.chosen.token;
                    return (
                      <span key={j}
                        className={cn(
                          "rounded px-1.5 py-0.5 font-mono text-[11px]",
                          isChosen ? "bg-ink text-white" : "bg-surface-mute text-muted",
                        )}
                      >
                        {t.token === " " ? "␣" : t.token} {(t.prob * 100).toFixed(0)}%
                      </span>
                    );
                  })}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-faint">
                  <span>信息熵 {(s.entropy / Math.log(config.vocabSize)).toFixed(2)} / 1.0</span>
                  <span className="ml-auto">选中「{w}」</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function temperatureProbs(logits: Float32Array, temperature: number): Float32Array {
  if (temperature <= 0) {
    const out = new Float32Array(logits.length);
    let best = 0;
    for (let i = 1; i < logits.length; i++) if (logits[i]! > logits[best]!) best = i;
    out[best] = 1;
    return out;
  }
  return softmax(logits.map((x) => x / temperature));
}

/** 展示用:某候选虽然在原始分布里排前 3,其"实际选中概率"按策略而定。 */
function distortion(t: number, dist: Float32Array, rawProb: number): number {
  return dist[t]! > 0 ? dist[t]! : rawProb;
}