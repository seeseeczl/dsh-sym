---
id: CR-0006
type: change-request
status: draft
version: 0.1.0
created_at: 2026-10-20T15:51:30+08:00
owner: project-owner
related: [FR-13, CR-0003]
supersedes: []
evidence: []
---

# CR-0006｜下架「复制会话 ID」，保留「导出会话日志」

## Proposal

- 基线：`CR-0003`（侧栏会话菜单加「复制会话 ID」与「导出会话日志」）。
- 变更原因与证据：**官方客户端已经内置了同一个功能，实现还更完整。**
  2026-10-20 查本机 `app.asar`（`@deepseek-ai/dsh-client-ui-workspace@0.2.1-rc.2`）：
  - 槽 `sidebar.workspaces.session.menu.item` 多出**第五项**：
    ```js
    ctx.slots.register({
      name: "sidebar.workspaces.session.menu.item",
      id: "session-id",
      order: 450,          // pin(100) / rename(200) / fork(300) / archive(400) 之后
      locale: NS,
      inject: sessionIdInjected
    }, SessionIdMenuItem);
    ```
  - `SessionIdMenuItem` 的行为：复制**裸 `sessionId`**、**关菜单**、用官方
    `writeClipboard` 的结果发 **toast**（`toast.sessionIdCopied` / `toast.sessionIdCopyFailed`），
    文案 `menu.sessionId` = 「复制 Session ID」。
  - 本插件原来那一行 `sym-copy-session-id`(order 900) 做的**完全是同一件事**（复制裸 ID），
    只是失败时保留菜单改行内文案。两行都注册时，菜单里会出现**两条同义项**。
- 删除的语义（FR-13 收缩）：
  - **删除**：本插件对「复制会话 ID」的注册、组件、剪贴板 helper 与三条文案。
    「复制会话 ID」不再由本插件提供，改由官方 450 那一行负责。
  - **保留**：`sym-export-session`(901) 不变 —— 官方导出入口仍在**会话头部**，
    侧栏会话菜单里**没有**导出，所以这个第二入口仍然有效（2026-10-20 复核官方
    `session.row.action` 与 `menu.item` 两个槽，均无导出项）。
- 范围外：不接管、不改写官方 450 那一行；不删导出项；不改宿主（本次零宿主改动）；
  不做"运行时探测官方有没有该行"的兼容分支（理由见 `design.md`）。
- 审批人和日期：待 project-owner 审批（与实现同批交付）。

## 影响分析

| 维度 | 影响 | 证据/动作 |
| --- | --- | --- |
| 用户语义与验收 | 侧栏会话「⋯」菜单从"官方各项 + 本插件两项"变成"官方五项 + 本插件一行（导出）"；**「复制会话 ID」仍然存在，由官方提供**，且多了 toast 反馈 | `specs/session-menu/spec.md` 的修订 Requirement |
| 模块/API/事件 | **无新契约**。客户端删除 `CopySessionIdMenuItem`、`copyPlainText`、`IconCopyOutlineRegular` 引用、`exports` 两项；`menuPrimitives` 保留（导出项仍在用） | `lib/client.js` 的 `#region session menu` |
| 数据/迁移 | 无持久化、无迁移 | — |
| 权限/安全 | 剪贴板写入面从本插件移到官方；本插件不再触碰剪贴板 | 无新增鉴权面 |
| UI/无障碍 | 官方那一行在 order 450（归档之后、官方组内），无 `separatorBefore`；本插件导出项 901 仍带 `separatorBefore`，于是分隔线落在**官方五项**之后，语义正好是"官方组 / 附加项" | 官方槽目录已核对 |
| 测试/回归 | 删除 1 条冒烟断言里的 `CopySessionIdMenuItem`；词典守卫动态检查（删 3 键后中英仍齐平）；全量 `npm test` 应为 113/113 | `npm test` |
| 监控/发布/回滚 | 降级来源少一个（`sessionMenu:clipboard` 不再出现）；回滚＝恢复 1.7.0 的实现（`git revert` 本 CR 的提交） | 无状态迁移 |

## 验收与回滚

- 新增 `REG-0006`（见 `tasks.md`）。
- 验证：`npm test`；真机重启 App 后确认菜单里**只有官方那一条**「复制 Session ID」，
  且「导出会话日志」仍在官方五项之下、有发丝分隔线。
- 回滚触发与步骤：官方日后移除该功能、或本插件需要在旧版 DSH 上提供复制时，
  `git revert` 本 CR 的提交即可恢复（无数据迁移）。

## LOC 影响

`M-CLIENT`（`lib/client.js`）**净减**（−46 行：两个函数、中英各三条文案、两条导出）。
`.project-architect.json` 的上限保持 3800 不变，余量进一步增大。
