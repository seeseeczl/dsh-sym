---
id: CR-0001
type: design
status: draft
version: 0.1.0
created_at: 2026-10-09T15:05:00+08:00
owner: project-owner
related: [FR-11]
supersedes: []
evidence: []
---

# CR-0001 技术方案｜Git 状态功能区

## 1. 位置：为什么是 `conversation.session.header.utilities`

运行时槽表与 `dsh-client-ui-conversation` 源码（asar 内提取）给出的头部结构：

```text
conversation.session.header (single)
├── titleRow            [ crumbs + header.actions …… header.utilities  header.corner ]
└── tabs (grid-column:1/-1, margin-top:10px)   ← 「对话 / 轨迹」= conversation.view 的条目
```

| 候选 | 结论 | 依据 |
| --- | --- | --- |
| 「轨迹」右边（tabs 行） | **不可用** | 该行由 `conversation.view` 的注册项渲染成 `role="tab"` 按钮，没有任何 list/single 槽；插进去只能靠 `position:fixed` 量像素伪造 —— 项目已因「余额借位」判定禁止 |
| `conversation.session.header.corner` | 不可用 | 已被 `dsh-client-ui-sidebar-right` 的右侧栏展开按钮占用（single 型＝替换官方行为） |
| `shell.overlay` | 未采用 | 槽说明明确欢迎「status pill」，但它是 `position:absolute; inset:0` 的整帧浮层：定位要相对整帧算，而头部左右边界随侧栏/右栏宽度变化 —— 又回到量像素 |
| **`conversation.session.header.utilities`** | **采用** | list 型加法；standardProps 含 `sessionId`；渲染位置由官方 flex 决定（标题行右簇，tabs 行的正上方右侧）。`order: -20` 让条目排在官方 `open-in-app`(-10) / `schedule-catalog`(-5) / `session-log-download`(0) **之前** —— 实机反馈：这一行行宽不足时**最右边的条目最先被裁掉**，排在最后的话胶囊会先消失 |

代价（已知并接受）：

- 会话级槽，右侧栏聊天标签/子代理面板各有一份会话头时会出现多枚胶囊 —— 每枚对应当前显示的那个会话，语义正确。
- 标题行是 `flex` + 容器裁切：行宽不足时右侧内容被裁。胶囊排在最前，并用 `.titleRow`（官方 `container-type:inline-size`）上的容器查询阶梯逐项收窄自己：`?未跟踪` ≤560px → `+N −M` ≤460px → 分支名 ≤320px（只留分支图标）。这样窗口变窄时先收窄的是插件自己，官方图标最后才受影响。

## 2. 数据通道：为什么是认证 Fetch 路由而不是投影

| 通道 | 结论 |
| --- | --- |
| 会话投影 `ctx.sessionProjections` | 不可用：投影只能在**会话事件提交时**重算，空闲（用户在编辑器里改文件）时读数会停在旧值；若靠定时器往会话日志追加自造事件来驱动，等于用 UI 读数污染持久日志 |
| **`ctx.connection.fetch.register` + 客户端 `fetch`** | **采用**：官方 `dsh-client-ui-deliverables` 正是这样把 `/api/changes.summary` 送给浏览器的（路由在 Connection 鉴权栅栏内，客户端普通 `fetch` 即可）。可轮询 → 空闲也准 |

这是本插件第一条**非投影**的宿主 ↔ 客户端契约，因此按公开契约对待：常量两端各一份拷贝 + `test/contracts.test.mjs` 守卫。

## 3. 契约

```text
GET /api/sym.git?sessionId=<SessionId>        （GIT_STATUS_ROUTE = "/api/sym.git"）
200 application/json, cache-control: no-store
{
  "root":      "/abs/repo",        // git rev-parse --show-toplevel
  "branch":    "main" | null,      // detached 或 initial 时为 null
  "detached":  false,
  "head":      "a1b2c3d",          // 短 sha，detached 时才是唯一的定位
  "upstream":  "origin/main" | null,
  "ahead":     0 | null,           // 无 upstream 时 null
  "behind":    0 | null,
  "files":     3,                  // 已跟踪的改动文件数（status 的 1/2/u 行）
  "added":     4784 | null,        // git diff --numstat HEAD 汇总；超时降级为 null
  "deleted":   116 | null,
  "untracked": 2,                  // status 的 ? 行数
}
404 无此会话 / 无 cwd / 不是 git 仓库 / 无 git 可执行文件   （客户端安静退场）
```

