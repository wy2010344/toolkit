/**
 * 对话树的数据类型。
 *
 * 一条「会话」不是线性的 message[]，而是一棵以提问为节点的树：
 * 每个节点保存一次提问 + 它得到的回答；同一个父节点可以有多个子节点，
 * 于是「换个问法」「重新生成」「分支追加」都只是长出一个新的兄弟分支。
 */

export type TreeDirection = "LR" | "TB";

export type FollowUpMode = "continue" | "regenerate";

export interface ChatNode {
  id: string;
  /** null 表示这是一次会话的开场提问（根）。 */
  parentId: string | null;
  /** 用户在这一节点上的提问全文。 */
  prompt: string;
  /** 模型对该提问的回答，轻量 Markdown。 */
  answer: string;
  model: string;
  /** 静态展示用时间，避免服务端/客户端因 Date.now() 产生水合差异。 */
  time: string;
  date: string;
  /** 角标：如「换思路」「重新生成」「总结」。 */
  badge?: string;
  starred?: boolean;
  /** 折叠该节点的子树（只影响视图，不删除数据）。 */
  collapsed?: boolean;
  /** 由本地模板生成的演示回答，界面上会明确标注。 */
  synthetic?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  /** 左侧列表的分组标签。 */
  group: "今天" | "昨天" | "更早";
  updated: string;
  nodes: ChatNode[];
}

export interface PersistedState {
  conversations: Conversation[];
  activeConvId: string;
  selectedId: string | null;
  direction: TreeDirection;
}
