---
id: AUD-FEAS-0001
type: feasibility-evidence
status: accepted
created_at: 2026-10-09T15:05:00+08:00
owner: project-owner
related: [CR-0001, FR-11]
---

# 可行性取证｜DSH 是否已支持「分支 / 工作区改动 / 创建 PR」

> 目的：在动手前回答「如果 DSH 已经支持，就不必做」。结论是**三件都没有完整支持**，
> 只有「本轮代码差异」已由官方覆盖，故本次只做官方没有的那一半。
> 取证方式：`app.asar`（121MB，含全部官方包与文档）全量字节扫描 + 运行时槽表（Client Slots Inspect）。

## 1. 官方能力清单（实测）

| 能力 | 是否存在 | 证据 |
| --- | --- | --- |
| 显示当前 git 分支 | **无** | `symbolic-ref` 0 处；`porcelain` 0 处；`rev-parse` 仅 4 个文件命中，全部属 `@deepseek-ai/dsh-workspace-changes`（`lib/index.js`、`lib/types/git.js` 及其两份 README），用于内部定位仓库；客户端全部 `client-ui-*` 包里没有任何 git 组件（唯一 `IconBranchOutline` 是"分叉会话"图标） |
| 显示工作区相对 HEAD 的改动 | **无** | 同上；官方读数只有按轮的改动摘要 |
| 显示「本轮代码差异」 | **有** | `@deepseek-ai/dsh-workspace-changes`（Host，turn 开始/结束各做一次 git 工作树快照）+ `@deepseek-ai/dsh-client-ui-deliverables`（改动文件卡 + `changes-review` 右栏标签）；开关是设置里的 `developerTools`（`Show coding view`，schema 默认 `false`，本机 `~/.dsh/profiles/desktop/cordis.patch.yml` 已设 `true`） |
| 创建 PR | **无** | `createPullRequest`、`pull/new` 0 处；`/compare/` 命中全在第三方 changelog；`@octokit/*` 属 `@deepseek-ai/dsh-webhook-github`——它是**入站** webhook 适配器（验签后 `ctx.webhookRuntime.dispatch()`，返回 202），不建 PR、不调 GitHub 写接口 |

官方「本轮代码差异」的边界（其 README 自述 + 实现核对）：只覆盖轮次内的改动；摘要只活在 Host 内存，Host 重启后旧轮次没有卡片；工作区不在 git 仓库时只列文件工具编辑；需要 git ≥ 2.13。

## 2. 位置取证（「轨迹」右边能不能放）

`conversation.session.header` 的渲染结构（`dsh-client-ui-conversation` 源码）：

```text
titleRow  →  [ crumbs + header.actions ][ header.utilities ][ header.corner ]   (grid-column:2)
tabs      →  「对话 / 轨迹」                                                  (grid-column:1/-1, margin-top:10px)
```

- tabs 行的内容来自 list 槽 `conversation.view`（运行中 occupants：`chat` order 0、`trajectory` order 10），渲染成 `role="tab"` 按钮。**该行没有任何可供第三方插入状态读数的槽**；唯一能进那一行的机制是再注册一个 view（＝多一个标签页）。
- 头部三个可加/可动的槽现状（运行时 occupants）：
  - `conversation.session.header.utilities`（list，右簇）：`open-in-app` −10、`schedule-catalog` −5、`session-log-download` 0、本插件 `quick-actions` 30（`position:fixed`，不占布局）。
  - `conversation.session.header.actions`（list，标题右侧）：`subagent-catalog` −30、`agent-preset` −10、`job-list` 20。
  - `conversation.session.header.corner`（single）：**已被 `dsh-client-ui-sidebar-right` 的展开按钮占用**。
  - `shell.leading`（single）：也已被 `ui-sidebar` 的重新打开/新会话控件占用。
  - `shell.overlay`（list）：说明文字明确欢迎「badge / toast stack / status pill」，但容器是 `position:absolute; inset:0`（`z-index:20`，`pointer-events:none`）的整帧浮层，条目自行定位 → 相对整帧定位会随侧栏/右栏宽度漂移。

结论：**「轨迹」右边放不了**（除非伪造位置，本项目已因"余额借位"禁止）；最贴近用户意图的合法位置是 tabs 行正上方右侧的 `conversation.session.header.utilities`。

## 3. 通道取证（宿主 → 客户端）

- `@deepseek-ai/dsh-api-remotes` README：「能力集合由**构建时**显式导入的值固定确定；Client 不会在运行时发现 Host 中已启用的服务或 Remote 定义」→ 插件加不了新 Remote。
- `@deepseek-ai/dsh-client-ui-deliverables` 的 Host 半部用 `ctx.connection.fetch.register({ path: "/api/changes.summary", methods: ["GET"], … })` 注册路由，客户端半部用普通 `fetch(url)` 读取（`CHANGED_FILES_PATH = "/api/changes.summary"`）→ **认证 Fetch 路由是本组合已有的官方通道**。
- 会话工作目录可在宿主取得：`ctx.sessions.get(id)` → `Session.header.cwd`（Service 目录核对）。
- git 只能宿主跑：`ctx.subprocess.resolveExecutable("git")` + `ctx.subprocess.spawn({ argv, cwd, stdio, graceMs, signal, env })`，官方 `dsh-workspace-changes` 的 `GitRunner` 即为模板（`GIT_CONFIG_COUNT=0`/`GIT_TERMINAL_PROMPT=0`/`GIT_OPTIONAL_LOCKS=0`/`LC_ALL=C`，超时 + 输出上限；macOS 需排除 `/usr/bin/git` 的 Xcode 存根）。

## 4. 未验证项（诚实登记）

- 桌面端 `<a target="_blank" rel="noopener noreferrer">` 是否落到系统浏览器：官方 `ui-primitives` 的 `SafeLink`/`MarkdownAnchor` 用同一写法，**未实测**。
- 自建/未知托管平台的建 PR URL 规则：一律不猜（返回 null，不渲染按钮）。
