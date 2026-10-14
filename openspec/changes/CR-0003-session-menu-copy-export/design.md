---
id: CR-0003
type: design
status: draft
version: 0.1.0
created_at: 2026-10-13T21:00:00+08:00
owner: project-owner
related: [FR-13]
supersedes: []
evidence: []
---

# CR-0003 技术方案｜侧栏会话菜单的两项

## 结论先行（两条取证推翻了最初的直觉）

1. **「导出会话日志」不需要新通道，也不该自己实现。** 官方 `@deepseek-ai/dsh-session-log-export`
   早就在做这件事，入口是**会话头部**的「更多操作」；它的浏览器半边把自己
   `ctx.provide("sessionLogDownload", controller)` 成了客户端服务。
   → 本插件只需在侧栏菜单里调到 `controller.download(sessionId)`，就是**同一个功能多开一个入口**。
2. **侧栏会话「⋯」菜单是可加的 `list` 型槽。** `sidebar.workspaces.session.menu.item`
   官方标注 `replaceRisk: none`，渲染时传 `{ sessionId, displayTitle }`，并注入
   `{ hooks: { menuOpenState, shortcuts } }`。→ 复制会话 ID 是**纯加法**，零新契约、零宿主改动。

## 接入点

### 槽与排序

```
sidebar.workspaces.session.menu.item        kind: list, scope: root
  pin(100) · rename(200) · fork(300) · archive(400)   ← 官方（不动）
  sym-copy-session-id(900)                            ← 本插件，separatorBefore: true
  sym-export-session(901)                             ← 本插件，条件注册
```

- order 取 900/901 是**刻意留出的空档**：官方当前最大 400，中间留 500 行空间，
  官方未来加项也不会插进本插件的组里。
- `separatorBefore` 是官方 `MenuItemButton` 自带的 prop（画 `.separator` 用的
  `--dsw-alias-border-l2` 发丝线），所以**分隔线不是我画的**，与官方菜单视觉一致。
  官方 CSS 还有一条"两个分隔线相邻只画一条、首行不画"的规则，用官方 prop 就自动享受。

### 为什么必须复用官方 `MenuItemButton`

自画一个 `<button role="menuitem">` 也能被槽的键盘走查收集（官方说明：走查读 DOM），
但会丢掉官方单元格的图标列宽、hover 底色、发丝分隔线间距与 `--dsw-radius-md` ——
结果就是"这一行看起来不像官方的"。本项目已有同类教训（Git 胶囊抄头部控件形制）。
→ 因此 `menuPrimitives()` **要求拿到 `MenuItemButton`**，拿不到就整块不注册
（宁可少一个功能，也不放一行长得不一样的进去）。

### 导出项为什么写成条件注册

`ctx.inject(["sessionLogDownload"], cb)` 的回调只在服务可用时执行。
**取不到服务就完全不注册这一条**，而不是"注册一个永远渲染 null 的空条目" ——
后者会在菜单里留下一条看不见但占位的行，破坏键盘走查与视觉节奏。

服务在渲染时**再取一次**（`scope.get("sessionLogDownload")?.download(sessionId)`），
而不是把注册那刻的方法引用存下来：官方控制器的 store 会随插件释放而失效，
"被释放的插件不该再被调用"。

### 复制项：复制什么、失败怎么办

- 复制**裸 ID**。宿主用 `<sessionId>.json` 命名投影缓存、用 `<id>` 命名会话日志，
  所以裸 ID 是能直接贴进命令行 / issue / 文件名的那一个；带标题会让粘贴不可用。
- `String(props.sessionId)` 兜住非字符串（槽的 ownerProps 声明是 `sessionId: SessionId`，
  实际是字符串，但防御成本为零）。
- **失败时不关菜单**：槽组件随菜单一起卸载，所以"关掉菜单 + 在行上提示"两者不可兼得。
  选择保留菜单并把该行文案换成失败提示（`copySessionIdFailed`）—— 关掉菜单会让用户
  看着菜单消失、剪贴板却是空的，属于静默欺骗。成功才关菜单（与官方各行一致）。

## 剪贴板

优先官方 `writeClipboard`（primitives 导出）：它已经把 Clipboard API 与
`execCommand('copy')` 兜底封好，失败 resolve `false`。回落路径是裸
`navigator.clipboard.writeText`，它用 reject 表示失败。`copyPlainText` 把两种形状
折成同一个布尔值，调用方只有一个分支要处理。

⚠️ 裸 `navigator.clipboard.writeText` 必须 `write.call(navigator.clipboard, text)` ——
方法脱离对象调用会丢 `this`（本项目在 remote 上有同类踩坑记录）。

## 与官方不会打架的地方（核对过）

| 关注点 | 核对结果 |
| --- | --- |
| 会不会替换官方项 | 不会。`id` 用自有的 `sym-` 前缀；官方文档明说"复用已发布 id 才会替换那一格" |
| 会不会重复注册 | `registerSlotCell` 自带"同页同 id 只注册一次"的账本（AUD-OPS-001） |
| 键盘导航 | owner 按 DOM 收集 `role="menuitem"`，我们的行自动入列；不用自己管 |
| 焦点归还 | 同上，由 owner 的菜单实现负责 |
| 多实例（右侧栏聊天标签 / 子代理面板） | 槽是 `root` 作用域，每个会话行的菜单各自渲染一次，互不影响 |
| 英文界面 | 走槽的 locale 座位；字典缺失时 `tr()` 回退内置中文（本项目既有取舍） |

## 明确不做的

- **不改官方 CSS、不加静态定位规则**（教训：`[class*="_footArea"]{flex-direction:row}`）。
- **不接管 `single` 型槽**。
- **不在悬停按钮行（`session.row.action`）加图标**：用户只要求菜单项，悬停行多两个图标会挤。
- **不自己调 `/api/session.export`**：那是官方包拥有的认证路由，自己发请求等于复制一套
  预检与弹窗逻辑，日后官方改路由就会坏。

## 验证策略

| 层 | 手段 | 能证明什么 |
| --- | --- | --- |
| 单测 | `npm test`（新增 8 条） | 槽名与 order、裸 ID、分隔线 prop、失败不关菜单 / 成功关菜单、文案切换、服务缺失退场、下载中禁用、条件注册时机 |
| 运行时拓扑 | Cordis Inspect → client Slots `listSubTree` | 两个条目在真实客户端里已注册且 `active`、order 正确、官方四项仍在 |
| 渲染观感 | **人工**（需重启 App 或 bundle watcher） | 菜单里真的看到两项、点复制真的进剪贴板、点导出真的弹官方下载窗 |

⚠️ 第三层**没有自动化手段**：DSH 桌面版没有 DevTools（asar 菜单定义证实
`toggleDevTools` 两项 `visible: false`，reload 只在 win32 注册），且客户端改动
在没有 `pnpm run dev:web` 的情况下浏览器不会知道。这一点在 `tasks.md` 的
"未验证"里如实登记。
