---
id: CR-0007
type: change-request
status: draft
version: 0.1.0
created_at: 2026-11-03T12:00:00+08:00
owner: project-owner
related: [FR-13, CR-0001, CR-0002, CR-0005]
supersedes: [CR-0005]
evidence: []
---

# CR-0007｜把对话视图的「工作区」改造成「提交记录」，并支持重置 / 回滚

## Proposal

- 基线：`CR-0005` 把 `conversation.view` 的第三个标签做成**占位**（`sym-view`，
  正文一句「这个区域待建设」），因为内嵌 chat.deepseek.com 被三条平台级制约堵死
  （站点风控 / 登录态不跨重启 / webview 语言锁死 `en-US`）。
- 用户诉求（原话）：
  1. 「把提交记录、描述、ID 都列出来」，形态参照一张 `描述 / 提交 / 作者 / 日期` 的表格；
  2. 「能重置到某笔提交」——**重置只改变本地的版本**；
  3. 「可以回滚某笔提交」——**放弃某一次提交的改动**，与 git 的操作一样。
- 变更内容：
  - 占位视图换成**提交记录表**（描述 / 提交 / 作者 / 日期），当前分支、分页加载；
  - 新增三种宿主写操作：`reset`（soft / mixed / keep）、`revert`、`revert-abort`；
  - 标签名由「工作区」改为「提交记录」。
- **为什么不新增 Remote**：官方 Remote 的 29 个命名空间里**没有任何一个带 git 能力**
  （2026-11-03 从 `dsh-api-remotes/lib/client.js` 逐个核过：account / agentPresets /
  commands / credentials / directoryPicker / dynamicCordisRunner / fileReferences /
  fileUploads / goals / job / llm / messageFeedback / officeToPdf / permissionPresets /
  pluginInventory / pluginManager / pluginMarket / pluginRegistryProbe / productAnalytics /
  schedule / session / sessionFeedback / sessionReferenceResolver / settings / skills /
  subagents / terminal / userQuestions / workspace / workspaceFiles —— 无 git、无 revert、
  无 checkout、无 history）。客户端也**加不了**新的 Remote 通道（构建期选定，见 AGENTS.md
  边界 1）。所以沿用 CR-0001 建好的认证路由 `GET|POST /api/sym.git` —— 这是**既有通道**，
  官方改动文件卡片同样走"认证路由 + 浏览器 fetch"这一形态。

## 安全边界（本 CR 的核心约束）

`reset` 会移动分支，`revert` 会写一个新提交。两者都容易造成不可逆损失，因此：

1. **永不 `--hard`**。`reset` 只接受 `soft` / `mixed` / `keep` 三个封闭值，其他一律在
   到达 git 之前返回 `invalid`。`--hard` 会静默删掉用户未提交的改动 —— 这是本插件
   唯一明确拒绝替用户做的决定。
2. **永不触碰远程**。不 add / commit / push，不取 remote，不调托管平台 API，不碰凭据。
   "重置只改变本地版本"因此是**结构上成立**，而不是靠调用方自觉。
3. **提交 id 必须解析成完整哈希**。先用 `git rev-parse --verify <id>^{commit}` 拿到
   40 位哈希，再把它交给写命令；调用方给不出选项、表达式或路径。
   `HEAD~1` 这类表达式**不接受**（请求里只认提交 id）。
4. **冲突如实回报**。`revert` 冲突时 git 会停在 `REVERT_HEAD`，此时返回
   409 + `code: 'conflict'` + 挡路文件清单，并提供 `revert-abort` 让用户在界面上收尾
   —— 而不是假装成功，也不是把用户丢回命令行。
5. **写操作不复用请求的 signal**。页面导航会 abort 浏览器的 signal，而中断一次
   `git reset` 中途比让它跑完更危险（CR-0002 已确立同一规则）。
6. **每次写之前二次确认**，确认框写清提交号、标题，并明说"不会推送"。

## 影响

- `lib/host-v20.js`：新增 `parseGitLog`、`log`、`reset`、`revert`、`revertState`、
  `abortRevert`；路由新增 `kind=log` 与三个 `action`。
- `lib/client.js`：`SymViewPlaceholder` → `CommitLogView`；新增 `describeCommitLog`、
  `formatCommitTime`、`sessionIdOf`；标签名改为「提交记录」。
- `.project-architect.json`：`contracts.gitStatusRoute` 扩展；LOC 阈值调整
  （M-HOST 1800→2100，M-CLIENT 3800→4100，理由见 design.md）。
- 不新增依赖、不新增 Remote、不改官方布局（视图正文由官方 `conversation.view` 槽承载）。
