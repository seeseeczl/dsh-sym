---
id: CR-0001
type: tasks
status: draft
version: 0.1.0
created_at: 2026-10-09T15:05:00+08:00
owner: project-owner
related: [FR-11]
supersedes: []
evidence: []
---

# CR-0001 任务卡（原子、可验证）

约束：单卡至多 5 个生产文件、净新增至多 300 行；超限先停。

| # | 任务 | 落点 | 完成判据 |
| --- | --- | --- | --- |
| T-01 | 契约常量 `GIT_STATUS_ROUTE` 两端各一份 + 守卫 | `lib/host-v18.js`、`lib/client.js`、`test/contracts.test.mjs` | `npm test` 断言两端相等 |
| T-02 | 纯解析：`parseGitStatus` / `parseNumstatTotals`（`compareUrlFor` 已于 2026-10-09 随建 PR 入口一并删除） | `lib/host-v18.js` | 单测覆盖 porcelain v2 的 1/2/u/? 行、二进制 `-`、detached、无上游 |
| T-03 | git 读取器（resolveExecutable + 工作目录状态 + 1.5s 缓存合流） | `lib/host-v18.js` | 无 git 时返回 null 且只记一次降级 |
| T-04 | 认证路由 `/api/sym.git`（条件注入 connection/sessions/subprocess） | `lib/host-v18.js` | 会话不存在 / 无 cwd 时 404；存在时 200 且 `cache-control: no-store` |
| T-05 | 客户端胶囊 `GitStatusCell` + CSS + 槽注册（`utilities`, order -20，实机反馈后由 20 调整） | `lib/client.js` | 真机头部出现胶囊；非 git 目录不渲染 |
| T-06 | 阈值与治理文档同步 | `.project-architect.json`、`AGENTS.md`、`docs/01-architecture/project-architecture-and-requirements.md` | M-CLIENT 上限 3300 且 FR-11 入表 |

## 验证矩阵（REG-0001）

| 检查 | 命令/动作 | 期望 |
| --- | --- | --- |
| 单测 | `npm test` | 既有 62 项 + 本次新增全部通过 |
| 契约 | `npm test` 中的 contracts 文件 | 两端 `GIT_STATUS_ROUTE` 相等 |
| 真机-宿主 | `node scripts/reload-host.mjs --apply` → 插件管理器停用/启用 | 插件重新激活且无报错 |
| 真机-路由 | 头部胶囊 | 分支名与本仓库 `git branch --show-current` 一致；增删行数与 `git diff --shortstat HEAD` 量级一致 |
| 真机-退场 | 打开一个工作目录非 git 仓库的会话 | 胶囊不渲染，官方头部零变化 |
| 回归 | 花费/余额/竖条/设置页 | 均照常工作 |

## 未完成/未验证登记（收尾时更新）

- 待填：实际 LOC、真机截图或读数、未验证项（如桌面端外链是否落到系统浏览器）。

---

## 落地记录（2026-10-09）

### LOC（`wc -l`，与 `.project-architect.json` 同口径）

| 模块 | 改动前 | 改动后 | 上限 | 本次净增 |
| --- | --- | --- | --- | --- |
| `lib/client.js`（M-CLIENT） | 2973 | **3121**（撤建 PR 后） | 3300（本 CR 调高） | +148 |
| `lib/host-v13.js` → `lib/host-v18.js`（M-HOST） | 1062 | **1411** | 1800 | +349 |

单卡 ≤300 行：T-01+T-02（常量与纯解析）≈ +215，T-03+T-04（读取器与路由）≈ +134，T-05（客户端）≈ +157、T-06（文档）不记入生产行 —— 均在卡内。

### 已验证

| 检查 | 命令 / 动作 | 结果 |
| --- | --- | --- |
| 回归 | `npm test` | **70/70 通过**（原 62 项 + 本次 8 项：契约 1、宿主解析 5、客户端载荷 2） |
| 读取器（脱离 App，真 git） | 用与 `ctx.subprocess` 同形的替身调用 `createGitStatusReader` | `{branch:"main", files:15, added:350, deleted:1105, untracked:3}`（当时的载荷还带 `remote`/`compare`，2026-10-09 已删），与 `git status --porcelain=v2 --branch` / `git diff --shortstat HEAD` 逐项一致；`/tmp`（非仓库）→ `null` |
| 路由（真机，认证 HTTP） | `GET /api/sym.git?sessionId=session-436165e4-…`（带本机 profile 的 browser-session 签名 Cookie） | **200** + 上述同一份 JSON；无 `sessionId` → **400**；不存在的会话 → **404**；不带 Cookie → **401** |
| 客户端 bundle（真机） | 取 index 里的 `dsh-sym/client.js` 分组 | 含 `dshGit_root` / `GIT_STATUS_ROUTE` / `GitStatusCell`，即工作副本的客户端半边 |
| 插件状态 | `plugin_manager list_plugins` | `include:sym-dev` → `enabled: true`、`fiberPhase: active` |
| 客户端组件「离屏渲染」（真路由数据 + 工作副本代码） | 用迷你 hook 运行时调用 `GitStatusCell`，`fetch` 走真路由 | 元素树 = `[main, +365, −1,105, ?3, 创建 PR]`（当时的形态），`data-git-status=true`，tooltip 含仓库路径 / 上游领先落后 / 改动文件数 —— **全部通过**；2026-10-09 去掉建 PR 入口后复测元素树为 `[main, +368, −1,105, ?3]` |
| 降级路径（同一离屏脚本的中间产物） | 故意让 `fetch` 自递归 | 组件抛错被自身 catch 住、记一条 `[dsh-sym] git:read 降级`、整块不渲染（不连累其他插槽） |