**不做建 PR 入口（2026-10-09 撤回）**：早先版本用 `git remote get-url origin` 拼过 GitHub/GitLab 的建 PR 页面，用户说明自己一个人在主干预直接推、没有审查环节，PR 只是多余流程；连同那一步 git 调用一起删除 —— 现在每次轮询只跑 `status` + `diff`（+ 一次 `rev-parse --show-toplevel`）。

## 4. 宿主实现

1. `resolveGit(ctx.subprocess, signal)`：`resolveExecutable("git")`；macOS 上 `/usr/bin/git` 是 Xcode 存根，用 `xcode-select -p` 探一次，非 0 视为不可用 —— 与官方 `dsh-workspace-changes` 同款判据。
2. 读一次工作区状态，两条 git 命令并发：
   - `git status --porcelain=v2 --branch --untracked-files=normal`
   - `git diff --numstat --no-renames HEAD`（`HEAD` 不存在时降级为 `--cached` 后的空统计：`added/deleted` 保持 0）
   - 环境：`GIT_CONFIG_COUNT=0 GIT_TERMINAL_PROMPT=0 GIT_OPTIONAL_LOCKS=0 LC_ALL=C`，`graceMs` + `AbortSignal.timeout`，输出有上限。
3. 纯函数（导出、可单测）：`parseGitStatus(stdout)`、`parseNumstatTotals(stdout)`。
4. 路由：`ctx.inject(["connection", "sessions", "subprocess"], (scope) => …)` 条件注入 —— 任一服务缺失就整块不注册（安静降级，不影响既有能力）。会话 → 工作目录用 `scope.sessions.get(id)?.header.cwd`。
5. 缓存：以 cwd 为键、TTL 1500ms、并发合流（同一目录同一时刻只跑一次 git）。轮询来自客户端，缓存只用来防抖。

## 5. 客户端实现

- 模块级 `gitStatusCache`（按 sessionId 记忆上一份读数）避免重挂闪烁。
- 轮询 2s；失败按 400/900/1800ms 快速重试；页面隐藏停表、切回前台/聚焦、**智能体一轮结束时**立刻重读。
- `GitStatusCell(props)`：`fetch(GIT_STATUS_ROUTE + "?sessionId=" + …)`，5s 轮询；`document.visibilitychange` 与 `window.focus` 时立刻重读；隐藏时停轮询。`status !== "ready"` → `return null`（NFR-02：不显示 0 也不显示占位符）。
- 渲染：分支图标 + 分支名（detached 时短 sha）+ `+N −M` + `?n`（未跟踪，>0 才显示）；上游领先/落后只在悬停 tooltip 里给（`↑n ↓n` 容易和增删行数混读）。
- 文案不依赖槽的 `t`：沿用同槽既有竖条的做法（`{ locale: null }` + `localeLabel(ctx, key)`），因为该槽 owner 是否注入 `t` 与渲染无关、但没必要押注。
- CSS 追加在既有 `CSS` 常量里，只用 `--dsw-*` 语义变量；`@container` 在窄宽度收起统计。

## 6. 阈值（.project-architect.json）

`lib/client.js` 现状 **2973 行 / M-CLIENT 3000**，本次客户端新增约 120 行即越限。客户端半边**不能拆文件**（2026-10-05 查证：`file://` 挂载没有 bundle URL，`require.async` 无法解析 chunk），"先拆分"在本模块不可执行，故本 CR 显式调整阈值：

- `loc.hardCeiling.M-CLIENT`：3000 → **3300**（本次落地后实际约 3090 行，留 200 余行余量）。
- 同时把 `loc.byModule` 与注释里的过期基线（写死 client 1349）更新为本次实测值，避免下次再按旧基线推算。
- 宿主 `lib/host-v18.js` 本次 +约 200 行（1062 → 约 1260），仍在 1800 以内，不动。

## 7. 取舍与被否方案

| 方案 | 否决原因 |
| --- | --- |
| 复用官方 `workspaceChanges` 摘要当读数 | 按轮、只覆盖 agent 改的文件、Host 重启即失；不回答"分支"与"工作区整体脏不脏" |
| 客户端读 `.git/HEAD`（走 `remote.workspaceFiles.read`） | 只能拿分支，拿不到增删行数；且把 git 目录当普通文件读，语义脆弱 |
| 投影 + 定时器追加自造会话事件 | 污染持久日志、把 UI 读数写进会话数据；官方摘要都刻意不这么做 |
| 用 `shell.overlay` 把胶囊浮到 tabs 行右侧 | 整帧浮层定位依赖侧栏/右栏宽度，重演"借位"事故 |
| 只做客户端、靠官方能力 | 官方无分支/工作区读数，做不到 |
