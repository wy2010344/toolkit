import { answerOf } from "./tree";
import type { ChatNode } from "./types";

/**
 * 本地回退模板：模型调用失败时用来兜底，明确标注为「本地模板」。
 * 正常追加追问 / 修改会走真实模型 API，这里只在断网或限流时接管。
 */
export function makeDemoAnswer(prompt: string, parentPrompt: string): string {
  const trimmed = prompt.trim().replace(/\s+/g, " ");
  const short = trimmed.length > 60 ? `${trimmed.slice(0, 60)}…` : trimmed;
  const parent = parentPrompt.slice(0, 40) + (parentPrompt.length > 40 ? "…" : "");

  return [
    "> **演示回答**：本段由浏览器本地模板生成，不是模型真实输出。",
    "",
    `你这次问的是：**${short}**`,
    "",
    `它挂在「${parent}」下面，成为一条新的追问；原有的分支一条都不会被覆盖。`,
    "",
    "在真实的接入里，这一步应该：",
    "",
    "1. 把「根 → 当前节点」这条追问链单独取出来作为上下文，而不是整个会话的全量记录；",
    "2. 给新节点记下 `parentId` 与所跟随的父版本，保留其他版本各自的后继树；",
    "3. 记录模型与时间，追问本身不会改写原来那一问。",
    "",
    "试着再点几个节点：画布上的追问链高亮会跟着变，而这棵树始终完整保留。",
  ].join("\n");
}

/** 「修改」不新增节点：记录编辑后的问题，并给这一问追加一个新版本。 */
export function makeRevisionAnswer(node: ChatNode, prompt: string): string {
  const current = answerOf(node);
  const lead = current.answer.trim().replace(/\s+/g, " ").slice(0, 76);
  return [
    "> **演示回答**：本段由浏览器本地模板生成，不是模型真实输出。这是「修改」产生的**新版本**，旧版本保留下来；点节点上的 vN 角标会以虚线节点展开，逐版看问题是怎么改的。",
    "",
    `编辑后的问题：**${prompt.trim()}**`,
    "",
    `上一版开头：${lead}${current.answer.trim().length > 76 ? "…" : ""}`,
    "",
    "这一版换一种组织方式：",
    "",
    "1. 先给结论，再补理由；",
    "2. 把最容易踩坑的一条放在最前面；",
    "3. 结尾给一个可立即执行的下一步。",
    "",
    "版本与当前提问平级、用箭头串起来；每个版本各自带自己的后继树 —— 这是「修改」与「追问」的核心区别。",
  ].join("\n");
}
