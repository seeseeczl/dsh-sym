---
id: FR-14
type: functional-requirement
status: draft
version: 0.1.0
created_at: 2026-11-03T12:00:00+08:00
owner: project-owner
related: [CR-0007, CR-0005, CR-0002, NFR-02]
supersedes: [CR-0005]
evidence: []
---

# FR-14｜对话视图「提交记录」（取代 CR-0005 的占位视图）

本文件是 CR-0007 对 `conversation.view` 第三个标签的功能定义，
取代 CR-0005 增量里"保留为占位"的部分。基线回填前不写入 `openspec/specs/`。

## 目标与范围

- 用户/角色：在本机用 DSH 的人，需要在界面里看当前仓库的提交历史，
  并能把本地分支重置到某笔提交、或回滚某笔提交。
- 范围：`conversation.view` 槽的 `sym-view`（order 20，排在官方 chat 0 / trajectory 10 之后）。
- 不在范围：远程操作（不 push / 不 fetch）、PR 流程、提交编辑、rebase、`--hard` 重置。

## Requirement（提交记录列表）

**R1.** 视图 SHALL 列出当前分支的提交，每行显示**描述、提交（短号）、作者、日期**四列。

**R2.** 列表 SHALL 按需分页：首屏取一页，还有更多时提供「加载更多」，直到取完。

**R3.** 日期 SHALL 用本地时间、定宽 `YYYY-MM-DD HH:mm`；时间不可得时该列留空，
**不得**显示 `Invalid Date` 或编造 1970。

**R4.** 缺少提交号（短号与完整哈希都没有）的行 SHALL 被丢弃，不得渲染。

**R5.** 当前 HEAD 所在的行 SHALL 有「当前」标记。

**R6.** 会话目录不是 git 仓库、或没有可用 git 时，视图 SHALL 给出一句说明，
**不得**显示空表或占位数字。

### Scenario：看到的与 git 一致
- **Given** 会话工作目录是一个有 3 笔提交的仓库
- **When** 打开「提交记录」
- **Then** 显示 3 行，最新一笔在最前，提交短号与 `git rev-parse --short HEAD` 一致

### Scenario：分页不重不漏
- **Given** 仓库有 3 笔提交
- **When** 每页取 2 条，翻到第二页
- **Then** 两页合并后与 `git log --format=%h` 的顺序完全一致，且 `hasMore` 在最后一页为假

## Requirement（重置到某笔提交）

**R7.** 视图 SHALL 提供「重置到此提交」，且**只允许**三种模式：
`soft`（改动留在暂存区）、`mixed`（改动留在工作区）、`keep`（无冲突时保留改动）。

**R8.** 视图 SHALL NOT 提供 `--hard` 重置。请求里出现 `hard` 时，宿主 SHALL 在
调用 git 之前拒绝。

**R9.** 重置 SHALL 只改变本地分支位置，SHALL NOT 触碰任何远程。

**R10.** 重置前 SHALL 二次确认，确认内容包含目标提交号与标题。

### Scenario：重置后退回旧版本
- **Given** 当前 HEAD 在第三笔提交，且有未提交改动
- **When** 选择第二笔、用 `keep` 模式重置并确认
- **Then** HEAD 变为第二笔，未提交改动仍在，`git log` 只剩两笔

### Scenario：硬重置被拒
- **When** 请求 `mode: "hard"`
- **Then** 返回 400 且不执行任何 git 写命令

## Requirement（回滚某笔提交）

**R11.** 视图 SHALL 提供「回滚此次提交」，语义与 `git revert` 一致：
在分支顶部生成一个反向提交，**历史不改写**。

**R12.** 回滚冲突时，视图 SHALL 如实说明冲突并列出挡路文件，
SHALL NOT 显示成功。

**R13.** 冲突后仓库停在半个回滚时，视图 SHALL 提供「中止这次回滚」，
使状态可只靠界面恢复；刷新页面后该入口 SHALL 仍然可见。

### Scenario：回滚成功
- **Given** 工作区干净
- **When** 回滚某笔提交
- **Then** 生成一个 `Revert "…"` 提交，提交总数 +1，历史未被改写

### Scenario：冲突与恢复
- **Given** 回滚会与后续提交冲突
- **When** 执行回滚
- **Then** 返回 409 + `code: "conflict"`，提示可中止
- **And** 再次回滚返回 `busy`（不叠加）
- **And** 「中止这次回滚」后 `REVERT_HEAD` 消失、工作区干净、回滚恢复可用

## 非功能要求

**N1.** 写操作 SHALL NOT 复用浏览器请求的 signal（页面导航不得打断 git 写）。

**N2.** 插件缺席、非仓库、或宿主未就绪时，SHALL NOT 改变官方布局任何像素（NFR-02）。

**N3.** 新增的 `data-log-*` 属性为非稳定 API，可随实现调整，但需同步测试。
