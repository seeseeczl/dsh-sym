---
id: CR-0001
type: change-request
status: draft
version: 0.1.0
created_at: 2026-10-09T15:05:00+08:00
owner: project-owner
related: [FR-11, NFR-02, NFR-03]
supersedes: []
evidence: ["docs/05-audits/2026-10-09-150500-git-status-feasibility.md"]
---

# CR-0001｜会话头部 Git 状态功能区（分支 + 工作区改动；建 PR 入口已于 2026-10-09 撤回）

## Proposal

- 基线：`docs/01-architecture/project-architecture-and-requirements.md` §3 的 FR-01 ~ FR-09（已实现）、FR-10（搁置）。
- 变更原因与证据：
  - 用户要「知道当前项目在哪个分支、工作区改了什么」，并提出放在会话头部「轨迹」之后。
  - 实测（2026-10-09，查 `app.asar` 全库 + 运行时槽表）：那一行（tabs 行）**没有槽**，官方只允许往那一行注册 view（即多一个标签页）；头部可加的 list 槽只有 `conversation.session.header.utilities`（右簇）与 `conversation.session.header.actions`（标题右侧），`corner` 已被右侧栏展开按钮占用。
  - 实测：DSH **没有**任何 git 分支读数（全库 `symbolic-ref`/`porcelain` 0 处；`rev-parse` 仅 `dsh-workspace-changes` 内部使用且不外显）；官方只有「本轮代码差异」（改动文件卡 + `changes-review` 右栏标签，受设置 `developerTools` 控制，本机已开启），它是**按轮**的、Host 内存内、不显示分支与工作区整体脏状态。
  - 实测：DSH **没有**创建 PR 能力（`createPullRequest`/`pull/new` 0 处；`@octokit/webhooks` 属 `dsh-webhook-github` 的入站 webhook，不建 PR）。
- 新增、修改、删除的语义：
  - 新增 FR-11：会话头部常驻显示 ① 当前分支（含 detached）② 工作区相对 HEAD 的改动（改动文件数、增删行数、未跟踪文件数、领先/落后上游）。
    ⚠️ **2026-10-09 撤回了原第 ③ 项「创建 PR」外链**：用户一个人在主干预直接推、没有审查环节，PR 只是多余流程；宿主端连 `git remote get-url origin` 那一步一并删除（每次轮询少一次 git 调用）。
  - 新增跨端契约：认证路由 `GET /api/sym.git?sessionId=<id>` 及其 JSON 载荷、常量 `GIT_STATUS_ROUTE`。
  - 修改阈值：`.project-architect.json` 的 `loc.hardCeiling.M-CLIENT` 3000 → 3300（依据见 design「阈值」一节）。
  - 不修改既有投影契约 `sessionCost`、不改 `quickActions`、不动 `prices.json`。
- 范围外：
  - **不做** diff 查看器/改动文件列表（官方 `workspace/changes` 摘要 + `changes-review` 已覆盖，重做即重复）。
  - **不做** git 写操作（不 `add`/`commit`/`push`/建分支）；不调用托管平台 API，不持有任何 token。
  - 不做多仓库/子模块聚合，不做逐文件行数明细。
- 审批人和日期：待 project-owner 审批（本 CR 与实现同批交付，审批后归档）。

## 影响分析

| 维度 | 影响 | 证据/动作 |
| --- | --- | --- |
| 用户语义与验收 | 头部出现分支 + 改动读数；非 git 目录/无 git 时**不渲染** | 见 `specs/git-status/spec.md` 的三个 Scenario |
| 模块/API/事件 | 宿主新增 1 条认证 Fetch 路由；客户端新增 1 个 header 槽条目 | `ctx.connection.fetch.register`（官方 `ui-deliverables` 同款通道）；槽 `conversation.session.header.utilities` |
| 数据/迁移 | 无持久化、无投影状态、无 checkpoint 迁移 | 路由每次现读 git；宿主内 1.5s 缓存，进程级 |
| 权限/安全 | 路由在 Connection 鉴权栅栏内；只读 git，不写仓库 | 只接受 `GET`；`sessionId` 必须解析到存在的工作目录；环境清洗 `GIT_CONFIG_COUNT=0`/`GIT_TERMINAL_PROMPT=0`/`GIT_OPTIONAL_LOCKS=0` |
| UI/无障碍 | 加法接入；缺席时官方布局零变化 | 只注册新 `id`；不写任何改动官方布局的 CSS；数值用 `tabular-nums`，外链带 `rel="noopener noreferrer"` |
| 测试/回归 | 新增解析/契约单测；既有 62 项不得回归 | `npm test`（`node --test`） |
| 监控/发布/回滚 | 降级写 `noteDegrade`；回滚＝卸载插件条目，无数据残留 | 无持久状态，回滚零迁移 |

## 验收与回滚

- 新增/更新 REG：`REG-0001`（本 CR 的验收矩阵，落在 `tasks.md` 的验证表）。
- 验证命令：
  - `npm test`（契约 `GIT_STATUS_ROUTE` 两端相等 + porcelain/numstat 解析 + 客户端载荷整理）。
  - 真机：宿主换名重载 → 停用/启用插件 → 头部出现胶囊；在非 git 目录的会话里**整块不渲染**。
- 回滚触发与步骤：胶囊遮挡官方工具图标或读数错误率不可接受时，删除 `apply` 里的那一条 `slots.inject`（客户端）与路由注册块（宿主）即可；无数据迁移、无持久状态需要清理。
