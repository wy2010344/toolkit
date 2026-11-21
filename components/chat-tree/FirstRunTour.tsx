"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CursorClick, ListBullets, TreeStructure } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/components/ui";

const TOUR_KEY = "chat-tree-tour-v1";

export function tourSeen(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(TOUR_KEY) === "1";
  } catch {
    return true;
  }
}

export function markTourSeen() {
  try {
    window.localStorage.setItem(TOUR_KEY, "1");
  } catch {
    /* 隐私模式下写不了也无所谓，本次不再提示 */
  }
}

const STEPS = [
  {
    icon: <CursorClick size={17} />,
    title: "点节点，看回答",
    body: "每个节点都是你真的问过的一句话。点开在右侧看回答，继续追问会长出子节点；左边的会话、画布上的节点都支持右键。",
  },
  {
    icon: <ListBullets size={17} />,
    title: "右键就是操作台",
    body: "追问、修改、隐藏、折叠、删除都在节点右键菜单里；左侧会话同样右键重命名或删除。菜单项的说明悬停即见，不占界面。",
  },
  {
    icon: <TreeStructure size={17} />,
    title: "历史版本要批准才跟随",
    body: "「修改」产出与提问平级的版本。历史版本下的追问默认留在那一版并一起置灰；只有右键「跟随到当前版」才会移过去，当前版再换版时要重新批准，放弃跟随会回到最初那一版。",
  },
];

export function FirstRunTour({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step]!;
  const last = step === STEPS.length - 1;

  const close = () => {
    markTourSeen();
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (last) close();
        else setStep((s) => s + 1);
      }
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/30 p-4 backdrop-blur-[2px]" onClick={close}>
      <div
        role="dialog"
        aria-label="首次使用引导"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] rounded-2xl border border-line bg-surface p-5 shadow-[0_24px_70px_-20px_rgba(0,0,0,0.55)]"
      >
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-faint">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ink text-white">{current.icon}</span>
          初次见面 · {step + 1}/{STEPS.length}
        </div>
        <h2 className="mt-4 text-[15px] font-semibold text-ink">{current.title}</h2>
        <p className="mt-2 text-[11.5px] leading-[1.8] text-muted">{current.body}</p>
        <div className="mt-5 flex items-center gap-2">
          <div className="flex flex-1 gap-1">
            {STEPS.map((s, i) => (
              <button
                key={s.title}
                type="button"
                aria-label={`第 ${i + 1} 步`}
                onClick={() => setStep(i)}
                className={cn("h-1 flex-1 rounded-full transition-colors", i === step ? "bg-ink" : "bg-line")}
              />
            ))}
          </div>
          <button type="button" onClick={close} className="px-2 text-[11px] text-faint hover:text-ink">
            跳过
          </button>
          <button
            type="button"
            onClick={() => (last ? close() : setStep((s) => s + 1))}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-ink px-3 text-[11.5px] font-medium text-white"
          >
            {last ? "开始使用" : "下一步"}
            {!last && <ArrowRight size={12} />}
          </button>
        </div>
      </div>
    </div>
  );
}
