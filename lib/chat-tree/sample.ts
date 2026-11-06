import type { ChatNode, Conversation } from "./types";

/**
 * 演示数据：刻意做出「一处提问长出多条分支」的形状，
 * 用来说明线性聊天记录丢掉的东西 —— 分支、重生成、以及从根到任意节点的追问链。
 */

type NodeSeed = Omit<ChatNode, "model" | "date" | "time"> & Partial<Pick<ChatNode, "model" | "date" | "time">>;

function makeNodes(seeds: NodeSeed[], defaults: { model: string; date: string }): ChatNode[] {
  return seeds.map((s, i) => ({
    model: defaults.model,
    date: defaults.date,
    time: s.time ?? `${String(9 + Math.floor(i / 4)).padStart(2, "0")}:${String(12 + ((i * 7) % 45)).padStart(2, "0")}`,
    ...s,
  }));
}

const rustNodes = makeNodes(
  [
    {
      id: "q1",
      parentId: null,
      prompt: "把 TS 的 canvasRender2 干净复刻到 Rust，先帮我拆一下模块边界？",
      time: "09:12",
      answer: `先别急着搬代码。TS 那边其实是三层，边界比文件名更清楚：

1. **类型层**：\`Fc\` / \`TFc\` 描述「一个可渲染的东西」，\`children\` 是 \`Vec<Fc>\`；
2. **树层**：声明式地把 children 组装成一棵树，渲染时只做遍历；
3. **绘制层**：拿到树之后按层序调用 canvas 指令。

Rust 里最容易翻车的是第 1 层：所有权会让 TS 那种随手 clone 的写法直接不成立。**建议先原样复刻类型语义**（children 保持 Vec<Fc>），再谈生命周期优化。`,
    },
    {
      id: "q2",
      parentId: "q1",
      prompt: "Fc 和 TFc 到底该怎么映射？children 必须是 Vec<Fc> 吗？",
      time: "09:18",
      answer: `必须。\`Vec<Fc>\` 不只是容器类型，它决定了三件事：

- 子节点是**有序**的，绘制顺序等同于声明顺序；
- 一个 \`Fc\` 可以被放进不同父节点（TS 里靠结构共享）；
- \`for_each\` 展开后的结果仍然是 \`Vec<Fc>\`，而不是另一种迭代器类型。

\`TFc\` 是「构造 \`Fc\` 的函数/模板」那一层，Rust 里用泛型函数或 \`enum\` 都可以承载，但它不该改变 children 的类型。一旦把 children 换成 \`Vec<Box<dyn Node>>\`，语义就从「声明式树」滑向「运行时多态」了。`,
    },
    {
      id: "q3",
      parentId: "q2",
      prompt: "那如果我想支持 for_each 呢？会不会把 Vec 拆散？",
      time: "09:24",
      answer: `不会。把 \`for_each\` 理解成**一个产生 \`Vec<Fc>\` 的普通节点**就行：

\`\`\`rust
fn for_each<T>(items: impl IntoIterator<Item = T>, f: impl Fn(&T) -> Fc) -> Fc {
    Fc::group(items.into_iter().map(|it| f(&it)).collect())
}
\`\`\`

它输出 \`Vec<Fc>\` 并塞进一个 group 节点，父节点看到的仍然是「一个 child」。关键是**保持树节点与批量构造器分离**，别在 \`Fc\` 里塞一个迭代器字段。`,
    },
    {
      id: "q4",
      parentId: "q2",
      prompt: "先别改代码，画一下 RSX 展开后的树形结构",
      badge: "换角度",
      time: "09:31",
      answer: `好，用一棵树来看更直观：

\`\`\`
Root
├─ Canvas(style)
│  ├─ Rect
│  └─ Group(for_each 3 项)
│     ├─ Text("a")
│     ├─ Text("b")
│     └─ Text("c")
└─ Overlay
\`\`\`

注意 \`for_each\` 在展开之后就**消失**了，树里只剩普通节点。这也是为什么渲染器不需要知道「循环」这个概念 —— 它只遍历 \`Vec<Fc>\`。`,
    },
    {
      id: "q5",
      parentId: "q1",
      prompt: "换成保留 RSX 的方案，代价是什么？",
      badge: "分支 B",
      time: "09:38",
      model: "GPT-5.1",
      answer: `可以共存，但要认清代价：

- **宏展开是编译期的**：RSX 写起来像声明式树，展开后仍是同一套 \`Fc\`；好处是零运行时开销。
- **类型报错会变难读**：宏内部的错误位置常常指向调用点，调试体验比直接构造 \`Fc\` 差。
- **动态分支受限**：\`for_each\` 需要宏里专门设计一块拼接语法，容易长成第二套 DSL。

如果目标是「接近 ooc 的函数式声明式写法」，我更倾向**先把手写树做对，再让 RSX 只是一层语法糖**。`,
    },
    {
      id: "q6",
      parentId: "q1",
      prompt: "重新生成上一版回答，别用「三层」这个框架，直接给落地顺序",
      badge: "重新生成",
      time: "09:41",
      answer: `按落地顺序，不分类：

1. 先把 TS 的 \`Fc\` / \`TFc\` 逐字段抄成 Rust 类型，children 用 \`Vec<Fc>\`；
2. 写一个只打印树结构的 \`render\` 占位实现，验证构造顺序；
3. 补 \`for_each\`，确认它返回 \`Vec<Fc>\` 而不是新类型；
4. 接上真实绘制，逐项对照 TS 输出快照；
5. 最后才考虑 \`Rc\` / 借用 / 缓存。

**第 2 步别跳过**：只看类型能通过编译，但运行时树形不对时，后面全要返工。`,
    },
    {
      id: "q7",
      parentId: "q3",
      prompt: "给个最小可编译的骨架，只要类型和 for_each",
      badge: "代码",
      time: "09:47",
      answer: `最小骨架（刻意不做任何优化）：

\`\`\`rust
#[derive(Clone)]
pub enum Fc {
    Node { kind: &'static str, children: Vec<Fc> },
    Text(String),
}

pub type TFc<T> = fn(&T) -> Fc;

pub fn for_each<T, I>(items: I, f: TFc<T>) -> Fc
where
    I: IntoIterator<Item = T>,
{
    Fc::Node {
        kind: "group",
        children: items.into_iter().map(|it| f(&it)).collect(),
    }
}
\`\`\`

\`children\` 是 \`Vec<Fc>\`，\`TFc\` 是构造函数类型 —— 和 TS 的两层语义一一对应。`,
    },
    {
      id: "q8",
      parentId: "q3",
      prompt: "不用泛型，能不能用 trait object 把 for_each 抹平？",
      badge: "换思路",
      time: "09:53",
      answer: `能，但会丢掉 TS 那边的语义：

\`Box<dyn Fn(&T) -> Fc>\` 让每个 child 变成动态分发，\`Fc\` 也从「数据」变成「数据 + 行为」。后果是：

- 树不再能简单地 \`Clone\` / 比较结构；
- 快照测试和 SSR 之类的纯数据用法要做额外包装；
- \`for_each\` 的返回类型开始和调用点耦合。

如果只是嫌泛型签名长，用 \`impl Fn\` 或类型别名就够了，不必上 trait object。`,
    },
    {
      id: "q9",
      parentId: "q4",
      prompt: "和 ooc 的声明式树差在哪？",
      time: "10:02",
      answer: `差在**「树是值」这一点的彻底程度**：

- ooc 里组件调用直接返回树值，父子关系由函数嵌套表达，没有额外的 build 阶段；
- 当前 RSX 方案里宏先产出一段构造代码，再运行得到树，中间多了一层展开；
- 两者渲染期可以完全一样，差别全在**构造期**。

所以迁移的重点不是渲染器，而是让「写下来的结构」和「运行时的树」尽量重合。`,
    },
    {
      id: "q10",
      parentId: "q5",
      prompt: "能不能两者共存，做一个适配层？",
      time: "10:16",
      answer: `可以，适配层放在**宏的出口**，不要放在渲染器里：

\`RSX → Fc → (可选的手写 Fc) → 统一的 render\`

这样手写树和 RSX 产出的树是同一个类型，可以混着嵌。要守住的只有一条：**适配层不能引入第二种 children 类型**，否则分支一多就得维护两套遍历逻辑。`,
    },
    {
      id: "q11",
      parentId: "q9",
      prompt: "把差异整理成待办清单，按优先级排",
      badge: "总结",
      time: "10:42",
      answer: `按「先保证语义、再优化体验」排：

1. \`Fc\` / \`TFc\` 逐字段对齐，children 固定 \`Vec<Fc>\`；
2. \`for_each\` 返回 group 节点，渲染器不感知循环；
3. 用树结构快照对比 TS 与 Rust 的展开结果；
4. RSX 宏只做语法糖，出口仍产出 \`Fc\`；
5. 最后再评估 \`Rc\` / 借用与缓存。

> 前三项做完之前不要动渲染层 —— 类型对了但树形错了，是最难查的一类偏差。`,
      starred: true,
    },
  ],
  { model: "Claude Sonnet 4.5", date: "2026-11-06" },
);

