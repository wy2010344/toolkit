/**
 * 8 节课的汇总导出,供 LLM 实验室主界面按 id 渲染。
 */
import type { ComponentType } from "react";
import { LlmLesson1 } from "./lesson1";
import { LlmLesson2 } from "./lesson2";
import { LlmLesson3 } from "./lesson3";
import { LlmLesson4 } from "./lesson4";
import { LlmLesson5 } from "./lesson5";
import { LlmLesson6 } from "./lesson6";
import { LlmLesson7 } from "./lesson7";
import { LlmLesson8 } from "./lesson8";

/** 课程序号 → 组件。 */
export const LESSON_COMPONENTS: Record<number, ComponentType> = {
  1: LlmLesson1,
  2: LlmLesson2,
  3: LlmLesson3,
  4: LlmLesson4,
  5: LlmLesson5,
  6: LlmLesson6,
  7: LlmLesson7,
  8: LlmLesson8,
};