---
id: FR-13
type: functional-requirement
status: draft
version: 0.2.0
created_at: 2026-10-20T15:51:30+08:00
owner: project-owner
related: [CR-0006, CR-0003, NFR-02]
supersedes: [CR-0003]
evidence: []
---

# FR-13｜侧栏会话菜单的「导出会话日志」（「复制会话 ID」已下架）

本文件是 CR-0006 对 FR-13 的**增量修订**，取代 CR-0003 增量里的「复制会话 ID」部分。
基线回填前不写入 `openspec/specs/`。

## 修订说明

- **删除** Requirement「复制会话 ID」及其 3 个 Scenario。
- **保留** Requirement「导出会话日志」，措辞不变。
- 新增一条**否定性**要求：本插件 SHALL NOT 在同一个菜单里再提供复制会话 ID 的行。

理由：官方 `@deepseek-ai/dsh-client-ui-workspace@0.2.1-rc.2` 已在
`sidebar.workspaces.session.menu.item` 注册 `session-id`(order 450)，复制裸 ID 并以其
`writeClipboard` 结果发 toast。两条同义项并列会让菜单出现重复项。

## 目标与范围

- 用户/角色：在本机用 DSH 的人，需要在会话列表上直接导出某个会话的日志。
- 触发条件：侧栏某个会话行悬停 → 点「⋯」打开该会话的菜单。
- 成功结果：菜单里除官方各项之外，还有「导出会话日志」一行，与官方项以分隔线分开；
  选中后启动与官方头部入口同一个日志下载。
- 范围外：复制会话 ID（由官方提供）；导出内容/目标位置的改动；侧栏悬停按钮行。

## Requirements

### Requirement: 导出会话日志

系统 SHALL 在侧栏每个会话的「⋯」菜单里提供一项「导出会话日志」，选中后触发**与会话头部
「更多操作 → 下载 Session 日志」完全相同**的导出行为；系统 SHALL NOT 自建第二套导出实现。

#### Scenario: 触发导出

- **WHEN** 用户选中「导出会话日志」
- **THEN** 该会话的日志下载被启动，进度与结果由官方导出弹窗报告；菜单关闭

#### Scenario: 该会话正在导出

- **WHEN** 同一会话已有一项导出在进行
- **THEN** 该项被禁用并显示进行中文案；再次选中不会产生第二份下载

#### Scenario: 官方 primitives 缺失

- **WHEN** 官方 `MenuItemButton` 拿不到
- **THEN** 该项不渲染（返回 `null`），菜单里不出现空白行

### Requirement: 不得重复提供复制会话 ID

系统 SHALL NOT 在本插件注册的菜单行里提供「复制会话 ID」；该功能由官方客户端内置
（`session-id`，order 450）提供。

#### Scenario: 菜单内容

- **WHEN** 用户打开侧栏某个会话的「⋯」菜单
- **THEN** 菜单里「复制 Session ID」只出现**一次**，且来自官方；本插件只贡献导出那一行

#### Scenario: 旧版官方客户端

- **WHEN** 运行环境里的官方客户端**没有**内置该行（版本早于 `0.2.1-rc.2`）
- **THEN** 菜单里没有复制入口 —— 这是可接受的降级，本插件**不**做版本探测或兜底实现
