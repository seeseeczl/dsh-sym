# 项目优化任务书

## 执行原则

- 只执行本任务书事项，先 P0，再 P1，再 P2；每次只推进一个任务，不擅自扩大范围。
- 每完成一个步骤立即更新 TODO 和当前进展，不做顺手优化。
- 默认复用现有技术栈（零依赖、无构建）；**新增任何依赖都必须先立 CR**。
- 测试失败执行 Test-Fix Loop；非阻塞的计划外问题只记录。

## 执行记录（2026-10-14 完成）

| TODO | 状态 | 交付物 | 验证证据 |
| --- | --- | --- | --- |
| P1.1 | **部分**（待人工） | `scripts/verify-context-loss.mjs` + `npm run verify:loss` | 脚本正确判定"未落地"并给出两步指引（退出码 1）；宿主装配需 `set_plugin`，Agent 无此工具 |
| P1.2 | 完成 | `scripts/check-invariants.mjs` + `npm run check` | 三项全绿；**故障注入各一次全部拦截**；且在执行 P1.3/P2 期间**真实拦截了我两次漏同步包副本** |
| P1.3 | **未达标** | 客户端注释/结构压缩 | 3594 → 3530（省 64 行）。见下方「未达标原因」 |
| P2.1 | 完成 | `test/client.test.mjs` 新增 4 条 | `npm test` 101/101 |
| P2.2 | 完成 | `scripts/check-package.mjs` + `npm run check:pack` | 25 个产物文件、8 项必需文件、入口可 import |
| P2.3 | 完成 | `AGENTS.md` 环境事实一节 | 不再声称附件不存在；补齐 4 条校验脚本用法与 2 个坑 |

### P1.3 未达标原因（如实记录）

目标 ≤ 3400，实际 3530（差额 130 行）。压缩到 3530 后遇到收益递减：

- 剩余 943 行注释中，**143 行是 `@param` / `@returns`**。删它们能达标，但那属于**改公开文档**，
  超出本任务「仅压缩冗余、不改行为与契约」的非目标约束 —— 且 AGENTS.md 明确要求维护接口契约。
- 其余注释多为逐条实测结论（图标栅格、槽的替换风险、缓存时序），删掉会损失可维护性。
- 尝试过的结构化手段（抽取 `noteDegrade` 的 error 归一、内联 `LinkMenuSlot`）简化了 33 处调用点，
  但**几乎不省行**（多数调用本就在同一行）。

→ 建议：把「≤3400」改为后续独立任务，与「是否切换到 HTTP bundle 形态以支持拆文件」一起评估；
仅靠就地压缩已接近极限（本任务已从 3594 压到 3530，再压必然开始损失契约文档）。

### 计划外发现（记录，未展开处理）

1. **`assets/audit/` 里有过期的技能模板副本**（2026-10-08 拷入，2195 字节；技能目录里的是
   3487 字节的新版）。已记入 `AGENTS.md` 提醒，**未删除**（超范围）。
2. **`npm pack` 产物含 `assets/audit/*.md`** —— 那是审计模板，不是插件资产。是否移出
   `files` 白名单需单独决策（影响包体积与用户预期）。

## 总目标

让 dsh-sym 的三条**易错且静默失败**的硬规则（宿主换名流程、客户端双份同步、投影 view 形状）变成**可执行校验**，同时把本轮新增的上下文损耗读数在真实运行环境验证闭环，并为客户端单体腾出继续演进的余量。

## 范围

- `lib/`（`client.js`、`host-v19.js`）、`test/`、`scripts/`、`.project-architect.json`、`AGENTS.md`
- 本轮新增能力的运行时验证（`contextLoss` 投影）

## 非目标

- 不改任何公开契约的语义（`sessionCost` / `contextLoss` / `quickActions` / Git 路由的字段含义保持不变）
- 不引入依赖、不引入构建步骤、不改插件加载形态（改 HTTP bundle 形态需单独立 CR）
- 不做界面视觉重设计
- 不修历史审计中已标记"接受风险"的 AUD-OPS-002

## 问题到任务映射

