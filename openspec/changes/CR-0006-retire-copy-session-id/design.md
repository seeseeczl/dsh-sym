---
id: CR-0006
type: design
status: draft
version: 0.1.0
created_at: 2026-10-20T15:51:30+08:00
owner: project-owner
related: [FR-13, CR-0003]
supersedes: []
evidence: []
---

# CR-0006 技术方案｜下架复制会话 ID

## 结论先行

1. **官方已经把这个功能做进了同一个菜单，且比我们做得好。** 官方在
   `sidebar.workspaces.session.menu.item` 里注册了 `session-id`(order 450)：
   复制裸 `sessionId` → 关菜单 → `writeClipboard` 的成功/失败各发一条 **toast**。
   我们那一行（`sym-copy-session-id`，order 900）做的是一模一样的事，但反馈只有
   "改这一行的文案"，没有全局 toast。**留着就是两条同义项**。
2. **导出项不同，必须保留。** 2026-10-20 复核官方两个槽（`menu.item` 与 `row.action`）
   都**没有**导出项；官方导出入口仍在**会话头部**的「更多操作 → 下载 Session 日志」。
   所以 `sym-export-session` 仍然是"同一个功能多开一个入口"，有独立价值。

## 官方实现（查 `dsh-client-ui-workspace/lib/client.js`，`0.2.1-rc.2`）

```js
const sessionIdInjected = () => ({ copySessionId: async (sessionId) => {
  notify({ kind: await writeClipboard(sessionId) ? "sessionIdCopied" : "sessionIdCopyFailed" });
} });

function SessionIdMenuItem({ sessionId, useMenuOpenState, copySessionId, t }) {
  const [, setMenuOpen] = useMenuOpenState();
  return jsx(MenuItemButton, {
    icon: jsx(IconCopyOutlineRegular, {}),
    onSelect: () => { setMenuOpen(false); copySessionId(sessionId); },
    children: t("menu.sessionId")
  });
}
```

- 复制的是**裸值**：与本插件原来那一行一致（`String(props.sessionId)` 的防御差异在
  实际 `SessionId` 是字符串时无行为差别）。
- 反馈是 **toast**：`toast.sessionIdCopied`「Session ID 已复制」/ `toast.sessionIdCopyFailed`
  「复制失败，请手动…」。本插件"失败时保留菜单"的权宜设计，在官方有 toast 之后不再需要。
- **它没有 `separatorBefore`**，紧跟 archive(400) 之后，属于官方组。

## 删除清单（净删除，无替代实现）

| 项 | 位置 | 说明 |
| --- | --- | --- |
| `copyPlainText` | `lib/client.js` | 只被复制项调用；导出项不走剪贴板 |
| `CopySessionIdMenuItem` | 同上 | 组件本体 |
| `IconCopyOutlineRegular` 引用 | 同上 | 只在该组件里出现 |
| `copySessionId` / `copySessionIdDone` / `copySessionIdFailed` | zh / en 词典 | 6 条（`Done` 键原本就没被引用） |
| `exports.CopySessionIdMenuItem` / `exports.copyPlainText` | 同上 | 测试与外部不再需要 |
| 注册行 `sym-copy-session-id` | `installSessionMenu` | order 900 释放 |
| 冒烟断言里的 `CopySessionIdMenuItem` | `test/client.test.mjs` | 保留导出项那一条 |
| `slot …#sym-copy-session-id (order 900)` | `.project-architect.json` | 治理清单 |
| README 第 9 节 / FR-13 / AGENTS 契约段 | 文档 | 改成"复制由官方提供" |

## 为什么不加"运行时探测官方是否已有该行"

理论上可以读 slots 注册表，若官方有 `session-id` 就不注册自己那一行。**不做**：

- 注册顺序不由我们决定。插件与官方包都在 `apply` 阶段注册，谁先谁后取决于装配顺序；
  探测到"没有"然后就注册，结果仍可能与官方那一行同时出现（时序竞争）。
- 即使探测正确，本插件还要为"旧版 DSH"单独维护一条分支与它的测试 —— 而旧版 DSH
  不会再回来（当前 `0.2.1-rc.2` 已内置）。
- 项目原则是**数据不可得/能力不必要时安静退场**，不是"尽力兼容所有历史版本"。

## 与官方不会打架的地方（复核过）

| 关注点 | 结论 |
| --- | --- |
| id 冲突 | 官方用 `session-id`，本插件原来用 `sym-copy-session-id`；下架后只剩 `sym-export-session`，无冲突 |
| 顺序 | 官方 100/200/300/400/450 连续；本插件 901 在最后，`separatorBefore` 画一条线，视觉上"官方组 / 附加项" |
| 分隔线 | 官方 450 不带 `separatorBefore`，所以不会出现两条线相邻；本插件 901 的线是官方五项后的第一条 |
| 官方项被替换 | 不会：本插件只注册自己的 id |
| 导出服务缺失 | 组件在 `scope.get("sessionLogDownload")` 拿不到时返回 `null`；注册仍然无条件（CR-0003 的教训） |

## 验证策略

| 层 | 手段 | 能证明什么 |
| --- | --- | --- |
| 语法 | `node --check lib/client.js` | 删除后无悬空引用 |
| 单测 | `npm test` | 词典中英齐平、冒烟测试仍通过、契约测试未受影响 |
| 静态核对 | `grep -rn "copyPlainText\|CopySessionId\|copySessionId\|sym-copy-session-id"` | 仓库内无残留引用 |
| 真机 | 重启 App 后打开会话「⋯」菜单 | 只有官方一条「复制 Session ID」；导出项在其下方且有分隔线 |

⚠ 真机那一层**无法自动验证**（DSH 桌面版没有 DevTools，见 AGENTS.md），
在 `tasks.md` 的"未验证"里如实登记。
