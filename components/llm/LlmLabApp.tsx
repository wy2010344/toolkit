/**
 * LLM 实验室主界面:左侧大纲 + 右侧当前课程正文。
 */
"use client";

import { useState } from "react";
import { LessonSidebar } from "./LessonSidebar";
import { LESSON_COMPONENTS } from "./lessons";

export function LlmLabApp() {
  const [active, setActive] = useState(1);
  const Active = LESSON_COMPONENTS[active] ?? LESSON_COMPONENTS[1]!;

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-canvas">
      <LessonSidebar active={active} onSet={setActive} />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <Active key={active} />
      </main>
    </div>
  );
}