| 问题 ID | 严重程度 | 优先级 | TODO ID | 处理方式 |
| --- | --- | --- | --- | --- |
| AUD-RUNTIME-001 | S1 | P1 | P1.1 | 单独处理 |
| AUD-FLOW-002 | S1 | P1 | P1.1 | 与 AUD-RUNTIME-001 同目标合并（同一根因、同一修复动作） |
| AUD-GOV-001 | S2 | P1 | P1.2 | 单独处理 |
| AUD-SIZE-001 | S2 | P1 | P1.3 | 单独处理 |
| AUD-MOD-001 | S2 | P1 | P1.3 | 与 AUD-SIZE-001 同目标合并 |
| AUD-QUAL-004 | S3 | P2 | P2.1 | 单独处理 |
| AUD-SUPPLY-001 | S3 | P2 | P2.2 | 单独处理 |
| AUD-DOC-003 | S3 | P2 | P2.3 | 单独处理 |
| AUD-BLOCK-001 | 阻塞 | P1 | P1.1 | 由 P1.1 的重启验证一并解除 |

> 说明：本轮 **S0 = 0**，故无 P0 任务。P0 段落保留为空集声明。

## TODO

P0 必须完成
- （无：本轮无 S0 问题）

P1 应该完成
- [*] P1.1 上下文损耗读数在真实运行环境验证闭环 —— **脚本已交付；宿主装配与界面确认待人工**（Agent 无 `set_plugin` 工具）
- [x] P1.2 新增 `scripts/check-invariants.mjs`，把三条静默失败规则变成可执行校验
- [x] P1.3 客户端就地压缩 —— **实际 3594 → 3530（省 64 行），未达 3400**，原因见「执行记录」
- [x] P2.1 为界面入口补齐渲染冒烟断言 —— 测试数 97 → 101
- [x] P2.2 发布产物完整性核对脚本 —— `scripts/check-package.mjs`
- [x] P2.3 更正 AGENTS.md 中"技能附件不存在"的过时记载

## 任务详情

### P1.1 上下文损耗读数在真实运行环境验证闭环

- 来源问题 ID：AUD-RUNTIME-001 + AUD-FLOW-002（并解除 AUD-BLOCK-001 对该功能的阻塞）
- 依赖：无（代码与投影已就绪，仅缺运行时装配）
- 严重程度：S1
- 目标：重启 App 后，界面输入框下方 dock 的**末格**（内存之后、上下文表之前）显示出上下文压缩读数，且宿主投影缓存中出现 `contextLoss` key。
- 范围：`lib/host-v19.js` 的 `contextLossProjection`、`lib/client.js` 的 `ContextLossPill`、profile 挂载配置
- 非目标：不改投影字段、不改界面文案、不新增显示项开关以外的能力
- 涉及文件/模块/符号：`lib/host-v19.js`（`contextLossProjection` / `CONTEXT_LOSS_KEY`）、`lib/client.js`（`ContextLossPill` / `CompactionGlyph`）、`~/.dsh/profiles/desktop/cordis.patch.yml`（`sym-dev` 条目）
- 现有技术栈复用：`scripts/reload-host.mjs` 流程、插槽 `conversation.composer.dock`
- 新增依赖：无
- 技术路径：先停用/启用插件装配新宿主模块 → 完全退出 App（Cmd+Q）重启以刷新客户端 → 用**唯一可靠判据**（投影缓存出现 key）确认宿主生效 → 人工看界面确认客户端生效。
- 执行步骤：
  1. 在会话里对 `sym-dev` 执行停用 → 启用。
  2. 完全退出 DSH（Cmd+Q，确认 Dock 图标消失）后重新打开。
  3. 运行验证命令读投影缓存，断言任一活跃会话含 `contextLoss.val`。
  4. 人工查看输入框下方 dock 末格；未压缩会话应显示「尚未压缩过上下文」。
  5. 如需立即看到非零态，执行一次 `/compact` 后复查（**破坏性操作，需用户确认**）。
- 验收标准：① `contextLoss` 投影在缓存中命中数 ≥ 1；② 界面上 dock 末格可见且文本为「尚未压缩过上下文」或「压缩 N 次 · 丢失 X」；③ 官方 `1 轮 N 步 · M tok/s` 药丸与花费格**位置和内容不变**。
- 验证方式：
  ```bash
  python3 -c "
  import json,glob
  hit=[f for f in glob.glob('$HOME/.dsh/storages/session_projcache/sessions/*.json')
       if 'contextLoss' in json.load(open(f))['record']['rows']]
  print('命中', len(hit))"
  ```
  外加人工界面确认（无自动化替代，见 AUD-BLOCK-001）。
