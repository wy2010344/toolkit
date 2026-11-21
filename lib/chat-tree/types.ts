/**
 * 对话树的数据类型。
 *
 * 一条「会话」不是线性的 message[]，而是一棵以提问为节点的树。
 * 只有两种操作：
 * - 追问 = 在当前节点下长出子节点，沿着对话继续往下问；
 * - 修改 = 编辑当前这一问（自动填入原问题供改写），产出新版本。
 *   版本不是子节点，而是与提问平级的一条链，各自带自己的后继树。
 */

export type TreeDirection = "LR" | "TB";

/** continue: 当前节点下长出子节点；revise: 编辑这一问并产出新版本。 */
export type FollowUpMode = "continue" | "revise";

/** 这一问的一次版本：记录当时的问题与回答；只有展开时才临时进入画布布局。 */
export interface Revision {
  id: string;
  /** 这一版的问题全文（修改 = 编辑问题，所以每版各记各的）。 */
  prompt: string;
  answer: string;
  model: string;
  time: string;
  date: string;
  /** 这次修改的动机，如「首次提问」「修改」。 */
  reason: string;
  /** 由本地模板生成的演示回答。 */
  synthetic?: boolean;
  /** 回答正在流式生成中：界面显示逐字增长与生成中状态。 */
  pending?: boolean;
}

/**
 * 画布上的「版本伪节点」引用：指向某次提问的第 index 个回答版本。
 * 只存在于派生出来的显示节点上，不写回会话数据，也不参与真实树运算。
 */
export interface RevisionRef {
  ownerId: string;
  index: number;
}

export interface ChatNode {
  id: string;
  /** 仅派生节点有值；有值时它是回答版本，不是一次新的提问。 */
  revisionRef?: RevisionRef;
  /** null 表示这是一次会话的开场提问（根）。 */
  parentId: string | null;
  /** 最初是在父提问的哪一版之后追问的 —— 永久锚点，跟随失败 / 放弃跟随后回到这一版。 */
  parentRevision?: number;
  /**
   * 用户显式批准跟随到父提问的哪一版。
   * 只有它等于父节点当前版时才生效；当前版换了一版就自动失效，需要重新批准。
   * 默认没有值 = 不跟随，后继留在 parentRevision 那一版（灰显）。
   */
  followRevision?: number | null;
  /**
   * 派生显示状态（不写回存档）：
   * archived = 挂在历史版本下的分支（含后代），整棵置灰；
   * following = 已批准跟随当前版的子树根。
   */
  versionState?: "archived" | "following";
  /** 用户在这一节点上的提问全文。 */
  prompt: string;
  /** 当前展示的回答（等价于 revisions[activeRevision]?.answer）。 */
  answer: string;
  model: string;
  /** 静态展示用时间，避免服务端/客户端因 Date.now() 产生水合差异。 */
  time: string;
  date: string;
  /** 折叠该节点的子树（只影响视图，不删除数据）。 */
  collapsed?: boolean;
  /** 标记为不重要的分支：自身及整棵子树默认灰显，可在工具栏进一步过滤。 */
  hidden?: boolean;
  /** 回答版本历史；缺省表示单版本。 */
  revisions?: Revision[];
  /** 当前展示的版本下标，默认 0。 */
  activeRevision?: number;
  /** 由本地模板生成的演示回答，界面上会明确标注。 */
  synthetic?: boolean;
  /** 回答正在流式生成中。 */
  pending?: boolean;
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
  /** 是否从画布过滤掉标记隐藏的分支（默认否：仅灰显，仍可见）。 */
  filterHidden: boolean;
  /** 展开了版本链的提问 id，随视图一起保存。 */
  expandedVersions: string[];
}
