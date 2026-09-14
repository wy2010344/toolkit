/**
 * LLM 实验室主界面:左侧大纲 + 右侧当前视图。
 * id 0 是「架构总览」交互图,1~8 是分模块课程。
 */
"use client";

import { useState } from "react";
import { LessonSidebar } from "./LessonSidebar";
import { LESSON_COMPONENTS } from "./lessons";
import { ArchitectureMap } from "./ArchitectureMap";

export function LlmLabApp() {
  const [active, setActive] = useState(0);
  const Active = LESSON_COMPONENTS[active] ?? null;

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-canvas">
      <LessonSidebar active={active} onSet={setActive} />
      <main className="min-w-0 flex-1 overflow-y-auto">
        {active === 0 ? (
          <ArchitectureMap key="arch" onGoLesson={(n) => setActive(n)} />
        ) : (
          <Active key={active} />
        )}
      </main>
    </div>
  );
}