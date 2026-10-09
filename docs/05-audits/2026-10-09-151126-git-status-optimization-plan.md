---
id: PLAN-REVIEW-0002
type: optimization-plan
status: applied
created_at: 2026-10-09T15:11:26+08:00
owner: project-owner
related: [AUD-REVIEW-0002, CR-0001, CR-0002]
---

# 优化计划书：Git 状态胶囊与分支切换（对应 AUD-REVIEW-0002）

> 读法：**审计报告**看"哪里有问题、证据是什么"，本文件看"怎么修、谁负责、验证了什么"。
> 状态：✅ 已完成 / 📌 记录为已知事项（不在本次修）。

## 一、批次一：缺陷修复

| ID | 处置 | 落点 | 状态 | 验证 |
| --- | --- | --- | --- | --- |
| PL-01（A1） | 写操作改用**自己的 30s 超时 signal**，不再复用请求 signal；读前置仍用请求 signal | \`lib/host-v17.js\` 的 \`switchBranch\` + 新常量 \`GIT_SWITCH_TIMEOUT_MS\` | ✅ | 单测「A1：浏览器断连不得打断已经开始的切换」：前置读期间 abort，切换仍成功，且写入用的 signal 不是请求那个 |
| PL-02（A2） | 分支按钮去掉 \`title\`，改 \`aria-label="切换分支 · <分支>"\`，把信息 tooltip 还给根节点 | \`lib/client.js\` 的 \`GitStatusCell\` | ✅ | 离屏用例断言 \`button.props.title === undefined\` 且 \`aria-label\` 含"切换分支" |
| PL-03（A3） | 失败理由改成"首行 + 若首行以冒号结尾再带下一行（挡路文件）"，仍限 200 字符 | \`refusedReason()\` | ✅ | 单测断言 message 含 \`lib/client.js\`；真机脏工作区复测 |
| PL-04（A4） | 两份端到端验证搬进仓库：\`test/git-e2e.test.mjs\`（临时仓库真 git）、\`test/git-picker.test.mjs\`（离屏点击链路，自带迷你 hook 运行时） | \`test/\` | ✅ | \`npm test\` 89 项；\`git-picker\` 迁移时还暴露了"全局替身过早恢复"的坑（已修：替身活到 teardown） |
| PL-05（A5） | README 增「8. Git 状态胶囊」+ 图标表一行；CHANGELOG 增 1.6.0；\`version\` 1.5.0 → 1.6.0 | 三处 | ✅ | 文件存在且内容与实现一致 |

## 二、批次二：边界与体验

| ID | 处置 | 状态 | 验证 |
| --- | --- | --- | --- |
| PL-06（B1） | \`git switch\` 失败且 stderr 提示命令不存在/不支持时，回退 \`git checkout <branch>\`（名字已过白名单、不以 \`-\` 开头，故安全） | ✅ | 单测「B1」断言回退 argv 恰为 \`checkout feat/x\` |
| PL-07（B2） | detached HEAD 时菜单顶部加一行「当前不在任何分支上（游离头 <sha>）」 | ✅ | 离屏用例可用同一渲染路径覆盖；真机游离头未复测（无该状态） |
| PL-08（B3） | **不拦，只提示**：agent 运行时菜单里多一行"本轮后续命令会跑在新分支上"（\`useSession(s => s.running)\`，槽不投影该 hook 时用恒定 fallback 顶上，保证 hook 位置稳定） | ✅ | 需要真机跑一轮确认；单测侧不投该 hook，走 fallback 分支 |
| PL-09（B4） | 读缓存加"代次"：切换后 \`pending.delete\` + 代次 +1，切换前那次读结束时不再写缓存 | ✅ | 单测「B4」用手控 gate 制造在飞读，断言切换后读到新分支、旧读结束也不污染缓存 |
| PL-10（B5） | \`content-length > 4096\` 直接 413 | ✅ | 单测「C4：超大 body 直接 413」 |
| PL-11（B6） | 打开菜单时聚焦首个可用项；↑/↓ 在可用项间移动（Esc/点击外部照旧）；分支名按钮有 \`aria-label\` | ✅ | 离屏用例不覆盖键盘（假 DOM 无 activeElement 语义）；**真机待确认** |

## 二·五、批次四：读数节奏（用户实机反馈"信息出来慢半拍、要落后两秒"）

先量再改：路由本身冷态 **~70ms**、热态 ~1ms，所以"2 秒"不在网络，在**节奏**。

| ID | 处置 | 状态 | 验证 |
| --- | --- | --- | --- |
| PL-20a | 宿主四次 git 询问改**一轮并行**；仓库根路径按目录只读一次；分支清单 4s 内复用 | ✅ | 真机冷态 **70ms → 30ms**；直接跑 git 对照：串行 36ms / 并行 20ms |
| PL-20b | 客户端轮询 **5s → 2s**；读缓存 1.5s → 0.7s（只用来合流多实例） | ✅ | 服务端 bundle 复核 `GIT_REFRESH_MS = 2000` |
| PL-20c | 首次失败按 **400/900/1800ms** 快速重试（宿主未就绪/刷新后第一枪不再白等一个周期） | ✅ | bundle 复核 `GIT_RETRY_MS = [400, 900, 1800]`；重试定时器在卸载时清理 |
| PL-20d | **智能体一轮结束**（running true→false）的那一刻立刻重读 —— 通常正是文件刚改完 | ✅ | bundle 复核 `wasRunning`；单测侧不投该 hook，走 fallback |

## 三、批次三：遗漏与一致性

| ID | 处置 | 状态 |
| --- | --- | --- |
| PL-12（C1） | \`data-git-branches\` / \`data-git-picker\` 登记进 \`.project-architect.json\` 的 \`M-CLIENT.publicContract\` | ✅ |
| PL-13（C2） | 新增词典守卫：zh/en 键集必须齐平，且源码里 \`tr(t,"…")\` 用到的键两边都要有。**上线即抓到 \`balanceLoading\` 一直缺失**（读不到余额时工具提示会显示键名），已补中英文案 | ✅ |
| PL-14（C3） | \`describeGitStatus\` 的 branches 过滤/current 标记/缺省数组补单测 | ✅ |
| PL-15（C4） | 导出 \`gitStatusRoute\` 并补 400/404/409/413/200 五条分流的单测；POST 允许从查询串取 \`sessionId\` 兜底（测试时发现此前只认 body，手写请求极易踩空） | ✅ |
| PL-16（阈值） | \`.project-architect.json\` 的 \`loc.hardCeiling.M-CLIENT\` 3300 → **3400**：本批实到 3274（仅剩 26 行）。客户端半边不能拆文件，下次再逼近必须先就地压缩 | ✅ |
| PL-17（C5） | 可行性取证文档按"历史产物不改写"保留原文；由本对产物注明它已被 CR-0002 部分取代 | ✅ |
| PL-18（C6） | profile 的 \`sym-dev\` 开发挂载保留（切 \`link:\`/\`file:\` 需一次 App 重启），已在 AGENTS「环境事实」写明回滚与长期方案 | 📌 |
| PL-19（C7） | 工作区仍未提交；建议 \`git add -A\` 后再提交（让 git 认出 \`host-v13 → v17\` 的重命名），或分"功能 / 换名"两次提交 | 📌 |

## 四、本轮验证汇总

- \`npm test\`：**89 项全绿**（含真 git 临时仓库 4 项、离屏点击链路 2 项、路由分流 5 项、词典守卫 1 项），耗时约 1s。
- 真机（DSH 桌面应用，profile 的 \`sym-dev\` 挂载）：GET 带 \`branches\`；POST 同名 no-op 200；未知分支/\`-f\`/缺参 400。
- 未验证：真实浏览器里的点击与键盘操作（客户端改动需刷新页面）、detached HEAD 的真机提示、agent 运行中提示的真机表现。