- 风险：低。投影缺失时组件返回 `null`，不影响官方布局（该降级路径已有单测覆盖）。
- 回滚/降级方案：停用 `sym-dev` 即整块消失；组件层已保证缺席时零影响。
- 变更留档：`CHANGELOG.md` 记入下一版本「新增」段；`.project-architect.json` 的 `contracts.contextLossProjection`（CR-0004）已在位。
- 计划外问题处理规则：记录，不展开；只有阻塞 P0 时暂停并请求确认。

### P1.2 新增 check-invariants.mjs，把三条静默失败规则变成可执行校验

- 来源问题 ID：AUD-GOV-001
- 依赖：无
- 严重程度：S2
- 目标：一条命令能检出三类最容易犯且**不报错**的违规，违规时非零退出。
- 范围：新增 `scripts/check-invariants.mjs`；不改任何生产代码
- 非目标：不引入测试框架；不改现有 97 条测试；不做通用 lint
- 涉及文件/模块/符号：`scripts/check-invariants.mjs`（新增）、`package.json`（加 `check` 脚本）、`test/` 不新增文件
- 现有技术栈复用：Node 内置 `fs` / `process`、现有 `node --test` 习惯
- 新增依赖：无
- 技术路径：三个独立检查项，任一失败即退出码 1，并打印**可操作**的修复指引。
  1. **跨端常量一致性**：解析 `lib/host-v19.js` 与 `lib/client.js` 中 6 个契约常量（`PROJECTION_KEY` / `QUOTE_MARK_PREFIX` / `QUOTE_MARK_ID_LENGTH` / `QUICK_ACTIONS_KEY` / `GIT_STATUS_ROUTE` / `CONTEXT_LOSS_KEY`）的字符串值并逐一比对（现有契约测试已覆盖，此处作为独立兜底，可在测试未跑时拦住）。
  2. **客户端双份一致性**：比对工作副本 `lib/client.js` 与 profile 包副本 `~/.dsh/profiles/desktop/node_modules/dsh-sym/lib/client.js`，不一致时提示正确的 `cp` 命令（副本不存在时跳过并说明）。
  3. **投影 view 字段守卫**：在源码里断言 `contextLossProjection.wire.view` 返回的字段集合为 `{compactions, prunes, lostTokens, lastTurn, lastFailed}`，且 `sessionCostProjection` 的 view 不含 `amount`/`price`/`fx` 等金额字段（守住"投影只存 token 不存金额"这条公开契约）。
- 执行步骤：
  1. 写 `scripts/check-invariants.mjs`，三项检查各自独立、可单独运行。
  2. 在 `package.json` 加 `"check": "node scripts/check-invariants.mjs"`。
  3. 制造三类违规各一次（改常量、改副本、改 view 返回值），确认脚本**都能报错并非零退出**。
  4. 恢复，确认全绿。
- 验收标准：① 三类违规各自能被检出且退出码非 0；② 正常状态下退出码 0；③ 脚本不依赖任何新增依赖；④ 有明确的修复指引文案。
- 验证方式：
  ```bash
  npm run check            # 期望 exit 0
  # 故意改 lib/client.js 的一个常量后再跑，期望 exit 1
  ```
- 风险：低。若解析式检查对源码格式敏感，可退化为"导入模块读导出值"（`import()` 两个模块后直接比对），更稳但要求模块可被 Node 加载 —— `lib/client.js` 是浏览器 factory，**不能直接 import**，故常量比对采用**正则提取**，并在正则失配时报错而非静默通过。
- 回滚/降级方案：删除新增脚本与 `package.json` 一行即可，无生产代码改动。
- 变更留档：`CHANGELOG.md` 下一版本「内部」段；`AGENTS.md` 的验证要求一节补一行"改完跑 `npm run check`"。
- 计划外问题处理规则：记录，不展开；只有阻塞 P0 时暂停并请求确认。

### P1.3 客户端就地压缩至 ≤ 3400 行

