---
id: CR-0003
type: tasks
status: draft
version: 0.1.0
created_at: 2026-10-13T21:00:00+08:00
owner: project-owner
related: [FR-13]
supersedes: []
evidence: []
---

# CR-0003 任务卡（原子、可验证）

| # | 任务 | 落点 | 完成判据 |
| --- | --- | --- | --- |
| T-01 | 取证：会话「⋯」菜单是不是可加槽、导出功能是否已存在 | asar `dsh-client-ui-workspace` / `dsh-session-log-export` | 找到 `sidebar.workspaces.session.menu.item`（list / `replaceRisk: none`）与 `ctx.provide("sessionLogDownload")` |
| T-02 | `copyPlainText(primitives, text)`：官方 `writeClipboard` 优先，裸 API 兜底，两种失败形状折成布尔 | `lib/client.js` | 单测：成功 / 被拒 / 无 API 三条 |
| T-03 | `CopySessionIdMenuItem`：复制裸 ID；成功关菜单，失败保留菜单并改文案 | 同上 | 单测：裸 ID、数字转字符串、成功关菜单、失败不关菜单 + 文案切换 |
| T-04 | `ExportSessionMenuItem`：调官方控制器；下载中禁用 + 文案 | 同上 | 单测：`request(sessionId)` 被调用、busy 禁用、服务缺失返回 null |
| T-05 | `installSessionMenu(ctx)`：复制项无条件注册；导出项在 `ctx.inject` 里条件注册 | 同上 | 单测：服务到达前不注册、到达后补注册 |
| T-06 | 文案入 `zh` / `en` 两份字典（5 键） | 同上 | 词典守卫（zh/en 键集齐平 + 代码用到的键两边都有） |
| T-07 | 治理同步：FR-13 入表、`.project-architect.json` 契约与阈值、AGENTS 契约节、README 第 9 节、CHANGELOG 1.7.0 | 多处文档 | 文档与实现一致 |

## 验证矩阵（REG-0003）

| 检查 | 命令/动作 | 期望 |
| --- | --- | --- |
| 单测（全量） | `npm test` | 103/103（原 95 + 本次 8） |
| 槽注册（真机运行时） | Cordis Inspect → client Slots `listSubTree` root=`sidebar.workspaces.session.menu.item` | occupants = 官方四项(100/200/300/400) + `sym-copy-session-id`(900) + `sym-export-session`(901)，全部 `active: true` |
| 官方项未受扰 | 同上 | 官方四项 order 与 id 未变 |
| 词条齐平 | `npm test` 的词典用例 | zh/en 键集一致，新增 5 键两边都在 |
| 回归 | 花费 / 余额 / 竖条 / 设置页 / @ 引用 / Git 胶囊 | 照常 |

## 落地记录（2026-10-13）

### LOC（`wc -l`）

| 模块 | 改动前 | 改动后 | 上限（新） | 本次净增 |
| --- | --- | --- | --- | --- |
| `lib/client.js`（M-CLIENT） | 3310 | **3649** | 3400 → **3700**（本 CR） | +339 |
| `lib/host-v19.js`（M-HOST） | 1546 | 1546 | 1800 | **0（宿主零改动）** |

⚠️ **M-CLIENT 只剩 51 行余量**。下一个客户端功能必须先就地压缩，或评估改走
HTTP bundle 服务的包安装形态以支持拆文件（见 `proposal.md` 的 LOC 决议）。

### 已验证

| 检查 | 命令 / 动作 | 结果 |
| --- | --- | --- |
| 语法 | `node --check lib/client.js` | OK |
| 回归 | `npm test` | **103/103**（原 95 + 本次 8） |
| 槽注册（真机运行时） | Client Inspect `Slots.listSubTree` | occupants 六项，两个新条目 `active: true`、order 900/901 |
| 官方项未受扰 | 同上 | 官方四项 order 100/200/300/400 原样 |
| 导出服务存在（间接证明） | 同上 | `sym-export-session` 能注册成功 = `sessionLogDownload` 服务可用（代码里"服务缺失就不注册"） |
| 压缩 | 三轮就地压缩 | 383 → 371 → 347 → **339** 净增行；保留全部"为什么"注释 |
| profile 同步 | `cp` 到 `node_modules/dsh-sym/lib/client.js` | 两份 `diff` 一致、语法 OK |

### 未验证（诚实登记）

- **真机渲染观感**：无法自动验证 —— DSH 桌面版没有 DevTools（asar 里 `toggleDevTools`
  两项 `visible: false`，reload 只在 win32 注册），且没有 `pnpm run dev:web` 时
  浏览器不会拿到新的客户端模块。**待用户重启 App 后确认**：
  菜单里是否出现两项、分隔线位置、点「复制会话 ID」后剪贴板内容、点「导出会话日志」
  是否弹出官方下载弹窗。
- 剪贴板在 macOS 桌面应用（Electron，`file://` 来源）下的写入是否被宿主接受 ——
  这条只有真机能证；失败路径已按"不谎报成功"设计。
- 菜单在右侧栏聊天标签 / 子代理面板等多会话实例下的表现。

## 产物

- 本次无独立审计产物（功能新增，未触发四角色审计流程）。
- 设计取证过程记录在 `design.md`「结论先行」与「与官方不会打架的地方」两节。