const climateNodes = makeNodes(
  [
    {
      id: "c1",
      parentId: null,
      prompt: "云南旅居，除了气温，湿度和体感到底该占多大权重？",
      time: "08:30",
      answer: `如果目标是「长期住着舒服」，而不是「旅游那几天舒服」，建议先把权重摆正：

- **气温 50%**：决定基础舒适区间；
- **湿度 25%**：主要通过体感温度放大冷热，雨季尤其明显；
- **日照 / 风速 25%**：影响晾晒、霉变和昼夜感受。

单纯按年均温排序会把干热河谷排得过高，因为忽略了湿球效应。`,
    },
    {
      id: "c2",
      parentId: "c1",
      prompt: "那体感温度用哪个公式比较稳？",
      time: "08:36",
      answer: `日常尺度用 **Heat Index / 体感温度的经验式**就够，输入是气温 + 相对湿度：

\`\`\`
HI = f(T, RH)   // 高温段用 Rothfusz 回归式，低温段换成风寒指数
\`\`\`

关键是**分段**：同一条公式在 12°C 和 32°C 下的误差方向相反。做城市对比时逐日算完再取分位数，比先平均气温再算体感靠谱得多。`,
    },
    {
      id: "c3",
      parentId: "c2",
      prompt: "把逐日算完再取分位数这条，展开讲讲",
      time: "08:44",
      answer: `因为平均会抹掉极端值。步骤是：

1. 对每天的气温 / 湿度算一次体感；
2. 得到 365 个值，统计 **P10 / P50 / P90**；
3. 宜居度用「落在 18–26°C 区间的天数占比」+「P90 超温惩罚」。

这样两个年均温相同的城市，一个全年平稳、一个雨季闷热，会明显拉开。`,
    },
    {
      id: "c4",
      parentId: "c1",
      prompt: "换个角度：如果我最怕的是回南天和霉变呢？",
      badge: "换角度",
      time: "08:52",
      model: "GPT-5.1",
      answer: `那排序依据要从「温度」换成**连续高湿天数**：

- 统计 RH > 80% 的**最长连续段**，而不是总天数；
- 叠加日照时数，判断潮湿之后能不能自己干回去；
- 单看月均湿度会漏掉「一周闷湿 + 三周干爽」这种组合。

这个口径下，海拔较高、昼夜温差大且日照足的地方会明显靠前。`,
    },
    {
      id: "c5",
      parentId: "c4",
      prompt: "给我三个候选城市，用这个口径排一下",
      time: "09:02",
      answer: `按「连续高湿段 + 日照」粗排（示意，非实测结论）：

1. **大理**：雨季有连续湿段，但日照恢复快；
2. **昆明**：温度平稳，湿段短；
3. **建水**：冬季舒适，夏季湿热段更长。

真正落地时把逐日数据接进 \`lib/climate/\` 的评分函数，用同一套权重跑一遍即可。`,
    },
    {
      id: "c6",
      parentId: "c2",
      prompt: "高温段和低温段的分界取多少度合适？",
      badge: "追问细节",
      time: "09:15",
      answer: `经验上 **26°C** 作为切换点比较稳：之上用热指数（湿度放大热），之下转风寒 / 湿冷修正（湿度放大冷）。中间 20–26°C 是舒适区，两套公式的差异都很小，硬切也不会造成排名跳变。`,
    },
  ],
  { model: "Claude Sonnet 4.5", date: "2026-11-06" },
);

