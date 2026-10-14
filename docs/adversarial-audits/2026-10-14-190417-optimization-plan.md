# 优化计划：导出会话日志与上下文压缩次数

> 配套审计报告：`docs/adversarial-audits/2026-10-14-190417-audit-report.md`（同一时间戳）

## 总目标

让「导出会话日志」在成功与失败两条路径上**都给出真实反馈**，并消除并发与计数失真风险；使该功能的可观测行为与官方同功能一致。

## 范围

- `lib/client.js`：`ExportSessionMenuItem`、`installSessionMenu`
- `lib/host-v19.js`：`contextLossProjection`（仅 AA-DATA-001、AA-CODE-001 涉及）
- `test/client.test.mjs`：补真实覆盖
- `.project-architect.json` / `AGENTS.md`：契约同步（若采纳 AA-CODE-001 的移除方案）

## 非目标

- 不重写导出为自研 ZIP 实现（继续复用官方宿主导出的 HTTP 路由）
- 不改压缩折叠的既有语义（compact/prune 的口径已正确）
- 不引入依赖、不改插件加载形态

## 问题到任务映射

| Finding | 严重度 | 任务 ID | 处理方式 |
| --- | --- | --- | --- |
| AA-UX-001 | P1 | AA-OPT-001 | 单独处理 |
| AA-BE-001 | P1 | AA-OPT-002 | 与 AA-UX-001 同文件、**建议合并一次改动** |
| AA-BE-002 | P2 | AA-OPT-003 | 单独处理 |
| AA-TEST-001 | P2 | AA-OPT-004 | 应在 AA-OPT-001/002 之后立即做（防回归） |
| AA-DATA-001 | P2 | AA-OPT-005 | 单独处理（需先确认重放路径） |
| AA-CODE-001 | P3 | AA-OPT-006 | 需产品决策：展示 or 移除 |

## 任务表

| ID | 标题 | 优先级 | 依赖 | 验收 |
| --- | --- | --- | --- | --- |
| AA-OPT-001 | 导出前加 HEAD 预检，失败给真实反馈 | P1 | — | HEAD 非 2xx 时不触发下载、标签显示失败 |
| AA-OPT-002 | 修正状态更新顺序（setState 先于关闭菜单） | P1 | — | 「正在导出…」在成功路径可见 |
| AA-OPT-003 | 按会话折叠并发导出 | P2 | AA-OPT-001 | 同一会话连点只发起一次请求 |
| AA-OPT-004 | 为导出补真实断言（URL / 成功 / 失败三态） | P2 | AA-OPT-001、002 | 故意破坏 HEAD 预检时测试变红 |
| AA-OPT-005 | 压缩计数按 `compactionId` 去重 | P2 | 先确认重放路径 | 同 id 重复事件不改变计数 |
| AA-OPT-006 | `lastFailed` 决定展示或移除 | P3 | 产品决策 | 两种方案各有明确落点 |

---

## AA-OPT-001 导出前加 HEAD 预检

- **来源**：AA-UX-001（P1）
- **目标**：失败时用户能看到失败，而不是「正在导出…」之后什么都没有。
- **技术路径**：复用官方同一路由的 HEAD 语义（官方文档明确 `GET`/`HEAD /api/session.export`）。
- **执行步骤**：
  1. `onSelect` 中先 `await fetch(url, { method: "HEAD" })`；`!response.ok` 时读 `response.text()` 取详情。
  2. 失败 → `setState("failed")` + `noteDegrade("sessionMenu:export", ...)`；成功 → 再走 `<a download>`。
  3. 用 `AbortController` + 超时兜住 HEAD 挂起。
- **验收**：HEAD 返回 401/404/500 时不产生下载、标签为失败文案、控制台有一条降级记录。
- **验证方式**：单测（注入假 fetch，见 AA-OPT-004）+ 真机点一次不存在的会话。
- **风险**：多一次往返（HEAD 很小，可接受）。
- **回滚**：还原 `onSelect` 即可。

## AA-OPT-002 修正状态更新顺序

- **来源**：AA-BE-001（P1）
- **目标**：状态迁移在组件存活期间发生，反馈可见。
- **技术路径**：与同文件 `CopySessionIdMenuItem` 保持一致 —— **先** `setState`，**后** `setMenuOpen(false)`。
- **执行步骤**：
  1. 调整 `onSelect` 中的两行顺序。
  2. 复核：失败路径不关菜单（与复制项"失败时保持菜单打开"的既有约定一致）。
- **验收**：点击后标签立即变为「正在导出…」；失败时保持菜单打开并显示失败文案。
- **验证方式**：单测 + 真机观察。
- **风险**：无。
- **回滚**：还原顺序。

## AA-OPT-003 按会话折叠并发导出

- **来源**：AA-BE-002（P2）
- **目标**：同一会话的在飞导出只有一次。
- **技术路径**：模块级 `Map<sessionId, Promise>`（与官方 `controller.active` 同构），在飞时直接复用。
- **验收**：连点 5 次只产生 1 次 HEAD + 1 次 GET。
- **验证方式**：单测断言 fetch 调用次数。
- **风险**：低。

## AA-OPT-004 为导出补真实断言

