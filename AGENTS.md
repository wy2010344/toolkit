<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project notes (toolkit)

- 这是一个本地工具合集,当前仅有「目录对比同步」(`/tools/dir-diff`)。更多工具照 `app/tools/<name>` + `components/<name>/` 的既有模式新增。
- 包管理器为 pnpm。Tailwind CSS 4(`@import "tailwindcss"` + `@theme inline`),设计 token 全部定义在 `app/globals.css` 顶部(ink/muted/faint/line/canvas/surface + acc-*,含暗色媒体查询),UI 一律用这些语义类,不写死颜色。
- 客户端常用件在 `components/ui.tsx`(Button/IconButton/Toggle/Modal/Notice/StatusBadge/ProgressBar/Spinner 等);磷酸图标统一从 `@phosphor-icons/react/dist/ssr` 导入(客户端组件)。
- 目录对比工具为 API 直连本机文件系统(非数据库);进度用 NDJSON 流式(`app/api/dirdiff/compare`),客户端在 `lib/dirdiff/client.ts` 里逐行解析。平台差异点:Windows/win32 路径前缀(\\?\ 与大小写不敏感)在 `lib/dirdiff/server/fsutils.ts` 与 `compare.ts`。
- 用户运行在 Windows,命令验证请用 `pnpm lint` 与 `pnpm build`。
