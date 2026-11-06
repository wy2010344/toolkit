import type { FollowUpMode } from "./types";

/**
 * 演示用的「假回答」生成器。
 * 这个工具不接任何模型 API：追加分支是真实的数据操作，回答只是一段
 * 明确标注过的本地模板文本，用来把树的形状变化展示清楚。
 */
export function makeDemoAnswer(prompt: string, parentPrompt: string, mode: FollowUpMode): string {
  const trimmed = prompt.trim().replace(/\s+/g, " ");
  const short = trimmed.length > 60 ? `${trimmed.slice(0, 60)}…` : trimmed;
  const relation =
    mode === "regenerate"
      ? `这是对「${parentPrompt.slice(0, 40)}${parentPrompt.length > 40 ? "…" : ""}」的**另一种问法**，因此和原有回答并列成一个兄弟分支。`
      : `它挂在「${parentPrompt.slice(0, 40)}${parentPrompt.length > 40 ? "…" : ""}」下面，成为一条新的追问；之前的兄弟分支一条都不会被覆盖。`;

  return [
    "> **演示回答**：本段由浏览器本地模板生成，不是模型真实输出。用来展示新增分支如何落进对话树。",
    "",
    `你这次问的是：**${short}**`,
    "",
    relation,
    "",
    "在真实的接入里，这一步应该：",
    "",
    "1. 把「根 → 当前节点」这条追问链单独取出来作为上下文，而不是整个会话的全量记录；",
    "2. 用同一个 `parentId` 追加新节点，保留所有兄弟分支；",
    `3. 记录模型、时间与分支动机（本次是「${mode === "regenerate" ? "换个问法" : "继续追问"}」）。`,
    "",
    "试着再点几个节点：右侧的追问链会跟着变，而左边这棵树始终完整保留。",
  ].join("\n");
}