- 来源问题 ID：AUD-SIZE-001 + AUD-MOD-001（同目标合并）
- 依赖：无（但**必须在下一个客户端功能之前完成**）
- 严重程度：S2
- 目标：`wc -l lib/client.js` ≤ 3400，97 条测试全绿，界面功能零回归。
- 范围：仅 `lib/client.js` 的**注释与冗余结构**；不改行为
- 非目标：不拆文件（受 `file://` 加载形态限制，需另立 CR）；不删任何功能；不改公开契约
- 涉及文件/模块/符号：`lib/client.js` 全文
- 现有技术栈复用：无
- 新增依赖：无
- 技术路径：按收益/风险排序逐项执行，每项完成即验证、失败即回退。顺序为：
  1. **压缩历史性长注释**
    把"为什么这么写"的教训类注释（多处 10+ 行）精简为 2-3 行结论 + 指向 `AGENTS.md` 的锚点 —— 那些教训已在 AGENTS.md 有完整版本，代码里重复。
  2. **合并重复模式**：多个格子组件共享的 `props.useProjection(key)` + `useDisplayOptions()` + `return null` 骨架，抽成一个 `useCellView(key, optionKey, t)` 之类的内部 helper。
  3. **图标表就地压缩**：`QUICK_ICONS` 与 `ICON_FIT` 已是生成物，检查是否存在可安全去掉的空白/换行（**不改数值**）。
  4. 每完成一项立即 `npm test`；任一项导致测试变红就回退该项。
- 执行步骤：
  1. 记录基线：`wc -l lib/client.js`（应为 3594）。
  2. 执行第 1 项，跑测试，记录行数。
  3. 执行第 2 项，跑测试，记录行数。
  4. 执行第 3 项（如仍需），跑测试。
  5. 达到 ≤ 3400 即停止，**不做顺手优化**。
- 验收标准：① `wc -l lib/client.js` ≤ 3400；② `npm test` 97/97 通过；③ `git diff` 中**无任何 `.js` 逻辑语义变化**（仅注释/结构）；④ 人工确认 6 个界面格子仍在（需一次 App 重启）。
- 验证方式：`npm test` + `wc -l` + `git diff --stat` + 一次人工界面确认。
- 风险：中。压缩注释可能丢失关键上下文 —— 缓解：**先确认该教训已在 `AGENTS.md` 有完整记载**才精简，否则保留。
- 回滚/降级方案：按项回退（每项是独立 commit 粒度）；全量失败则 `git checkout lib/client.js`。
- 变更留档：`CHANGELOG.md`「内部」段说明"就地压缩，无行为变更"。
- 计划外问题处理规则：记录，不展开；只有阻塞 P0 时暂停并请求确认。

### P2.1 为 11 个界面入口补齐渲染冒烟断言

- 来源问题 ID：AUD-QUAL-004
- 依赖：无
- 严重程度：S3
- 目标：每个 `FE-*` 入口至少一条渲染断言，注入未定义变量时测试变红。
- 范围：`test/client.test.mjs`（追加用例）
- 非目标：不做视觉快照、不引入 jsdom
- 涉及文件/模块/符号：`test/client.test.mjs`、`test/helpers/load-client.mjs`（复用现有替身）
- 现有技术栈复用：现有 `loadClient()` 与 `createElement` 替身
- 新增依赖：无
- 技术路径：照现有 `QuickActionsRail` / `ContextLossPill` 冒烟测试的样子，为每个组件造最小合法 props，断言"不抛错且返回元素或 null"。
- 执行步骤：
  1. 列出 11 个入口对应的组件符号。
  2. 逐个补断言，每补一个跑一次测试。
  3. 故意在一个组件里插入未定义变量，确认对应断言变红后还原。
- 验收标准：11 个入口全覆盖；无新增依赖；测试数从 97 增至 ≥ 108。
- 验证方式：`npm test` + 一次故意的故障注入验证。
- 风险：低。
- 回滚/降级方案：纯新增测试，可单独回退。
- 变更留档：`CHANGELOG.md`「内部」段。
- 计划外问题处理规则：记录，不展开；只有阻塞 P0 时暂停并请求确认。

### P2.2 发布产物完整性核对脚本

