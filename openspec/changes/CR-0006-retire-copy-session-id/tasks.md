---
id: CR-0006
type: tasks
status: draft
version: 0.1.0
created_at: 2026-10-20T15:51:30+08:00
owner: project-owner
related: [FR-13, CR-0003]
supersedes: []
evidence: []
---

# CR-0006 任务卡（原子、可验证）

| # | 任务 | 落点 | 完成判据 |
| --- | --- | --- | --- |
| T-01 | 取证：官方是否已在同一菜单提供复制会话 ID，行为是否等价 | `app.asar` → `dsh-client-ui-workspace/lib/client.js` | 找到 `id: "session-id", order: 450` 与 `SessionIdMenuItem`；确认复制裸 ID + toast |
| T-02 | 取证：官方是否也提供了导出入口 | 同上（`menu.item` / `row.action` 两个槽） | 两个槽都没有导出项；导出仍在会话头部 |
| T-03 | 删除 `copyPlainText` 与 `CopySessionIdMenuItem` | `lib/client.js` | 无悬空引用；`node --check` 通过 |
| T-04 | 删除中英各 3 条文案 | `lib/client.js` 的 `zh` / `en` | 词典守卫（键集齐平）通过 |
| T-05 | `installSessionMenu` 只注册导出项，更新注释 | 同上 | 注册行只剩 `sym-export-session`(901) |
| T-06 | 删除两个 `exports` | 同上 | 测试不再引用 `CopySessionIdMenuItem` |
| T-07 | 冒烟测试只检查导出项 | `test/client.test.mjs` | `npm test` 全绿 |
| T-08 | 治理同步：FR-13、`.project-architect.json`、AGENTS 契约段、README 第 9 节、本 CR | 多处文档 | 文档与实现一致 |
| T-09 | 顺带纠正 AGENTS 里"服务类依赖要写成条件注册"的错误建议 | `AGENTS.md` | 与代码注释（无条件注册）一致 |
| T-10 | 顺带纠正"导出走 `sessionLogDownload` 服务"的过时描述（README / AGENTS / FR-13 三处） | 多处文档 | 与实际实现一致：直连 `/api/session.export`（HEAD 预检 + `<a download>`），无官方进度弹窗 |

## 验证矩阵（REG-0006）

| 检查 | 命令/动作 | 期望 |
| --- | --- | --- |
| 语法 | `node --check lib/client.js` | OK |
| 单测（全量） | `npm test` | 113/113（改动前也是 113，删 1 项冒烟覆盖但用例数不变） |
| 残留引用 | `grep -rn "copyPlainText\|CopySessionId\|copySessionId\|sym-copy-session-id" lib/ test/ scripts/` | 只应出现在注释与 CR 文档里 |
| 治理不变量 | `npm run check` | 全部通过 |
| 官方项未受扰 | 真机菜单 | 官方五项 100/200/300/400/450 原样；本插件只剩 901 |

## 落地记录（2026-10-20）

### LOC（`wc -l`）

| 模块 | 改动前 | 改动后 | 上限 | 本次净增 |
| --- | --- | --- | --- | --- |
| `lib/client.js`（M-CLIENT） | 3633 | **3587** | 3800 | **−46** |
| `lib/host-v20.js`（M-HOST） | 1648 | 1648 | 1800 | **0（宿主零改动）** |

### 已验证

| 检查 | 命令 / 动作 | 结果 |
| --- | --- | --- |
| 语法 | `node --check lib/client.js` | OK |
| 回归 | `npm test` | **113/113** |
| 残留 | `grep` 四个旧名 | `lib/` 与 `test/` 内只剩注释/文档提及 |
| 治理 | `npm run check` | 见下 |

### 未验证（诚实登记）

- **真机渲染观感**：DSH 桌面版没有 DevTools，客户端改动需要 **Cmd+Q 重启**才生效。
  待用户重启后确认：菜单里只出现**一条**「复制 Session ID」（官方的），
  且「导出会话日志」仍在它下方、有发丝分隔线。
- 官方 450 那一行在**英文界面**下的文案（「Copy Session ID」）未实测，但那是官方字典，
  与本插件无关。

### 发版时补（本次按用户决定「暂不发版」）

- `CHANGELOG.md` 新增 `## [1.8.3] - <日期>` 条目（移除项 + 两条文档更正）。
- `package.json` 版本 `1.8.2` → `1.8.3`，并打 `v1.8.3` tag。

## 产物

- 本 CR 无独立审计产物（功能移除，未触发四角色审计流程）。