const dftNodes = makeNodes(
  [
    {
      id: "d1",
      parentId: null,
      prompt: "给完全不懂信号的人讲 DFT，能不能一句公式都不写？",
      time: "16:20",
      answer: `可以，只需要一个动作：**乘起来，再求和**。

想象你有一排不同音高的音叉。把一段录音分别和每根音叉「对一对」：声音合拍时乘积大多是正的，加起来是个大数；不合拍时正负抵消，加起来接近零。哪个音叉得分高，录音里就藏着哪个频率。`,
    },
    {
      id: "d2",
      parentId: "d1",
      prompt: "「合拍」为什么会让乘积大多是正的？",
      time: "16:27",
      answer: `同号相乘得正：两列波同起同落，波峰对波峰、波谷对波谷（波谷是负 × 负，还是正）。不同频时，一会儿对上一会儿错开，正贡献和负贡献轮流出现，求和就互相抵消了。

所以 DFT 里的「探针」不是滤波器，更像一把**同时量所有频率的尺子**。`,
    },
    {
      id: "d3",
      parentId: "d2",
      prompt: "那为什么还要复数和相位？",
      time: "16:34",
      answer: `因为一根探针可能正好卡在「错开四分之一周期」的位置，实部得分会变成 0，但信号明明存在。补一根错开 90° 的探针，两根合起来就能既测出**有多强**，又测出**从哪儿开始** —— 这就是幅度与相位。`,
    },
    {
      id: "d4",
      parentId: "d1",
      prompt: "换个讲法：用颜色或图像来比喻？",
      badge: "换讲法",
      time: "16:41",
      answer: `把频谱想成**一盒按音高排好的颜料**：任何一段声音都是这盒颜料调出来的。DFT 做的事，就是拿一组标准色卡去比对，算出每种颜料放了多少。逆变换则是按这个配方把颜料重新调回原来的声音。`,
    },
    {
      id: "d5",
      parentId: "d4",
      prompt: "这个比喻在什么地方会失效？",
      time: "16:49",
      answer: `在**相位**上。颜料混合不看先后，但波形叠在一起时，各频率的起始位置会改变形状。所以「配方」必须记两列：放多少 + 从哪儿开始。只记第一列，还原出来的是同一堆频率、却不是同一段声音。`,
    },
  ],
  { model: "Claude Sonnet 4.5", date: "2026-11-05" },
);

