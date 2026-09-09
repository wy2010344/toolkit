# 工具箱

本地运行的小工具合集(Next.js 16 App Router + React 19 + Tailwind CSS 4)。

## 运行

```bash
pnpm install
pnpm dev
```

打开 http://localhost:3000。当前包含一个工具:

### 目录对比同步 (`/tools/dir-diff`)

逐文件对比两个目录的内容,**不依赖 git**,按内容哈希(SHA-1)判定文件是否一致,适合本地大目录的增量核对与镜像。

- **对比**:遍历两侧目录,先以 size 短路,再对大小相同的文件做流式哈希比对。进度以 NDJSON 流式实时上报(walk / hash 两阶段)。结果以 A / B 两棵目录树并排展示,可折叠子树,条目按差异着色(仅 A / 仅 B / 已修改 / 冲突)。
- **git 分支切换**:若某侧路径是一个 git 仓库,路径栏下方会出现分支 / 标签选择器:可输入关键词筛选,按「分支 / 标签」分组,每项显示短提交号与最近提交时间,当前分支有勾选标记;选中即以 `git checkout` 切换到该引用(标签为分离 HEAD),切换后自动重新对比。检测为合法仓库时通过 `git -C <path>` 调用,不经过 shell,引用名做了白名单校验;分支 / 标签及提交信息用单次 `git for-each-ref` 拉取,选择器基于 `cmdk` 无头组件。
- **忽略规则**:每行一个 gitignore 风格模式(基于 `ignore` 包),内置恒忽略 `.git`;支持 `!` 取反。可勾选「忽略隐藏文件」。
- **仅对比文件(默认)**:勾选「忽略文件夹」后只对文件做内容对比,纯目录层面的差异(如单侧多出的空目录)不报告;取消勾选则同时报告单侧目录与文件/目录冲突。
- **差异查看**:点击条目弹出模态框,文本文件做左右并排的内联 diff(含行内词级高亮,>2 MB 的文件跳过内联);单侧文件显示预览;冲突(一侧是文件一侧是目录)提示手动处理。
- **同步**:选择方向(A→B 或 B→A),先「预览计划」——列出将复制 / 删除 / 跳过的条目与总字节数,确认后执行。执行结果实时回显,完成后自动重新对比。删除目标侧独有条目需显式勾选(即为镜像)。
- **对比方案**:左右目录 + 忽略规则可存成本地方案(保存在 `data/dirdiff-groups.json`,仅本机可见,裁剪后不随仓库提交)。

**目录选择**:点击路径栏的「浏览」会调用系统原生目录选择器(Windows: WinForms;macOS: osascript;Linux: kdialog/zenity),也可以直接手填路径。

## 架构

```
app/
  tools/dir-diff/page.tsx       工具页(挂载客户端应用)
  api/dirdiff/
    compare/route.ts            对比任务 · NDJSON 流式进度
    contents/route.ts           单文件内容(文本 / 二进制 / 过大判定)
    sync/route.ts               同步(含 dryRun 只出计划)
    groups/route.ts             方案的增删改查
    browse/route.ts             系统原生目录选择器
    git/route.ts                git 仓库探测(status)与分支 / 标签切换(checkout)
lib/dirdiff/
  server/                       walk / ignore / compare / sync / groups / text / browse / fsutils
  client.ts                     客户端 API 封装(含流式解析)
  types.ts · format.ts          共享类型与格式化
components/dirdiff/             DirDiffApp / GroupRail / SyncPanel / ResultPanes / EntryDetail / DiffView 等
data/dirdiff-groups.json        保存的对比方案(运行时数据)
```

进程内多路并发有硬上限(哈希 16、同步 8),避免大目录对比时打挂机器。

## 常用命令

```bash
pnpm dev        # 开发
pnpm lint       # eslint
pnpm build      # 生产构建(含 typecheck)
pnpm start      # 生产运行
```