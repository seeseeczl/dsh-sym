---
id: CR-0002
type: tasks
status: draft
version: 0.1.0
created_at: 2026-10-09T16:20:00+08:00
owner: project-owner
related: [FR-12]
supersedes: []
evidence: []
---

# CR-0002 任务卡（原子、可验证）

| # | 任务 | 落点 | 完成判据 |
| --- | --- | --- | --- |
| T-01 | `parseBranches(stdout)`：`for-each-ref` 两列 → `[{name,current}]`，当前分支排首位 | `lib/host-v18.js` | 单测覆盖 `main\t*` / `feat/x\t` / 空输入 |
| T-02 | GET 载荷新增 `branches` | 同上 | 真机 GET 里能看到本地分支清单 |
| T-03 | `switchBranch(cwd, branch, signal)`：白名单 → 名称校验 → `git switch -- <branch>` → 失败回 stderr 首行 → 成功失效读缓存 | 同上 | 单测三条路径（未知分支 / git 拒绝 / 成功）+ 真机 POST |
| T-04 | 路由接受 `POST`，body `{sessionId, branch}`，400/404/409 分流 | 同上 | 真机：同名 no-op 200、未知分支 400 |
| T-05 | 客户端：分支名按钮 + 菜单（portal / 外部点击 / Esc）+ 切换反馈 | `lib/client.js` | 离屏渲染能画出菜单项；真机点击可切 |
| T-06 | 治理同步：`.project-architect.json` 契约（methods / branches / 写边界）、AGENTS 契约表、FR-12 入表 | 三处文档 | 文档与实现一致 |

## 验证矩阵（REG-0002）

| 检查 | 命令/动作 | 期望 |
| --- | --- | --- |
| 单测 | `npm test` | 既有 70 项 + 本次新增全绿 |
| 真机 GET | `GET /api/sym.git?sessionId=…` | 200，含 `branches: [{name:"main",current:true}]` |
| 真机 POST（安全 no-op） | `POST {branch:"main"}`（当前分支） | 200 `ok:true`，git 回 "Already on 'main'" |
| 真机 POST（拒绝） | `POST {branch:"nope-xyz"}` | 400 `ok:false`（白名单拦下，不跑 git） |
| 真机 POST（脏工作区） | 临时仓库里制造冲突改动后切换 | 409 + git 原文（在临时仓库验证，不动本仓库） |
| 临时仓库真切换 | 独立脚本：建两个分支 → 经 `switchBranch` 切过去 | `git branch --show-current` 跟着变 |
| 回归 | 花费 / 余额 / 竖条 / 设置页 / @ 引用 | 照常 |

## 落地记录（2026-10-09）

### LOC（`wc -l`）

| 模块 | 改动前 | 改动后 | 上限 | 本次净增 |
| --- | --- | --- | --- | --- |
| `lib/client.js`（M-CLIENT） | 3121 | **3225** | 3300 | +104（卡内） |
| `lib/host-v15.js` → `lib/host-v18.js`（M-HOST） | 1354 | **1470** | 1800 | +116（卡内） |

⚠️ **M-CLIENT 只剩 75 行余量**：下一个客户端功能要么先就地压缩，要么再走一次 CR 调阈值。

### 已验证

