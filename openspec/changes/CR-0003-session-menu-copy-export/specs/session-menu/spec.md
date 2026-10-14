---
id: FR-13
type: functional-requirement
status: draft
version: 0.1.0
created_at: 2026-10-13T21:00:00+08:00
owner: project-owner
related: [CR-0003, NFR-02]
supersedes: []
evidence: []
---

# FR-13｜侧栏会话菜单的「复制会话 ID」与「导出会话日志」

本文件是 CR-0003 对基线的**增量**；基线回填前不写入 `openspec/specs/`。

## 目标与范围

- 用户/角色：在本机用 DSH 的人，需要在会话列表上直接取用某个会话的标识或导出它的日志。
- 触发条件：侧栏某个会话行悬停 → 点「⋯」打开该会话的菜单。
- 成功结果：菜单里除了官方四项之外，还有「复制会话 ID」与「导出会话日志」两项，
  中间以分隔线与官方项分开；两项分别把 ID 放进剪贴板、启动与官方头部入口同一个日志下载。
- 范围外：导出内容/目标位置的改动；复制标题或路径；侧栏悬停按钮行。

## Requirements

### Requirement: 复制会话 ID

系统 SHALL 在侧栏每个会话的「⋯」菜单里提供一项「复制会话 ID」，选中后把**该会话的标识原文**
（裸 ID，不含标题、不含 JSON 包装）写入系统剪贴板。

#### Scenario: 复制成功

- **WHEN** 剪贴板可用且宿主接受写入
- **THEN** 剪贴板内容等于该会话的 ID，菜单关闭

#### Scenario: 剪贴板被拒绝

- **WHEN** 宿主拒绝写入（权限或环境不支持）
- **THEN** 菜单**保持打开**，该项文案改为失败提示；系统 SHALL NOT 表现得像复制成功

#### Scenario: 标识不是字符串

- **WHEN** 会话标识是数字等非字符串值
- **THEN** 写入剪贴板的是它的字符串形式

### Requirement: 导出会话日志

系统 SHALL 在同一菜单里提供一项「导出会话日志」，选中后触发**与会话头部「更多操作 →
下载 Session 日志」完全相同**的导出行为；系统 SHALL NOT 自建第二套导出实现。

#### Scenario: 触发导出

- **WHEN** 用户选中「导出会话日志」
- **THEN** 该会话的日志下载被启动，进度与结果由官方导出弹窗报告；菜单关闭

#### Scenario: 该会话正在导出

- **WHEN** 同一会话已有一项导出在进行
- **THEN** 该项被禁用并显示进行中文案；再次选中不会产生第二份下载

#### Scenario: 部署里没有官方导出包

- **WHEN** 官方 `sessionLogDownload` 服务不可用
- **THEN** 该菜单项**根本不注册**（菜单里不出现空白行），复制项照常可用

### Requirement: 纯加法接入，官方菜单与布局不受影响

系统 SHALL 只通过 list 型槽 `sidebar.workspaces.session.menu.item` 追加条目；
官方 pin(100) / rename(200) / fork(300) / archive(400) 四项 SHALL 保持原样渲染。

#### Scenario: 官方四项不变

- **WHEN** 菜单打开
- **THEN** 官方四项仍在原位、顺序与行为不变；新增两项排在其后，第一项上方有官方样式的分隔线

#### Scenario: 官方菜单叶子不可用

- **WHEN** 部署里没有官方 primitives 的 `MenuItemButton`
- **THEN** 两项都不注册，菜单保持官方四项

## 非功能与验收

- 性能/可靠性：两项不发起自己的网络请求与轮询；导出复用官方控制器的每会话并发折叠。
- 安全/权限：只写剪贴板；不读文件系统、不新增跨端路由、不碰凭据。
- 可观测性：复制被拒、导出服务缺失、导出调用抛错各经 `noteDegrade` 记录一次
  （来源分别为 `sessionMenu:clipboard` / `sessionMenu:exportService` / `sessionMenu:export`；
  primitives 缺失记 `sessionMenu:primitives`）。
- 无障碍/兼容性：复用官方 `MenuItemButton` → `role="menuitem"` 与官方键盘走查、焦点归还；
  文案跟随界面语言（走槽的 locale 座位，缺座位时回退内置中文）。
- 关联回归：`REG-0003`（见 `tasks.md`）。
