---
id: CR-0002
type: change-request
status: draft
version: 0.1.0
created_at: 2026-10-09T16:20:00+08:00
owner: project-owner
related: [FR-12, FR-11, CR-0001, NFR-02]
supersedes: []
evidence: []
---

# CR-0002｜点分支名切换本地分支（首次赋予插件 git 写能力）

## Proposal

- 基线：`CR-0001`（`FR-11` 分支 + 工作区改动读数，路由 `GET /api/sym.git` 只读）。
- 变更原因与证据：用户实机看到胶囊功能可用后提出 ——「在项目有其他分支的时候，点前面这个 MAIN
  需要可以切换分支」。仓库里有多个本地分支是常态（本仓库当前只有 `main`，所以按钮在只有一个
  分支时**不出现**，退化成一个普通文本）。
- 新增、修改、删除的语义：
  - 新增 `FR-12`：胶囊上的**分支名**在本地分支数 >1 时可点击，弹出一个分支菜单，选中即在该会话的
    工作目录里切换（`git switch`），并立刻刷新读数。
  - 修改公开契约 `GET /api/sym.git` → **`GET|POST /api/sym.git`**：GET 载荷新增 `branches`
    字段；POST 接受 `{ sessionId, branch }` 执行切换。**这是本插件第一条写操作契约。**
  - `git` 的使用边界从「只读」放宽为「**只读 + 只切换分支**」：仍然不 `add` / `commit` / `push`，
    不用 `-f` / `--discard-changes`，不重置工作区。
  - `.project-architect.json` 的 `contracts.gitStatusRoute` 与 AGENTS 契约表同步。
- 范围外：新建/删除/重命名分支、切换远端分支（`origin/xxx`）、stash 管理、pull/push、
  冲突合并解决。工作区有冲突改动时**交给 git 自己拒绝**，插件不代为处理。
- 审批人和日期：待 project-owner 审批（与实现同批交付）。

## 影响分析

| 维度 | 影响 | 证据/动作 |
| --- | --- | --- |
| 用户语义与验收 | 点分支名 → 选另一个分支 → 读数与工作区切过去；只有一个分支时不出现菜单 | 见 `specs/git-status/spec.md` 的新增 Requirement |
| 模块/API/事件 | 路由新增 POST 语义与 `branches` 字段；宿主新增 `parseBranches` / `switchBranch` | `ctx.connection.fetch.register` 官方支持 `methods: ['GET','POST']`（`ui-deliverables` 的 `/api/present.open` 即 POST） |
| 数据/迁移 | 无持久化；切换后宿主侧 1.5s 读缓存按 cwd 失效 | `reader.switchBranch` 成功后 `cache.delete(cwd)` |
| 权限/安全 | **首次出现写操作**：argv 传参（无 shell）、分支名先与本地分支清单白名单比对、`--` 终止选项、长度与字符校验；报错只回 git stderr 首行 | `test/host.test.mjs` 覆盖未知分支、脏工作区、成功三条路径 |
| UI/无障碍 | 菜单沿用官方弹层配方（`--dsw-specific-menu` + elevation + radius + backdrop-filter）；Esc / 点击外部关闭；`role="menu"` / `menuitem` | 复用 `LinkContextMenu` 的 portal + 外部点击模式 |
| 测试/回归 | 新增解析与切换路径单测；既有 70 项不得回归 | `npm test` |
| 监控/发布/回滚 | 降级写 `noteDegrade`；回滚＝把路由 methods 收回 `['GET']` 并删掉按钮 | 无状态迁移 |

## 验收与回滚

- 新增/更新 REG：`REG-0002`（见 `tasks.md`）。
- 验证命令：`npm test`；真机 `GET /api/sym.git` 看 `branches`；`POST {branch:<当前分支>}`
  （no-op，安全）；`POST {branch:"nope"}` 期待 400；临时仓库里跑一次真切换。
- 回滚触发与步骤：切换行为异常（切错分支 / 未提示冲突）时，把 `methods` 收回 `['GET']`、
  客户端分支名退回纯文本；无数据迁移。
