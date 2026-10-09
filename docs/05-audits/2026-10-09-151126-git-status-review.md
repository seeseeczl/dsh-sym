---
id: AUD-REVIEW-0002
type: audit-report
status: accepted
created_at: 2026-10-09T15:11:26+0800
owner: project-owner
related: [CR-0001, CR-0002, FR-11, FR-12]
---

# 审计报告：Git 状态胶囊与分支切换（CR-0001 + CR-0002 的改动评审）

> 范围：本次会话落地的两个能力 —— 会话头部 Git 胶囊（CR-0001）与点分支名切换（CR-0002）。
> 方法：重读全部改动 + 复跑回归 + 真机与临时仓库复测。**结论先行**：功能站得住，
> 但发现 1 个写操作安全问题、1 个 UX 回归、1 个文案截断，以及若干边界/治理遗漏。
> 配套的处置见同时间戳的**优化计划书**。

## 一、确认没问题的部分（先说清哪些不用再查）

| 检查 | 证据 |
| --- | --- |
| profile 里那份包已被逐文件复原 | `lib/host-v13.js` / `client.js` / `prices.json` / `package.json` 的 sha256 与仓库 `eed6b3f` 完全一致 |
| 无 PR / compare 残留 | 全库 grep 只剩守卫测试里"断言它不存在"的那一行 |
| 注入面 | 非法名（`-f` / 超长 / 控制字符）与清单外（`origin/main`）都在**跑 git 之前**被拒；单测 + 真机双重 |
| 不丢用户改动 | 不用 `-f`/`--discard-changes`/`stash`/`reset`；临时仓库里制造冲突后切换被拒，分支与工作区均未变 |
| 真机路由 | GET 200（带 `branches`）、POST 同名 no-op 200、未知分支/`-f`/缺参 400 |
| 词典 | zh / en 各 114 键齐平（补了守卫之后） |

## 二、发现（按严重度）

| ID | 严重度 | 发现 | 证据 |
| --- | --- | --- | --- |
| A1 | 中高 | 写操作复用了 HTTP 请求的 `signal`：浏览器刷新/断连会 kill 正在执行的 `git switch`，可能留下 `.git/index.lock` 或半更新的工作区 | `lib/host-v16.js` 的路由把 `request.signal` 传进 `switchBranch`，后者用它 spawn |
| A2 | 中 | 分支按钮自带 `title="切换分支"`，把根节点那份"仓库路径 / 领先落后 / 改动文件数"的 tooltip 整片盖住 | 代码位置见优化计划书 PL-02 |
| A3 | 中低 | 切换被拒时只取 stderr 首行，而 git 的脏工作区提示恰好在冒号处断句，**不带挡路文件** | 实测输出 `error: Your local changes … would be overwritten by checkout:` |
| A4 | 中 | 三份最有价值的端到端验证只存在于 `/tmp`，仓库内无法复跑（违背"不落盘、未验证不得宣称完成"） | `/tmp/verify-git-route.mjs` 等四份脚本 |
| A5 | 中 | README / CHANGELOG / `package.json` 版本都没跟上，功能已落地但文档里查不到 | CHANGELOG 最新仍是 1.5.0；`version: 1.5.0` |
| B1 | 中低 | `git switch` 需要 git ≥ 2.23，而 DSH 官方只要求 ≥ 2.13；旧 git 上按钮会出现但点了只会看到 git 的报错 | `git --version` 本机 2.50.1，非本机情况未实测 |
| B2 | 低 | detached HEAD 时 `%(HEAD)` 不标记任何分支，菜单里没有"当前在哪"的提示 | 临时仓库 `for-each-ref` 输出两行都不带 `*` |
| B3 | 低 | agent 正在跑轮次时切分支没有提示，本轮后续命令会跑在新分支上 | 无护栏 |
| B4 | 低 | 切换后若恰有一次读在飞，POST 可能返回切换前的读数 | `read()` 的 1.5s 缓存 + 在飞合流 |
| B5 | 低 | POST body 没有显式大小上限 | 依赖连接层 |
| B6 | 低 | 菜单无键盘导航；≤320px 时分支名被隐藏，按钮没有可访问名字 | CSS 阶梯 + 无 `aria-label` |
| C1 | 低 | `data-git-branches` / `data-git-picker` 没进契约清单 | `.project-architect.json` 只登记了 `data-git-status` |
| C2 | 低 | zh/en 词典齐平没有自动化守卫 | **该守卫一上线立刻抓到一条真 bug**：`balanceLoading` 一直缺，读不到余额时 tooltip 会把键名显示给用户 |
| C3 | 低 | 客户端 `branches` 映射无单测 | `test/client.test.mjs` 里 `branches` 出现 0 次 |
| C4 | 低 | 路由的 400/404/409 分流无单测，且 409 分支真机从未触发 | `gitStatusRoute` 未导出 |
| C5 | 低 | 可行性取证文档写的是"只读 git / 不做 PR"，已被 CR-0002 部分取代 | 历史产物按约定不改写，但不能再当现状 |
| C6 | 低 | profile 里留着开发挂载（`sym-dev` + 停用包安装条目） | 会跟着重启保留 |
| C7 | 低 | 未提交状态在 git 眼里是 +557/−1105（重命名未被识别） | `git diff --shortstat HEAD` |

## 三、处置

见同时间戳的**优化计划书**（`…-git-status-optimization-plan.md`）：A1–A5 全部修完，
B1/B2/B4/B5/B6 修完，B3 改为"提示但不拦"，C1–C4 补完，C5/C6/C7 记录为已知事项。