const readingNodes = makeNodes(
  [
    {
      id: "r1",
      parentId: null,
      prompt: "读完一本书，笔记总变成摘抄堆，怎么改成问题驱动？",
      time: "21:05",
      answer: `把每条笔记改写成「一个问题 + 一个回答」：读完一章只写下**这章替我回答了什么**，而不是抄下说得漂亮的句子。摘抄可以留作附录，但不再充当骨架。`,
    },
    {
      id: "r2",
      parentId: "r1",
      prompt: "具体一点的模板？",
      time: "21:12",
      answer: `每章四行：

\`\`\`
Q: 作者想解决什么？
A: ...
反例: 什么时候这个说法不成立？
钩子: 它和我哪条旧笔记冲突？
\`\`\`

最后一行最重要 —— 笔记之间有了连线，才不会退化成孤岛。`,
    },
    {
      id: "r3",
      parentId: "r2",
      prompt: "那这些「钩子」怎么维护？",
      time: "21:20",
      answer: `每条笔记一个稳定 id，钩子存 id 而不是标题。这样重命名不影响连线，久了自然长成一张网 —— 和对话追问树其实是同一个结构：**一个提问可以连着多个后续，但每次回溯都能沿着一条链走回去**。`,
    },
    {
      id: "r4",
      parentId: "r3",
      prompt: "一句话总结这套方法",
      badge: "总结",
      time: "21:28",
      answer: `> 不要收藏别人的结论，要收藏自己被解决的问题；再把问题之间连起来。`,
    },
  ],
  { model: "Claude Sonnet 4.5", date: "2026-11-02" },
);

export const SAMPLE_CONVERSATIONS: Conversation[] = [
  { id: "conv-rust", title: "wy-mve · canvasRender2 迁移", group: "今天", updated: "10:42", nodes: rustNodes },
  { id: "conv-climate", title: "云南旅居 · 湿度与体感", group: "今天", updated: "09:15", nodes: climateNodes },
  { id: "conv-dft", title: "不用公式讲清楚 DFT", group: "昨天", updated: "16:49", nodes: dftNodes },
  { id: "conv-reading", title: "问题驱动的读书笔记", group: "更早", updated: "21:28", nodes: readingNodes },
];
