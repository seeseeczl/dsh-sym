---
id: CR-0002
type: design
status: draft
version: 0.1.0
created_at: 2026-10-09T16:20:00+08:00
owner: project-owner
related: [FR-12]
supersedes: []
evidence: []
---

# CR-0002 技术方案｜分支切换

## 1. 契约变化

```text
GET  /api/sym.git?sessionId=<id>          → 同 CR-0001，载荷新增 branches
POST /api/sym.git   { "sessionId": "…", "branch": "feat/x" }
  200 { ok: true,  payload: <切换后的同一份读数> }
  400 { ok: false, message }   缺参 / 分支名不合法 / 分支不存在
  404 { ok: false, message }   会话不存在 / 无工作目录 / 不是 git 仓库
  409 { ok: false, message }   git 拒绝（典型：工作区改动会被覆盖）
  413 { ok: false, message }   body 超过 4096 字节（评审整改 PL-10）
```

`branches`：`[{ name, current }]`，**当前分支排第一**，其余按 `-committerdate`（git 的默认
近因顺序）。

## 2. 宿主实现

- `git for-each-ref --sort=-committerdate --format=%(refname:short)%09%(HEAD) refs/heads`
  （一次调用，实测输出 `main\t*` / `feat/x\t`），`parseBranches(stdout)` 转成
  `[{name,current}]` 并把 current 排到首位。
- `switchBranch(cwd, branch, signal)`：
  1. **白名单**：先跑一次分支列表，`branch` 不在其中 → `{ ok:false, code:'unknown' }`，
     **一个 git 子进程都不写**；
  2. 名称校验（长度 ≤255、不含控制字符、不以 `-` 开头）；
  3. `git switch -- <branch>`（`--` 终止选项；argv 传参，永不经过 shell）；
     若 stderr 表明这个 git 没有 `switch`（< 2.23），回退 `git checkout <branch>`
     —— 名字已过白名单且不以 `-` 开头，所以这个老形式既不会被当成选项也不会被当成路径；
  4. 非 0 退出 → `{ ok:false, code:'refused', message: stderr 首行 }`（截断 200 字符）；
  5. 成功 → `cache.delete(cwd)`（1.5s 读缓存按 cwd 失效）并返回新鲜读数。
- 环境沿用读取器那套（`GIT_CONFIG_COUNT=0` / `GIT_TERMINAL_PROMPT=0` / `GIT_OPTIONAL_LOCKS=0` /
  `LC_ALL=C`）。**刻意不加 `-f` / `--discard-changes`**：宁可由 git 拒绝，也不丢用户的工作区改动。
- **写操作自己的超时（30s），不复用请求 signal**（评审整改 PL-01）：页面刷新会中止请求 signal，
  拿它去 kill 一个正在写工作区的 `git switch` 可能留下锁或半更新状态。
- 读缓存带**代次**（PL-09）：切换后让在飞的那次读失效，它结束时不得把旧分支写回缓存。

## 3. 客户端实现

- 分支名（图标 + 文本）合成一个 `<button class="dshGit_branchBtn">`；**仅当 `branches.length > 1`**
  时可点击，只有一个分支时退回 `<span>`（用户原话："在项目有其他分支的时候"）。
- 点击 → `ReactDOM.createPortal` 一个 `.dshSym_menu`（沿用官方弹层配方与既有菜单类），锚在按钮
  下方、按视口夹紧；`pointerdown` 外部关闭、Esc 关闭（复用 `CostPanel` / `LinkContextMenu` 的写法）。
- 菜单项：分支名；当前分支带 ✓ 且不可点；其它项点击 → `POST`，切换期间显示"切换中…"并禁用；
  失败把 `message` 显示在菜单底部（例如 git 那句 "Your local changes … would be overwritten"）。
- 工作区有改动（`files + untracked > 0`）时菜单顶部给一行灰字提示：冲突的切换会被 git 拒绝。
- 切换成功 → 关闭菜单 + 立刻重读（不等待 5s 轮询）→ 胶囊上的分支名与增删行数一起更新。

## 4. 取舍与被否方案

| 方案 | 否决原因 |
| --- | --- |
| 走官方 Remote / 另开通道 | 客户端能力的命名空间构建期固定，加不了新 Remote（AGENTS 第 1 条） |
| `git checkout` 而非 `git switch` | `switch` 语义就是"切分支"，不会像 `checkout` 那样在参数歧义时变成还原文件 |
| 直接把用户输入拼进命令 | argv 传参 + 白名单 + `--`，三条一起用，避免任何注入面 |
| 切换前自动 `stash` | 会动用户的工作区状态，插件不该替用户决定；交给 git 拒绝并原样回显 |
| 显示远端分支并支持切换 | 需要建立 tracking branch（隐含 `--track`），超出本次范围 |
