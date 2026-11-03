---
id: CR-0007
type: tasks
status: draft
version: 0.1.0
created_at: 2026-11-03T12:00:00Z
owner: project-owner
related: [FR-13, CR-0001, CR-0002, CR-0005]
supersedes: [CR-0005]
evidence: []
---

# CR-0007 任务卡（原子、可验证）

| # | 任务 | 落点 | 完成判据 |
| --- | --- | --- | --- |
| T-01 | 取证：官方 Remote 是否有 git 能力 | `dsh-api-remotes/lib/client.js` | 29 个命名空间里无 git/revert/checkout/history —— 故复用既有认证路由 |
| T-02 | 取证：`conversation.view` 是否投影 `sessionId` | `dsh-client-ui-conversation/lib/client.js` | `renderSlot("conversation.view", {…})` 无 sessionId；外层 `data-conversation-session` 可读 |
| T-03 | 宿主：`parseGitLog` + `log()` 分页读取 | `lib/host-v20.js` | `%x00` 分隔、N+1 判 hasMore、limit 夹紧、空仓库返回空列表 |
| T-04 | 宿主：`reset()`（soft/mixed/keep，拒绝 --hard） | 同上 | 非法 mode 在跑 git 前返回 `invalid`；argv 用解析后的完整哈希 + 尾随 `--` |
| T-05 | 宿主：`revert()` + `revertState()` + `abortRevert()` | 同上 | 冲突返回 `conflict`+files+revert；在途返回 `busy`；abort 用 `revert --abort` |
| T-06 | 宿主：路由加 `kind=log` 与三个 action | 同上 | `action` 缺失仍走切分支（CR-0002 回归）；409/400/404/413 映射正确 |
| T-07 | 客户端：`describeCommitLog` / `formatCommitTime` / `sessionIdOf` | `lib/client.js` | 纯函数，缺数据不编造（null 保留、坏行丢弃） |
| T-08 | 客户端：`CommitLogView` 替换占位 | 同上 | 五列 grid、分页、状态机、写前二次确认、冲突提示可读 |
| T-09 | 客户端：标签名「工作区」→「提交记录」 | 同上 | `zh.symViewTab` / `en.symViewTab` 同步；中英键集齐平 |
| T-10 | 客户端：未完成回滚的提示与「中止」入口 | 同上 | 刷新后仍能从列表载荷看到并中止 |
| T-11 | 回归：解析 / argv 守卫 / 路由 / 渲染冒烟 | `test/host.test.mjs`、`test/client.test.mjs` | `npm test` 135 项全绿 |
| T-12 | 真机：列表 / 分页 / 不重不漏 | 真实 git 临时仓库 | 15 项通过 |
| T-13 | 真机：冲突 → 认出 → busy → abort → 恢复 | 真实 git | 9 项通过 |
| T-14 | 真机：HTTP 层（含切分支回归） | 真实 `Request`/`Response` | 11 项通过 |
| T-15 | 治理：`.project-architect.json`（契约 + 阈值 + 模块角色） | 事实源 | JSON 合法；阈值 ≥ 实测值 |
| T-16 | 治理：AGENTS.md 接口契约段、CHANGELOG、版本号 1.8.3 | 多处文档 | 与实现一致；`npm run check` 全过 |
| T-17 | 生效：同步包副本（宿主 + 客户端）并重启 | `~/.dsh/profiles/desktop/node_modules/dsh-sym` | 包内 `lib/host-v20.js` 可导出新函数；重启后界面显示「提交记录」 |
| T-18 | **界面真机确认** | 用户重启后目视 | **待验证** —— 本卡未完成前不得宣称交付 |
| T-19 | 行头排版：状态行与表头分层、间距归刻度表、日期列右对齐 | `lib/client.js` | 全部 padding/gap 落在 4/8/12/16/24/32；表头与内容同对齐 |
| T-20 | 列宽可拖拽：两根 12px 手柄列 + 本机持久化 | 同上 | 拖拽方向跟手、越界夹取、刷新后记住；窄屏收起日期列时手柄一并收起 |