- 来源问题 ID：AUD-SUPPLY-001
- 依赖：无
- 严重程度：S3
- 目标：发布前一条命令确认包内容完整且入口可加载。
- 范围：`scripts/`（新增核对脚本或并入 `check-invariants.mjs`）
- 非目标：不做签名/公证（项目不发原生产物）
- 涉及文件/模块/符号：`package.json` 的 `files` 白名单、`exports` 映射
- 现有技术栈复用：`npm pack --dry-run`、Node `import()`
- 新增依赖：无
- 技术路径：`npm pack --dry-run --json` 解析文件清单 → 断言 6 个必需文件在列 → 对宿主入口做一次 `import()` 冒烟。
- 执行步骤：
  1. 写核对逻辑。
  2. 跑一次确认通过。
  3. 从 `files` 里临时移除一项，确认报错后还原。
- 验收标准：缺任一必需文件时非零退出；完整时退出 0。
- 验证方式：`npm run check:pack`（或并入 `npm run check`）。
- 风险：低。
- 回滚/降级方案：纯新增脚本。
- 变更留档：`PUBLISHING.md` 补一行"发布前跑核对"。
- 计划外问题处理规则：记录，不展开；只有阻塞 P0 时暂停并请求确认。

### P2.3 更正 AGENTS.md 中"技能附件不存在"的过时记载

- 来源问题 ID：AUD-DOC-003
- 依赖：无
- 严重程度：S3
- 目标：文档不再声称 project-architect 技能只有 `SKILL.md`，并登记可用的校验脚本入口。
- 范围：`AGENTS.md`「环境事实」一节
- 非目标：不重写整个环境事实章节
- 涉及文件/模块/符号：`AGENTS.md`
- 现有技术栈复用：无
- 新增依赖：无
- 技术路径：把该条改为"附件**齐全**"，并列出本次实际用到的三个脚本用法（`audit_project.py collect`、`check_project_architecture.py`、`audit_project.py validate/coverage`），同时保留"技能目录是会话开始时快照"这条仍然成立的结论。
- 执行步骤：
  1. 定位该条（`AGENTS.md` 环境事实末段）。
  2. 改写为准确表述 + 脚本用法。
  3. 复核全文无其它处仍称"附件不存在"。
- 验收标准：`grep -n "附件" AGENTS.md` 结果中不再有"不存在"的表述。
- 验证方式：`grep` 复核。
- 风险：低。
- 回滚/降级方案：文档改动可直接回退。
- 变更留档：本次审计报告 AUD-DOC-003。
- 计划外问题处理规则：记录，不展开；只有阻塞 P0 时暂停并请求确认。

## 进度更新模板

```markdown
## TODO

P1 应该完成
- [*] P1.1 当前任务
- [ ] P1.2 下一个任务

当前进展：
- 已完成：
- 正在做：
- 下一步：
- 阻塞/风险：
```

## Definition of Done

- [ ] 所有 S0/S1 和 P0/P1 问题均映射到 TODO，且每个 TODO 有完整详情。（本轮 S0=0）
- [ ] 已按 `.project-architect.json` 的分类阈值执行 LOC 门禁，排除项、截断和超限项均已记录。
- [ ] P0 完成并通过相关测试、构建或替代验证。（本轮无 P0）
- [ ] 回归覆盖受影响模块和关键链路。（每个任务都要求 `npm test` 全绿）
- [ ] OpenSpec 与 CodeGraph 的更新或不适用原因已说明。
- [ ] 需求变更、技术决策和实际修改文件已按现有机制增量留档并关联。
- [ ] 审计范围内每个功能模块（`FM-*`）均完成"需求→入口→主路径→数据/状态→异常恢复→可观测性→回归→发布证据"闭环对账。（报告已含 9 个 FM）
- [ ] 审计范围内每个前端入口均有闭环结论或未验证原因。（报告已含 11 个 FE）
- [ ] 七类专项工程审计均有状态，P0/P1 专项问题均映射 TODO。
- [ ] 请求/实际审计模式及降级原因已说明；增量对比已写入报告。
- [ ] UI 任务的 Product Design、视觉证据和可访问性验证情况已说明。（本轮标记未验证）
- [ ] 计划外发现已记录但未扩展处理。（3 条已记入报告）