### 实机反馈后的调整（2026-10-09，用户截图 + 复现）

- 用户实机看到胶囊已渲染，但报「宽度不够时看不到」，并要求把它换到「用访达打开」（`open-in-app`）**前面**。
- 原因一：右簇是 `flex` + 容器裁切，**最右的条目最先被裁**，胶囊原来 `order: 20` 排最后。
  → 改为 `order: -20`（排在官方三条工具之前）。
- 原因二：原先的 `@container (max-width:900px)` 阈值太靠前，标题行一窄就先藏了 `+N −M`
  （截图里已经只剩 `main` 和「创建 PR」）。
  → 阶梯改为 560 / 460 / 380 / 320px（去掉建 PR 入口后实际为 560 / 460 / 320px），依次收
    `?未跟踪` → 增删行数 → 分支名，并给根节点加 `min-width:0; flex:0 1 auto`。
- 验证：`npm test` 70/70；服务端 bundle 复核见下（客户端改动刷新页面即生效）。

### 撤回记录：建 PR 入口（2026-10-09，用户决定）

- 用户说明自己的工作方式：**一个人直接在主干上干活、改完直接推，不进 PR 流程**；PR 的意义在"有人审"，
  他这里没有审查环节 —— 因此建 PR 按钮只是多余流程。
- 处理：客户端删掉 `<a class="dshGit_pr">`、`.dshGit_pr` 两条 CSS、两条容器查询与两条文案；
  宿主删掉 `compareUrlFor` / `remoteWeb` 与 **`git remote get-url origin` 那次调用**，
  载荷字段从 13 个减到 11 个（每次轮询少一次 git 子进程）。
- 治理同步：`FR-11` 文本与验收去掉建 PR、`contracts.gitStatusRoute.fields` 去掉 `remote`/`compare`、
  本条 Requirement 在 spec 增量里标记 **withdrawn**（保留 ID 与原文供追溯）、
  `test/host.test.mjs` 换成"源码里不得再出现 compareUrlFor / git remote get-url / compare 字段"的守卫。
- 未跟踪计数 `?n` **保留**：它属于"工作区变更情况"，是新增文件唯一的读数（想去掉随时说）。

### 未验证（诚实登记）

- **浏览器里胶囊的实际渲染**：服务端发的是含该组件的 bundle、组件的元素树已离屏验证，但**浏览器仍是旧 bundle**（15s 采样无 git 子进程）——需要刷新页面（⌘R）后才看得见，由人确认。
- ~~桌面端「创建 PR」外链是否落到系统浏览器~~：该功能已撤回，此条作废。
- 多会话（右侧栏聊天标签 / 子代理面板）同时显示多枚胶囊时的观感，未实测。

### 交付注记：这次是怎么装进正在运行的 App 的（重要）

**发现**：`~/.dsh/profiles/desktop` 早在 2026-10-08 就改成了**包安装** —— `package.json` 的
`dsh-sym` 是 `github:seeseeczl/dsh-sym`（pnpm 装在 `node_modules/dsh-sym`，锁定 commit
`eed6b3f`），profile 的 `cordis.patch.yml` 里那条 `file://` **已经不存在**。这与 AGENTS.md
「环境事实」一节写的挂载方式不一致：**工作副本的改动本来不会进 App**。

**让工作副本生效的两条实测结论**：

1. **id 定向覆盖改不动 `name`。** 在 profile patch 里写 `- id: sym-cost` + `name: file://…`
   不生效（`Config` inspect 里那条 entry 的 `name` 仍是 `dsh-sym`），推测补丁层只覆盖 `config`。
2. **入口 specifier 不变 → 宿主模块被缓存钉住。** 只把 `node_modules/dsh-sym` 里的文件换成
   新内容（甚至改 `package.json` 的 `main` 到新文件名）都不生效：entry 的 name 还是 `dsh-sym`，
   与 AGENTS 里「只改文件名也不会生效」同源。

**实际做法**（可复现）：给 profile patch 追加一条**新 id 的 insert**，并把包安装那条 entry 停用：

```yaml
- insert:
    - id: sym-dev
      name: "file:///Users/long/GitHub/DSH-Sym/lib/host-v18.js"
```

```text
plugin_manager: set_plugin include:sym-dev  true
plugin_manager: set_plugin include:sym-cost false
```

两条 entry 都提供 `dsh-sym` 时，客户端模块图按包名去重，只有包安装那条的 `client.js` 会被发出去
（实测：分组里 `dshGit_root=0`）——所以**必须停用包安装那条**，否则宿主是新代码、客户端却是旧代码。

**回滚**：`plugin_manager` 把 `include:sym-cost` 打开、`include:sym-dev` 关掉，并把 profile
patch 里那段注释 + insert 删掉（备份在 `/tmp/cordis.patch.yml.bak.*`）。包目录本轮未留下改动
（曾被覆盖，已用 `/tmp/dsh-sym-installed-backup-*` 恢复原状）。

**长期方案（建议，待用户决定）**：把 profile 的依赖换成指向工作副本（`link:`/`file:`）或重建
`file://` 挂载，之后走 `reload-host.mjs` 的「换名 + 停用/启用」老流程；两者都需要一次 App 重启。