| 检查 | 命令 / 动作 | 结果 |
| --- | --- | --- |
| 回归 | `npm test` | **75/75**（原 70 + 本次 5：分支解析 1、切换路径 4） |
| 单测覆盖的切换路径 | `test/host.test.mjs` | 非法名（`-f` / 超长 / 控制字符）→ `invalid` 且**不触发 git switch**；清单外（`origin/main`）→ `unknown` 且不触发；脏工作区 → `refused` + git 原文；成功 → 回新读数且分支已换 |
| 真机 GET | `GET /api/sym.git?sessionId=…` | 200，`branches:[{name:"main",current:true}]` |
| 真机 POST（安全 no-op） | `POST {branch:"main"}`（当前分支） | **200** `ok:true` + 切换后的完整载荷；本仓库分支仍是 `main` |
| 真机 POST（白名单） | `POST {branch:"nope-xyz"}` | **400** `No such local branch: nope-xyz` |
| 真机 POST（选项注入） | `POST {branch:"-f"}` | **400** `Invalid branch name.` |
| 真机 POST（缺参） | `POST {sessionId}` | **400** |
| 真切换（临时仓库，真 git） | 脚本调 `switchBranch`：main → feat/x → 脏冲突被拒 → 清理 → 回 main | `git branch --show-current` 依次为 `feat/x`、`feat/x`（被拒未变）、`main`；`origin/main` 被白名单拒 |
| 客户端点击链路（离屏） | 假 fetch + 真组件：渲染 → 点分支按钮 → 点另一分支 | 分支按钮 `data-git-branches=2`；菜单两项、当前项带 ✓ 且 disabled；POST body `{branch:"feat/x"}`；胶囊改名 `feat/x`、读数换成 `+42`；菜单自动关闭 |
| 服务端 bundle | 取 index 里的 `dsh-sym/client.js` 分组 | 含 `dshGit_branchBtn` / `data-git-picker` / `gitSwitchTitle` |

### 评审整改（2026-10-09，对应审计报告 AUD-REVIEW-0002）

| 项 | 处置 | 验证 |
| --- | --- | --- |
| A1 写操作复用请求 signal | 改为自己的 30s 超时 signal | 单测「A1」：前置读期间 abort 仍能切换 |
| A2 按钮 title 盖住信息 tooltip | 去掉 title，改 aria-label | 离屏用例断言 |
| A3 报错断在半句冒号 | 首行 + 冒号时带下一行（挡路文件） | 单测 + 真机复测 |
| A4 端到端脚本只在 /tmp | 搬进 `test/git-e2e.test.mjs` / `test/git-picker.test.mjs` | `npm test` 89 项 |
| A5 文档与版本没跟上 | README 第 8 节 + CHANGELOG 1.6.0 + 版本 1.5.0→1.6.0 | 文件核对 |
| B1 git < 2.23 无 switch | 回退 `git checkout <branch>` | 单测「B1」断言回退 argv |
| B2 detached 无当前标记 | 菜单顶部加"游离头"说明行 | 代码路径 |
| B3 运行中切换无提示 | 只提示不拦（`useSession(s=>s.running)`） | 真机待确认 |
| B4 在飞读污染缓存 | 读缓存加代次 + `pending.delete` | 单测「B4」手控 gate |
| B5 body 无上限 | `content-length > 4096` → 413 | 单测 |
| B6 无键盘导航/可访问名 | 打开聚焦首项 + ↑↓ + aria-label | 真机待确认 |
| C1 data 属性未登记 | 补进 `.project-architect.json` | 文件核对 |
| C2 词典无守卫 | 新增守卫（**上线即抓到 `balanceLoading` 缺失的真 bug**，已补文案） | `npm test` |
| C3 客户端 branches 无单测 | 补 `describeGitStatus` 用例 | `npm test` |
| C4 路由分流无单测 | 导出 `gitStatusRoute` + 五条分流单测；POST 兼容查询串 `sessionId` | `npm test` |
| 阈值 | `M-CLIENT` 3300 → 3400（实到 3274） | `.project-architect.json` |
| 读数节奏（用户反馈"慢半拍"） | 宿主并行化 + 根路径/分支清单缓存（冷态 70→30ms）；客户端轮询 2s、失败 400/900/1800ms 快速重试、**轮次结束立刻重读** | 真机延迟实测 + bundle 复核 |

产物：[审计报告：Git 状态胶囊与分支切换](../05-audits/2026-10-09-151126-git-status-review.md) ·
[优化计划书](../05-audits/2026-10-09-151126-git-status-optimization-plan.md)

### 未验证（诚实登记）

- **真机点击观感**：浏览器仍是旧 bundle（客户端改动要刷新页面），实际点击体验待用户确认。
- 菜单在右侧栏聊天标签 / 子代理面板里的多实例表现（每个会话头各一枚胶囊、各自菜单）。
- 远端分支切换、新建分支：本次明确不做。
