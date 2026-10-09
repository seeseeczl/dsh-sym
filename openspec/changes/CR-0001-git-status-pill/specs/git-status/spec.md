---
id: FR-11
type: functional-requirement
status: draft
version: 0.1.0
created_at: 2026-10-09T15:05:00+08:00
owner: project-owner
related: [CR-0001, NFR-02, NFR-03, NFR-04]
supersedes: []
evidence: []
---

# FR-11｜会话头部 Git 状态功能区

本文件是 CR-0001 对基线的**增量**；基线回填前不写入 `openspec/specs/`。

## 目标与范围

- 用户/角色：在本机用 DSH 写代码的人。
- 触发条件：打开任意会话（工作目录是 git 仓库）→ 会话头部右簇出现一枚常驻胶囊。
- 成功结果：一眼看到 ① 当前分支 ② 工作区相对 HEAD 的改动规模 ③ 可一键打开所在平台的建 PR 页。
- 范围外：改动文件明细、逐文件 diff、任何 git 写操作、任何托管平台 API 调用与凭据访问。

## Requirements

### Requirement: 会话头部显示当前分支与工作区改动

系统 SHALL 在 `conversation.session.header.utilities` 里以加法方式渲染一枚胶囊，显示当前会话工作目录所在仓库的分支名，以及工作区相对 `HEAD` 的改动规模（改动文件数、增删行数、未跟踪文件数、有上游时的领先/落后）。

#### Scenario: git 仓库里的普通分支

- **WHEN** 会话工作目录在 git 仓库内、分支为 `main`、工作区有 3 个已跟踪改动与 2 个未跟踪文件
- **THEN** 胶囊显示分支名 `main` 与 `+N −M`（N/M 为 `git diff --numstat HEAD` 的汇总）、未跟踪计数，并在悬停时给出仓库绝对路径与上游领先/落后

#### Scenario: detached HEAD 或无上游

- **WHEN** 仓库处于 detached HEAD
- **THEN** 分支位显示短 sha（不显示 `HEAD`），领先/落后整块不显示
- **WHEN** 分支没有上游
- **THEN** 不显示领先/落后（不显示 0/0 占位）

#### Scenario: 数据不可得时安静退场

- **WHEN** 工作目录不是 git 仓库、机器上没有可用的 git、或会话没有工作目录
- **THEN** 胶囊**整块不渲染**，官方头部布局零变化，控制台留下一条 `[dsh-sym] git:… 降级：…`
- **WHEN** `git diff` 超时（大仓库）
- **THEN** 仍显示分支与改动文件数，增删行数缺省（不显示 0）

### Requirement: 在可识别的托管平台上提供创建 PR 入口 —— ⚠️ **已撤回（withdrawn，2026-10-09）**

> 撤回理由：项目所有者一个人在主干预、改完直接推，没有审查环节；PR 在此工作流里只是多余流程。
> 本条保留原文仅为追溯，实现与验收均**不包含**建 PR 入口，宿主也不再取 `origin`。

> 以下两个 Scenario 是撤回前的记录，实现与验收均不再包含。

#### Scenario: GitHub 仓库（已撤回）

- **WHEN** origin 为 `git@github.com:owner/repo.git`
- **THEN** 胶囊出现「创建 PR」，点击在新标签页打开 `https://github.com/owner/repo/compare/<branch>?expand=1`

#### Scenario: 未知平台（已撤回）

- **WHEN** origin 指向自建服务或无法归一化
- **THEN** 不渲染「创建 PR」，其余读数照常显示

## 非功能与验收

- 性能/可靠性：宿主侧同一工作目录 1.5s 内合并为一次 git 读取；客户端仅在本标签页可见时每 5s 轮询；单条 git 命令有超时与输出上限。
- 安全/权限：只读 git（`GIT_OPTIONAL_LOCKS=0`，不写 index/refs）；路由只接受 `GET` 且位于 Connection 鉴权栅栏内；`sessionId` 必须解析到存在的会话，否则 404。
- 可观测性：每条降级路径经 `noteDegrade` 记录一次（上限 40 条，不刷屏）。
- 无障碍/兼容性：外链带 `rel="noopener noreferrer"`；数值使用 `tabular-nums`；只使用 `--dsw-*` 语义变量；窄宽度下由容器查询收起统计数字。
- 关联回归：`REG-0001`（见 `tasks.md`）。