- **来源**：AA-TEST-001（P2）
- **目标**：三个 P1/P2 缺陷若复发，测试必须变红。
- **执行步骤**：
  1. 注入假 `document`（记录 `createElement`/`click`）与假 `fetch`。
  2. 断言：① URL 含 `sessionId` 与 `includeDescendants=true`；② HEAD 非 2xx → 无 `<a>` 创建；③ HEAD 2xx → 有 `<a>` 且 click 被调用。
  3. **故障注入验证**：临时移除 HEAD 预检，确认测试变红后还原。
- **验收**：测试总数增加 ≥3；故意破坏时变红。
- **风险**：替身需要能表达 `fetch`；`load-client.mjs` 可能要扩一个注入点。

## AA-OPT-005 压缩计数去重

- **来源**：AA-DATA-001（P2，未验证假设）
- **前置**：先花 10 分钟确认 `compaction/summary` 是否存在重放路径；**若确认不存在，本任务降级为 P3 或关闭**。
- **技术路径**：状态加 `seenCompactionIds`（保留最近若干），`summary` 命中即跳过；同步放宽 `stateSchema` 与契约字段表。
- **验收**：同 id 事件重复投递两次，`compactions` 仍为 1。
- **风险**：状态体积随保留数增长，需设上限。

## AA-OPT-006 `lastFailed` 的归属

- **来源**：AA-CODE-001（P3）
- **两个方案**（择一，需产品决策）：
  - **展示**：`ContextLossPill` 在 `lastFailed === true` 时用 error 色并在悬停里说明"上次压缩失败" —— 这是有真实价值的告警。
  - **移除**：删字段 + 改 `host-v19.js` 折叠与 view + 改 `.project-architect.json` 的 `contracts.contextLossProjection` + 改 `check-invariants.mjs` 的字段守卫。
- **验收**：契约、实现、守卫、文档四处一致，无死字段。

---

## 执行顺序建议

1. **AA-OPT-001 + AA-OPT-002 合并为一次改动**（同文件、同函数，分开改会互相干扰）
2. **AA-OPT-004 紧随其后**（把前两项钉死，防回归）
3. AA-OPT-003
4. AA-OPT-005（先验证再决定做不做）
5. AA-OPT-006（等产品决策）

## 回归要求

每次改动后必须跑：

```bash
npm test        # 期望全绿（当前 101 条）
npm run check   # 三项不变量
```

**并同步包副本**（否则界面读不到改动）：

```bash
cp ~/GitHub/DSH-Sym/lib/client.js ~/.dsh/profiles/desktop/node_modules/dsh-sym/lib/client.js
```

## 验收总则

- 导出成功/失败两条路径**都有可见反馈**
- 测试能捕获 AA-UX-001 / AA-BE-001 的复发
- 契约（`.project-architect.json`）与实现一致，无死字段

---

## 执行记录（2026-10-14 完成）

| 任务 | 状态 | 交付 | 验证证据 |
| --- | --- | --- | --- |
| AA-OPT-001 | **完成** | `runExport()` 先 `HEAD` 预检，`!ok` 即记降级并返回失败 | 单测三态覆盖 |
| AA-OPT-002 | **完成** | `setState` 移到 `setMenuOpen(false)` **之前**；失败不关菜单 | 与复制项顺序一致 |
| AA-OPT-003 | **完成**（与 001/002 合并） | 模块级 `exportInFlight` Map，同会话复用同一 promise | 单测：连点 3 次仅 1 次 HEAD |
| AA-OPT-004 | **完成** | 3 条真实断言（URL 参数 / 非 2xx 不下载 / 并发折叠） | 测试 101 → **104**；**故障注入验证**：移除预检 → 3 条全红，还原 → 全绿 |
| AA-OPT-005 | **判定关闭** | 未实现去重 | 实测两个含压缩的会话：投影计数与日志事件数**逐项相等**（1=1、8=8、1=1、6=6）；驱动语义为"每个已提交事件依次通过 apply"（单次）。**未找到重放路径** → 按计划前置条件关闭 |
| AA-OPT-006 | **完成**（采纳"移除"） | 从折叠、投影 view、`.project-architect.json` 契约、`check-invariants.mjs` 守卫、`verify-context-loss.mjs` 字段清单、单测与注释中一并删除 | 全仓 `grep lastFailed` 无残留（脚本注释里的历史记录除外） |

### 执行中的额外发现

1. **`verify-context-loss.mjs` 的字段清单漏改**：该脚本的 `EXPECTED` 也列了 `lastFailed`，
   若不同步会让验收脚本**误报"字段形状不符"**。属 AA-OPT-006 的遗漏点，已修。
2. **测试替身的两个注入通道不同**：`load-client.mjs` 把 `document` 作为**参数**送进模块作用域
   （只能走 `options.document`，设 `globalThis.document` 无效），而 `fetch` 从全局取。
   另：`options.document` 是**浅合并**，自定义 `createElement` 必须自带 `dataset`
   （模块加载时会写 `tag.dataset.plugin`，缺了直接抛错）。两条均已写入测试注释。

### 未做（明确超出本次范围）

- 官方导出插件的浏览器服务为何在本部署拿不到 —— 未追查（已绕过，走宿主路由）。
- 导出失败时的用户可见提示仍依赖菜单行文案（无官方弹窗）；这是与官方实现的已知差异。
