---
id: CR-0003
type: change-request
status: draft
version: 0.1.0
created_at: 2026-10-13T21:00:00+08:00
owner: project-owner
related: [FR-13, FR-11, CR-0002, NFR-02]
supersedes: []
evidence: []
---

# CR-0003｜侧栏会话菜单加「复制会话 ID」与「导出会话日志」

## Proposal

- 基线：`CR-0001` / `CR-0002`（会话头部 Git 胶囊与分支切换）。本次不触碰 git 相关契约。
- 变更原因与证据：用户实机提出 ——「在每个会话的更多菜单里，可以加上复制会话 id 的菜单吗，
  现在是没办法复制这个会话的 id，也没有导出这个会话的菜单。」两条诉求各自成立：
  - **会话 ID 没有任何取用入口**：宿主用会话 ID 命名落盘文件
    （`~/.dsh/storages/session_projcache/sessions/<id>.json`）与日志，但界面从不显示，
    用户要贴进命令行 / issue 时只能去翻文件系统。
  - **导出功能早就存在，入口只有一个**：官方 `@deepseek-ai/dsh-session-log-export`
    在**会话头部**的「更多操作」里提供「下载 Session 日志」，而**侧栏会话列表行的「⋯」菜单里没有** ——
    用户在列表里逐个会话右键时找不到它，于是认为"没有导出菜单"。
- 新增、修改、删除的语义：
  - 新增 `FR-13`：侧栏每个会话行的「⋯」菜单追加两项 ——
    **复制会话 ID**（复制裸 UUID 到剪贴板）与**导出会话日志**（触发与官方头部入口同一个 ZIP 下载）。
  - **不新增任何跨端契约、不新增路由、宿主侧零改动**：复制走浏览器剪贴板；
    导出把请求交给官方已注册的客户端服务 `sessionLogDownload`（`download(sessionId)`）。
  - 接入方式是**加法**：`sidebar.workspaces.session.menu.item` 是 `list` 型槽
    （官方标注 `replaceRisk: none`），官方四项 pin(100)/rename(200)/fork(300)/archive(400)
    原样保留，新增项 order 取 900 / 901 排在它们之后，并在第一项上用官方
    `MenuItemButton` 的 `separatorBefore` 画官方那条发丝分隔线，视觉上自成一组。
  - **不接管任何 `single` 型槽、不改官方 CSS、不加静态定位规则**。
- 范围外：导出内容的格式与目标位置（浏览器下载，由官方包决定，本次不改）；
  复制「会话标题」「会话路径」等其他字段；侧栏**悬停按钮行**
  （`sidebar.workspaces.session.row.action`）不加东西 —— 用户只要求菜单项。
- 审批人和日期：待 project-owner 审批（与实现同批交付）。

## 影响分析

| 维度 | 影响 | 证据/动作 |
| --- | --- | --- |
| 用户语义与验收 | 侧栏会话「⋯」菜单在官方四项下方多出两项，中间有分隔线；复制项把裸 ID 放进剪贴板；导出项触发与头部入口一致的下载弹窗 | 见 `specs/session-menu/spec.md` 的新增 Requirement |
| 模块/API/事件 | **无新契约**。客户端新增 `installSessionMenu(ctx)` 与两个槽组件；依赖官方**既有**客户端服务 `sessionLogDownload`（`ctx.provide` 暴露，非 Remote、非新通道）与官方 primitives 的 `MenuItemButton` / `IconCopyOutlineRegular` / `IconDownloadOutlineRegular` / `writeClipboard` | `lib/client.js` 的 `#region session menu` |
| 数据/迁移 | 无持久化、无迁移 | — |
| 权限/安全 | 只读 + 写剪贴板；不碰文件系统、不发新网络请求（导出走官方既有的认证路由 `/api/session.export`，由官方包拥有） | 无新增鉴权面 |
| UI/无障碍 | 复用官方 `MenuItemButton` → 得到官方单元格样式、`role="menuitem"`、hover 底、分隔线；槽的键盘走查与焦点归还由 owner 负责（官方实现按 DOM 收集行，我们的行自动入列） | 官方槽目录原文已核对 |
| 测试/回归 | 新增 8 条客户端用例（槽名与 order、裸 ID、分隔线、失败不关菜单、成功关菜单、服务缺失退场、下载中禁用、条件注册） | `npm test` |
| 监控/发布/回滚 | 降级写 `noteDegrade`（`sessionMenu:*` 四个来源）；回滚＝删掉 `installSessionMenu` 的调用 | 无状态迁移 |

## 验收与回滚

- 新增 `REG-0003`（见 `tasks.md`）。
- 验证：`npm test`；运行时用 Cordis Inspect 的 Client Slots provider 查
  `sidebar.workspaces.session.menu.item` 的 occupants，确认两项已注册且 `active`。
- 回滚触发与步骤：菜单出现异常（缺项 / 顺序错 / 影响官方四项）时，注释掉 `apply` 里的
  `installSessionMenu(ctx)` 一行即可，无数据迁移。

## LOC 决议（本 CR 的第二个主题）

本次给 `M-CLIENT`（`lib/client.js`）净增 339 行（3310 → 3649），**突破** `.project-architect.json`
的 `loc.hardCeiling.M-CLIENT = 3400`。

- **为什么必须提阈值，而不是继续压**：改动前只剩 90 行余量；已把注释压到"只留为什么"的极限
  （删掉 JSDoc 复述、合并重复守卫、试抽 helper 后因净增 6 行而回退），再压就要删掉项目最看重的
  设计理由注释。**客户端半边不能拆文件**（`file://` 挂载没有 bundle URL，`require.async`
  解析不了 chunk，见 AGENTS.md），所以"超出即拆分"的常规处置在此不适用。
- **决议**：`M-CLIENT` 上限 3400 → **3700**（CR-0003）。与 CR-0001（3000→3300）、
  CR-0002（3300→3400）同一处置路径。
- ⚠️ **登记风险**：本次之后 `M-CLIENT` 只剩 51 行余量，下一个客户端功能**必然**再次触顶。
  下一个客户端功能的正确起手式是先做一轮**就地压缩**（不是先提阈值）；
  若压缩不足以腾出空间，再评估把客户端半边改成走 HTTP bundle 服务的包安装形态以支持拆文件。
