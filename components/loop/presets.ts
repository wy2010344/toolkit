export interface LoopPreset {
  id: string;
  name: string;
  desc: string;
  code: string;
}

export const LOOP_PRESETS: LoopPreset[] = [
  {
    id: "full",
    name: "标准链路",
    desc: "澄清循环 + 拆分判定 + 拆分执行循环,含失败重试上限回退。",
    code: `flowchart TD
    subgraph SCL["澄清循环 · Clarify Loop"]
        direction TB
        start(["用户提交一个任务"]) --> review{"AI 审查<br/>目标清晰 · 约束齐全 · 可验证?"}
        review -- "有缺口 · 质疑" --> critique["AI 提出质疑<br/>追问目标 / 边界 / 验收标准"]
        critique --> revise["用户修订任务"]
        revise --> review
    end

    review -- "无疑问 · 通过" --> judge{"值得拆分为<br/>子任务?"}

    subgraph SEX["拆分与执行循环 · Split & Execute Loop"]
        direction TB
        judge -- "是 · 拆分" --> split["生成子任务清单<br/>attempt + 1"]
        judge -- "否 · 直接执行" --> exec["直接执行"]
        split --> run["子任务分别执行"]
        run --> anyErr{"有子任务<br/>出错?"}
        anyErr -- "否" --> merge(["汇总结果"])
        exec --> merge
        anyErr -- "是 · 抛出错误" --> err["捕获错误 · 分析失败原因"]
        err --> cap{"attempt &lt; 上限?"}
        cap -- "否 · 达上限" --> escalate["带着失败报告<br/>回到澄清"]
        cap -- "是" --> resplit["重新拆分 · 换一种拆法"]
        resplit --> split
    end

    escalate --> critique
    merge --> done(["任务交付"])`,
  },
  {
    id: "clarify",
    name: "澄清循环特写",
    desc: "只保留「用户 ⇄ AI」的质疑-修订回路。",
    code: `flowchart LR
    A(["任务草案"]) --> B{"AI 审查<br/>目标 · 约束 · 可验证?"}
    B -- "有缺口" --> C["AI 提出质疑"]
    C --> D["用户修订任务"]
    D --> B
    B -- "无疑问" --> E(["定稿 · 进入执行"])`,
  },
  {
    id: "execute",
    name: "拆分执行循环特写",
    desc: "只保留「拆分 → 执行 → 出错 → 重拆分」的重试回路。",
    code: `flowchart TD
    A{"值得拆分为<br/>子任务?"}
    A -- "否" --> B["直接执行"]
    A -- "是" --> C["拆分 · attempt + 1"]
    C --> D["子任务分别执行"]
    D --> E{"全部成功?"}
    E -- "是" --> F(["完成"])
    E -- "否 · 抛出错误" --> G["捕获错误 · 分析原因"]
    G --> H{"attempt &lt; 上限?"}
    H -- "是" --> C
    H -- "否" --> I["回到澄清循环"]
    B --> F`,
  },
];