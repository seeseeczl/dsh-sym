# dsh-sym 项目约定

> 本文件是**项目级**指令，叠加在用户级 `~/.dsh/AGENTS.md` 之后，**项目内的要求优先**。
> 上游依据：`docs/01-architecture/project-architecture-and-requirements.md`（需求与架构基线）
> 与 `docs/04-delivery/project-plan-task-charter.md`（任务书）。
> 阈值与公开契约只在 `.project-architect.json` 维护，**不要在本文件另立一套**。

## 这是什么项目

`dsh-sym`（symbiote，共生体）是给 DeepSeek Harness 接的界面读数层：把 DSH 界面**已经存在
但未呈现**的数字变成可用读数，对**反复手动做的事**给一键。名字刻意不限定功能范围。

**不要**用"插件叫 sym 所以只能做计费"这类理由限制范围；也**不要**因为加了新能力就改名。

## 动手前必须知道的边界（已证实，勿重复投入）

以下结论都经过实测，**不要重新验证**；要推翻必须先给出新证据：

1. **不能新增客户端 → 宿主的 Remote 通道。** 客户端能调的命名空间由 `dsh-api-remotes`
   在**构建期**选定，插件加不了新的。`ctx.typert.register()` 在宿主侧能注册成功，但客户端
   那一半挂载不了，且客户端自挂载要求**生成的严格 codec**。
   → 任何"界面点一下 → 宿主做一件本没有的事"的想法，**先确认有没有现成 Remote**。
   → 会话移动（`lib/move-session.js`）就死在这里；右键菜单能活是因为
   `session.openWorkspacePath` 本来就存在。

2. **`dynamicCordisRunner` 不是通道。** 它的沙箱刻意禁用 fs / 网络 / 进程 / 定时器
   （引导到 `ctx.fs` 等 Cordis 服务），而且语义是"定义并运行一个插件"，不是"执行一次动作"。

3. **宿主代码不热重载。** 改 `lib/host-v*.js` 后必须走：
   **停用插件 → 换新文件名 → 同步引用 → 启用**。直接改内容或只改文件名都不会生效（模块缓存）。
   换名与同步引用已经脚本化：`node scripts/reload-host.mjs --dry-run` 先看要改哪些行，
   加 `--apply` 才真正改名；脚本**不**碰停用/启用（那两步由人做）。
   每次这样做都会在宿主内存里留下旧模块注册，**重启 App 可清**。

4. **`single` 型插槽是替换，`list` 型才是加法。** 接管 `single` 会丢掉官方行为
   （例如账户菜单里的"退出登录"）。能加法就不要替换；确实要改视觉时优先 CSS
   （品牌行的峰谷标记就是 `::after`，没有接管任何组件）。

5. **视觉常量必须先查官方源码。** 面板配色曾因猜测 `--dsw-alias-bg-elevated` 而与官方不一致，
   正确值是 `--dsw-specific-menu`。官方弹层的标准配方：
   `--dsw-specific-menu` + `--dsw-elevation-prominent` + `--dsw-radius-lg` + `--dsw-menu-backdrop-filter`。

## 接口契约（**改动前先读这里**）

**这一节是审计 `AUD-TEST-001`（S1）的整改产物。** 在那次审计中，同一个 AI 在同一会话内
对下面这些接口**连续误判 6 次**——因为契约此前只存在于实现里。**签名与返回契约以实现为准，
本节是它的可读副本；发现不一致时先改本节。**

### `lib/host-v12.js`

```js
isPeakTime(ms, holidays = new Set(DEFAULT_HOLIDAYS)) -> boolean
    // 峰段：北京时间周一至周五 09:00–12:00、14:00–18:00（含起点、不含终点）
    // 周末与 holidays 中的日期全天为 false。holidays 是 'YYYY-MM-DD' 字符串集合。

expandQuoteMarks(messages) -> 新批次 | null
    // ⚠ 无标记、或入参不是数组时返回 null（调用方保留原 decision 对象）。
    // ⚠ message.content 必须是【块数组】：[{ type:'text', text:'…' }]。
    //    传字符串会被整条跳过，表现为"没改动"。
    // ⚠ 只有**成功替换过**才返回新批次；标记的 id 解析不到时返回 null
    //    （AUD-LOGIC-001 的整改，2026-09-30 落地）。

proseOfMessage(message) -> string | null
    // ⚠ 入参是【message 对象】，不是 id。
    // 从 content 中按顺序取 type==='text' 的块，用 '\n\n' 连接；
    // 忽略 reasoning 与 tool-call 块。无文本块或入参为 null 时返回 null。

rememberProse(id, prose) -> void
    // 按 id 存入引用索引（重复 id 会先删后插，保持"最新"）。
    // 上限 QUOTE_INDEX_LIMIT = 400，超出淘汰最旧的。

readProcessMemory() -> { rss, heapUsed } | null
    // 无 process 时返回 null。

PROJECTION_KEY / QUOTE_MARK_PREFIX / QUOTE_MARK_ID_LENGTH
    // 跨端契约常量，两端各有一份拷贝（不能共享模块），由
    // test/contracts.test.mjs 断言两边相等。见下面「公开契约」。
```

### `lib/client.js`

```js
formatCny(value) -> string          // 金额文本（货币符号由语言包的 amount 负责）
pickTurn(turns, activeTurn) -> turn | null
describeScope(scope, t, title) -> string   // 悬停账单的多行文本
readActiveTurn() -> number | null          // 读右侧刻度当前选中项
quoteMark(messageId) -> string             // 客户端写出的引用标记（端到端由契约测试守卫）
registerSlotCell(ctx, name, id, order, component, extra?) -> disposer | null
    // ⚠ 同一实例内重复 id 会被**跳过并返回 null**（AUD-OPS-001 的整改）。
    // ⚠ 注册表拒绝时吞掉异常、记录一条降级日志，返回 null——不连累其他插槽。
    // ⚠ `extra` 合并进注册选项；传 `{ locale: null }` 等于**删掉** locale 字段。
    //    它是"要不要给条目注入 `t`"的开关，**不控制渲染** —— 见下面「槽的 locale 声明」。
```

### 降级日志（`noteDegrade`）

两端各有一个 `noteDegrade(where, detail)`：把"安静退场"的原因写到控制台，
**每个来源只记一次**（上限 40 条），所以不会随渲染刷屏。
看到 `[dsh-sym] <where> 降级：…` 就是某个可选能力主动缺席了，不是崩溃。
宿主侧唯一不记的情况是 `prices.json` 不存在（ENOENT）——那是正常态。

### 两个容易搞错的语义

1. **`null` 不是 `undefined`**：本项目一律用 `null` 表示"没有/无变化/不可用"。
   写断言时用 `assert.equal(x, null)`，不要写 `undefined`。
2. **"无变化返回 null" 是有意设计**，不是偷懒：让调用方保留原对象、避免无谓拷贝。
   见到 `null` 时**不要**当成错误。

## 汇报产物的格式（用户明确要求过）

列出任何产物时，每份都要**同时**具备两样东西，缺一不可：

1. **中文说明**：这一份是什么。审计产物固定叫「**审计报告**」与「**优化计划书**」
   （`project-architect` 那一侧的第二份叫「**优化任务书**」）。
2. **可点击链接**：`[审计报告：<主题>](/绝对/路径)`。

**不要**把产物路径放进代码块或写成裸路径——那样既点不开，也分不清哪份是哪份。
用户为此专门提过要求，**请严格执行**。

审计产物成对出现，读法固定：

| 想看什么 | 打开哪份 |
|---|---|
| 哪里有问题、证据是什么 | **审计报告** |
| 打算怎么修、谁负责 | **优化计划书 / 优化任务书** |

## 公开契约（改动前必须先立 CR）

| 契约 | 位置 | 规则 |
|---|---|---|
| 投影 `sessionCost`（stateVersion 3） | 宿主 ↔ 客户端**唯一**数据契约 | 只存 token 数与计数，**不存金额、单价、汇率** |
| 引用标记 `@引用#<12位id>` | 客户端写入、宿主展开 | **两端必须同步改** |
| `lib/prices.json` 字段 | 对用户可见 | `usdToCny` / `holidays` / `models`，破坏性变更需 CR |
| `data-sym-*` DOM 属性 | 供验证脚本定位 | **非稳定 API**，可改但需同步测试 |

### 跨端契约的单一事实源（AUD-ARCH-001 的整改，2026-09-30）

两端**不能共享模块**（客户端是浏览器 module factory，宿主是 Node 模块），所以
`PROJECTION_KEY`、`QUOTE_MARK_PREFIX`、`QUOTE_MARK_ID_LENGTH` 在两端各有一份拷贝：

| 常量 | 宿主 | 客户端 |
|---|---|---|
| `PROJECTION_KEY` | `lib/host-v12.js` 顶部 | `lib/client.js` 的 contract 区 |
| `QUOTE_MARK_PREFIX` / `QUOTE_MARK_ID_LENGTH` | 同上 | 同上 |

**守卫在 `test/contracts.test.mjs`**：它断言两边相等，并用"客户端生成标记 → 宿主展开"
证明两端真的对得上。**改任何一端都要跑 `npm test`**——失配不会报错，只会表现为
数据不显示或引用不展开。

## 代码约束

- **零依赖、无构建步骤。** 不要引入 dependencies、打包器或转译。平台模块（`react`、
  `react-dom`）用 `require` 取，且**必须包在 try/catch**——取不到时降级而不是崩溃。
- **单卡至多 5 个生产文件、净新增至多 300 行**；任一模块超过 `.project-architect.json`
  的 `loc.hardCeiling` 时**先拆分再继续**。
- **数据不可得时安静退场**：返回 `null`，**不要**显示 `0` 或占位符。
- **`view()` 里不要返回每次都是新引用的对象**——会击穿 `viewCache`，导致客户端无限重渲染。
  内存读数就因此只能随会话活动更新，这是刻意的。
- 加法接入优先；插件缺席或数据缺失时，**官方布局一个像素都不该变**。

## 验证要求

- **不落盘、未验证的产物不得宣称完成。** 说"做好了"必须附实测证据。
- 改动客户端 → 需要可复现验证；改动宿主 → **必须在真实运行环境验证**（只跑单测不算）。
- 报告要区分**已验证 / 推断 / 未验证**；没验证的明说没验证。
- **仓库内回归已建立**（2026-09-30，任务卡 T-03/T-04/T-05 与 ADV-P1-01/02）：
  入口是 `npm test`（即 `node --test`），三个文件
  `test/host.test.mjs`、`test/client.test.mjs`、`test/contracts.test.mjs`，
  共 31 个断言，零依赖。**注意 `node --test test/` 在 Node 24 下会被当成模块路径而失败，
  用不带参数的 `node --test`。**
- 但**回归只覆盖纯函数**：渲染、插槽注册、热更新仍要人工实测，改动宿主仍必须重启验证。

## 治理产物

- 需求与架构基线：`docs/01-architecture/project-architecture-and-requirements.md`
- 任务书（12 张原子任务卡）：`docs/04-delivery/project-plan-task-charter.md`
- 事实源（LOC 阈值 / 模块路径 / 公开契约 / 忽略项）：`.project-architect.json`
- 审计产物（未来）：`docs/05-audits/YYYY-MM-DD-HHMMSS-*.md`，同一时间戳，**永不覆盖历史**

**审计默认只读**：除非明确授权修复，不修改业务代码、配置、依赖或远程状态，不把发现顺手重构。

## 环境事实（省得重新查）

- `DSH_HOME=/Users/long/.dsh`；本项目位于 `~/GitHub/DSH-Sym`（2026-09-30 搬出 profile 的
  `plugins/` 目录）。它靠 `~/.dsh/profiles/desktop/cordis.patch.yml` 里的 `file://` 条目挂载 ——
  **换路径后必须重启 App**，宿主手里的还是旧绝对路径
- **`file://` 挂载 ≠ 不是插件**（2026-10-01 查 asar 证实）：loader 里有 `nearestPackage()`
  （asar 偏移 18777873），拿到 `file://` 入口后会**向上找最近的 `package.json`** 当包根。
  所以 `file:///…/lib/host-v12.js` 最终仍被认成包 `dsh-sym`，客户端半边照样走
  `exports["./client"]` + `dsh.client` 解析 —— 与包安装的**唯一**差别是入口由绝对路径给出，
  而不是由 profile 的 `node_modules` 解析。
  选它是为了开发期的迭代速度：改 `lib/client.js` 刷新即生效、改 `prices.json` 即时生效、
  改宿主只要 `reload-host.mjs` 换名 + 停用启用；走 tarball 则每次都要 pack → 安装 → 重启。
  包形态早就备好（`dsh.bundle.patch` + 包内 `cordis.patch.yml` 用裸包名 insert）——
  真要切成包安装时**必须先删掉 profile 里那条 `file://`**：两条都用 `id: sym-cost`，并存会撞 id。
- DSH 的 skill 扫描根：`<项目根>/.dsh/skills`(100) → `<项目根>/.agents/skills`(200) →
  `custom`(300) → `$DSH_HOME/skills`(400) → `~/.agents/skills`(500)
- **技能目录是会话开始时的快照**，新建/复制进去的技能**当前会话看不到**，需开新会话
- `project-architect` 等四个技能的附件（`references/` `scripts/` `assets/`）**不存在**，
  只有 `SKILL.md`；照方法论人工执行，**不要假装跑了校验脚本**

### 宿主改动到底有没有生效（2026-09-30 踩过两次）

- **不要看 `fiberPhase: active`** —— 跑着旧模块的实例也是 active，`moduleName` 显示新文件名
  也可能是错觉。**唯一可靠判据**是
  `~/.dsh/storages/session_projcache/sessions/<sessionId>.json` 的 `rows` 里
  **有没有你新加的投影 key**（或老 key 的 `val` 有没有按你的新代码变化）。
- 流程必须是三步：**换文件名 → 停用插件 → 启用插件**。只换文件名不够（模块缓存），
  而且 HMR 只会重新组合配置、不会重载插件代码。停用/启用可以在会话里用插件管理器直接做
  （`set_plugin`，entryId 是 `include:sym-cost`），**不必重启 App**：

  ```
  node scripts/reload-host.mjs --apply     # 换名 + 同步引用（已经脚本化）
  # 然后 plugin_manager: set_plugin false → true
  ```

### 投影单元的一个坑（同一天踩到）

**`apply` 必须至少让 state 变一次**（哪怕只是翻转一个占位字段）。state 引用始终不变时，
宿主不会计算客户端视图、也不会缓存它，于是该 key 既不在 baseline 也不在增量里 ——
界面表现是**什么都不发生且没有任何报错**。`sessionCost` 之所以没暴露这个问题，是因为它
每轮都在变。守卫见 `test/host.test.mjs` 的「state 在首个事件后只变一次」。

**计费数据的到达时机（2026-10-02 查 asar 确认，别再重复投入）**：宿主 `sessionCost` 只认三个
事件 —— `request/header`（只记 model/provider）、`llm/retry-started`（清掉待结算的临时记录）、
**`assistant/message`（唯一累加 `requests` 与 token 桶的地方，它带 `usage`）**。
`assistant/chunk` 的 payload 里**没有** usage（asar 55364143 的 `streamChunkValue` 枚举了全部
分片类型：block-start / text-delta / reasoning-delta / tool-call-delta / block-end）；官方的
`tokenUsage` 投影也只认 `assistant/message` / `assistant/attempt`（asar 59325826，注释写明
「the last usage sample embedded in its stream」）。
→ **新会话第一轮在结算前算不出金额**，这是数据层面的必然。也别用输出 delta 估算：
实测 cacheHit 占 token 的 99.3%、output 只占 0.55%，估出来只有真实值的零头。
→ 相关约定：计费为 0 不等于「没有会话」，所以 `CostPill` 里「还没结算」只能关掉花费那一半，
不能把整格 return 掉（内存读数与结算无关）。另：这个组件的 `useDisplayOptions()` 一度排在
条件 return 之后 —— **槽组件里所有 hook 必须在任何 return 之前**。

**槽的 `locale` 声明只决定"给不给条目注入 `t`"，不控制渲染（2026-09-30 查 asar 更正）**：

- 官方 slots 渲染侧的原话（asar 偏移 22565236）：

  ```js
  if (entry.locale !== void 0) {
    const face = host.locale;
    if (face === void 0) throw new SlotAssemblyError(`entry declares locale namespace '${entry.locale}' but no locale face is installed …`);
    kit["t"] = localeSeat(face, entry.locale);
  }
  ```

  全库 `entry.locale` 只出现在这一个函数里，**渲染路径没有任何基于它的过滤**。
- 结论：带 `locale: NS` → 条目拿到 `t`（跟随界面语言）；`locale: null`（`registerSlotCell` 会把
  字段删掉）→ 条目拿不到 `t`，但**照常渲染**。唯一会因 locale 而不渲染的情形是 `host.locale`
  缺失时抛 `SlotAssemblyError` —— 我们自己在 `apply` 里就 `ctx.locale.register(NS, …)`，不会缺。
- ⚠ **本节此前写的两条规则都是错的，一并作废**：（a）"owner 投影 locale 的槽，去掉 locale 就
  不渲染"；（b）"用 standardProps 里有没有 `t` 判断投不投影"。（b）的反例是硬的：
  `conversation.composer.dock` 与 `conversation.session.header.utilities` 的 standardProps
  **逐项完全相同**、都没有 `t`，却被记录成相反的两种行为。
- **实践准则**：默认**带** locale（`registerSlotCell` 的默认值就是 `NS`，不要传
  `{ locale: null }`，除非你确认这个槽不需要本地化文案且想省掉 `t`）。代价是英文界面下自己的
  文案会回退内置中文字典 —— `tr()` 在 `t` 不是函数时无条件用 `zh`（见 `lib/client.js` 的 `tr`）。

**`remote` 的 namespace 必须声明注入**：直接 `ctx.get("remote").settings` 会抛
`cannot get property "remote.settings" without inject`。要用
`ctx.inject(["remote", "remote.<ns>"], (child) => ...)`，拿不到时降级而不是整块不注册。

**remote 的方法要保持方法调用形式**：`settings.describe()` 可以，
`const d = settings.describe; d()` 会丢 `this` 并抛错。

**改名之后必须全局搜旧名**：把竖条里的 `projected` 改成 `fromProjection` 时漏改一处
`data-*` 属性，组件每次渲染都抛 ReferenceError，React 把整条竖条卸载 —— 现象与"槽不渲染"
一模一样（界面上什么都没有、没有报错浮出来），为此查了很久。所以补了渲染冒烟测试：
`test/client.test.mjs` 会真的调用一次竖条与设置页组件。

**`.volatile()` 不是"标记为可编辑"**：它是"该字段的值由设置服务托管"，
实测会让值变成 `{}`（`new Config({})` → `{ enabled: {}, buttons: {} }`）。
设置页编辑普通配置不要走这条路。

**`settings.describe()` 的返回值是两层包装**：`{ ok, value: { writable, hasDocument,
namespaces: [...] } }`，且 descriptor 里的 `schema` 是 schemastery 内部形式（`uid`/`refs`），
不是 JSON Schema —— 想按结构识别自己的配置项会失败，按 `ns` 认更可靠。

**选槽先看"会不会被替换掉"**：`conversation.input.dock` 挂在 `conversation.content` 下，
交互问卷 / 审批把内容区整体替换时它跟着被卸载 —— 界面表现是"弹窗一出来，常驻 UI 就没了"。
常驻 UI 要挂会话头部这类槽（`conversation.session.header.utilities`）；
**`conversation.composer.bar`（resident composer body）下面的槽同样常驻** ——
`input.left` / `input.right` / `input.model` / `input.permission` / `input.plan` /
`input.activity` 都挂在它下面，问卷/审批替换的是 `conversation.composer`（chain 型），
不是 `composer.bar`（2026-09-30 余额格改挂 `input.right` 时查明）。
元素本身是 `position: fixed` 时，挂哪个槽都不影响视觉位置，所以**常驻性是选槽的首要标准**，
不是位置。

**往侧栏加东西：没有位置可挑，且不要用浮层定位**。

- 可挂的槽只有 `sidebar.footer.action`（设置按钮旁）与 `sidebar.panellist`（面板图标）这类
  list 槽。侧栏顶部那块空白（"后台任务"行与搜索框之间）**没有槽**：`sidebar.workspaces`
  是 single 型，挂进去会把整个会话浏览区顶掉，`sidebar`（整列）同理。
- 侧栏祖先链上有 transform 之类的属性，`position: fixed` 会相对那个祖先定位，而不是视口 ——
  于是 `left:8px; top:56px` 会落到看不见的地方。**侧栏内的元素一律参与布局**，
  不要做浮层定位。
- 同理，按哈希类名定位（`_sidebarCol` / `_centerCol`）在这里也不成立：余额的 DOM 祖先里
  并没有这些类名。位置相关的假设，先查槽、再查 CSS 上下文，别直接猜类名。

**余额曾经"借位"，别再走那条路（2026-09-30 的教训）**：

- 旧实现把余额格注册在**会话头部槽**（`conversation.session.header.utilities`），却用
  `position: fixed` + 量 `_sidebarCol` 的像素把自己画到**侧栏底部** —— 注册点（会话级，
  切会话就重挂）与视觉位置（全局）是两套生命周期：每次重挂都要重新测量、命中前重试
  25 × 200ms，量不到就停在 CSS 默认的视口右下角。**这就是"不稳"的来源。**
- 为了让这个错位看起来自然，还配了一条**静态**规则把官方 footer 从竖排改成横排
  （`_footArea` / `_footerActions` / `_settingsArea`）。余额是 fixed、本就脱流，那条规则
  帮不上它；它唯一的实际效果是把**官方账户行（头像 + 用户名）推到右侧**，用户一眼看出
  "名字的位置变了"。已删除。
- 现址：`conversation.input.right`（list 型）。它与**模型选择器同在 `standardControls` 容器**
  里，官方 JSX 顺序就是 `[input.right][input.model]`，所以余额落在**模型名的正左边**（用户要的
  "靠右、贴着模型选择"）。它挂在 `conversation.composer.bar`（resident composer body）下 ——
  问卷/审批替换内容区时不会跟着被卸载（`conversation.input.dock` 会）。位置由官方工具行决定：
  **零测量、零重试、零改官方布局**。
  ⚠ 代价一：`standardControls` 带 `hidden={activity}`，而这个 `activity` 来自
  `conversation.input.activity` 的 occupant —— 官方的**实验性语音输入**（`phase !== "idle"`，
  见 `VoiceInput` 的 `useLayoutEffect`）。即**录音 / 转写期间**整个容器连同模型选择器一起隐藏，
  余额跟着隐藏（与模型名同进同退）。官方该槽 ownerProps 的原话是
  "A toolbar activity hides ordinary accessory controls while expanded"。
  ⚠ **不是"agent 运行中就隐藏"**（我在会话里口头这么说过，是错的）；未安装那个实验 bundle 时
  `activity` 恒为 false，永不隐藏。
  ⚠ 代价二：槽是 `scope: "session"`，而官方同一时刻可以挂多份会话（右侧栏聊天标签
  `sidebar.chat.conversation`、子代理面板 embedded 渲染 `conversation.content`）——
  **每份工具行都会出现一个余额**。旧实现是 `position: fixed`，多实例重叠在同一像素上所以
  看不出来；改成参与布局后重复会显形。
- 判断口诀：**注册在哪个槽，就渲染在哪个槽**。若非要让 A 槽的元素出现在 B 处，
  先问"B 处有没有可加的槽"；没有就接受 A 处的位置，**不要用 fixed 去伪造**。

**别用静态 CSS 规则去改官方布局**：上一版曾写"静态规则比 `:has()` 安全"，这只说对了一半 ——
静态规则不随元素出现/消失而开关（所以不闪），但它**照样在替官方元素决定位置**。删掉的那条
`[class*="_footArea"]{flex-direction:row}` 就把官方账户行整块推到了右侧，而它当初的理由
（"让余额和设置并排"）根本不成立 —— 余额是 `position: fixed`，脱流的元素不需要任何规则帮忙。
**只有当真要替换官方排版时才动官方 CSS；自己的浮层一律自己定位。**

**客户端半边不能拆文件（2026-10-05 查 `dsh-client-modules` 证实）**：加载器确实支持
包内动态 chunk —— `require.async("./client.xxx.js")` 走 `importChunk`，但 chunk 的 URL 由
`chunkUrl(row, …)` 从 **owner 的 bundle URL** 推导，而它要求那个 URL 里带 `/??<id>/client.js`
与 `&rev=` 这一段（原文：`cannot resolve chunk … from bundle URL`）。
**`file://` 挂载的插件没有这种 URL**，所以拆不出 chunk；`require("./x.js")` 同样不行
（只解析平台 seed、已物化模块与 boot graph 行）。
→ 因此 `lib/client.js` 的体积只能靠**就地压缩**来控制；要真正拆文件，前提是改成走
HTTP bundle 服务的包安装形态。相关阈值见 `.project-architect.json` 的 `loc.hardCeiling`。

**往输入框里"放一条指令"要带尾随空格**：客户端把**"命令 + 空格"**认作"指令行、开始收参数"，
这与从官方 `/` 菜单选中一条指令后的状态一致（如 `/goal` 会提示"输入目标，…"）；只填命令名
（`/goal` 不带空格）则只会弹出 `/` 菜单，还要用户再选一次。

另外：**菜单选中后的结构化命令 chip 是客户端 slash 流水线的内部结构，插件构造不出来** ——
插件能做的只有"填入文本 + 空格"这个等效形态。

> **⚠ 上面这条已被 2026-10-05 的发现取代，读下面「官方命令可以直接走菜单 pick 通道」一节。**
> 结论没错（chip 节点确实构造不出来），但它**不再是限制**：插件不必自己造 chip，
> 把 pick 交回官方、由官方去造即可。

**更正（2026-09-30 查线上 bundle 得到）**：此前这里写着"`inputActions` 只有 `insertText` /
`captureInsertion`，没有提交能力"，**是错的**。slot props 里的 `inputActions` 就是
`SessionInputShell.actions`（`@deepseek-ai/dsh-client-ui-conversation/lib/client.js` 里
`props: { inputActions: shell.actions }` 那一行），它一共给了七个方法：
`captureInsertion` / `insertText` / `setDraft` / `addAttachments` / `removeAttachment` /
`pruneAttachments` / **`submit`**（`submit: () => this.submit("queue")`，等同按回车）。
所以"填进去并自动执行"在通道层面是**够得着**的。仍然做不到的是"靠自己拼出一次
菜单 pick 的**结果**"：那个蓝色 token 与客户端自有命令的回调只由输入框的 `/` 菜单触发。
（`submit()` 提交一段 `/命令 ` 文本会不会被 slash 流水线解释成命令，**没有验证过**。）

**往输入框写完之后要把光标还回去**：输入框是官方的 Lexical `contenteditable`，
根节点带 `data-composer-input`（属性选择器，不受哈希类名影响），Lexical 还把编辑器实例挂在
同一个节点上（`root.__lexicalEditor`）。点 `<button>` 会把 DOM 焦点抢到按钮上，文字虽然进了
草稿，但光标没了、接着打字打不进去。两条一起用：

- `onMouseDown` 里 `event.preventDefault()` —— 鼠标路径下焦点**根本不离开**输入框，
  连闪一下都没有（click 照常触发）；
- 插入成功后再 `focusComposer()` —— 兜住键盘激活、以及光标本来就不在输入框的情况。

归还顺序必须与官方 `SessionInputShell` 一致：**先** `root.focus({ preventScroll: true })`
（拿回键盘），**再** `editor.focus()`（让 Lexical 还原它自己记的选区）。直接对
contenteditable 裸调 `focus()` 会把光标丢到开头。见 `focusComposer` / `keepComposerFocus`。

**但"往输入框写字"不是只有一条路 —— 官方同一时刻可以挂多份会话，每份都有自己的输入框**：

- 右侧栏的聊天标签走 `sidebar.chat.conversation`，槽清单里它的 standardProps 明确含
  `inputActions` / `useInput`，也就是**一份完整的 Conversation occurrence**；
- 子代理面板用 `variant: "embedded"` 渲染 `conversation.content`（`dsh-client-ui-subagent`
  的 `ConversationSlotPanel`）。

所以 `document.querySelector("[data-composer-input]")` 是**猜**：它拿文档顺序第一份，
不一定是点按钮的那个人正在用的那份（竖条本身也是会话级的，可能同时存在两份）。
正确的做法是按**触发元素**收窄 —— `dsh-client-ui-renderer` 给每个槽渲染的 div 打
`data-slot=<槽名>`，官方 CSS 自己也选 `[data-slot=conversation\.session]`，所以
`from.closest('[data-slot="conversation.content"], [data-slot="conversation.session"]')`
是稳的。收窄的规矩（见 `findComposer`）：

- 光标已经在某个输入框里 → **什么都别做**（鼠标路径下 `preventDefault` 让它根本没动过）；
- 找得到会话容器 → 只在容器里找；**容器里没有可用输入框就不要越界**去抓别人的；
- 容器都找不到（按钮不在会话里）→ 才退回全文档查找。

**同一个 `[data-composer-input]` 还有两种"不是真输入框"的形态**，命中它们会让"成功"变成谎报：

- workspace 触发器状态：官方 JSX 是 `editor: workspaceTrigger ? null : editor`，于是
  `contenteditable=false`、`__lexicalEditor` 被 delete，但属性还在；
- `phase=settling`：官方 CSS 把整个 composer 座位设成 `visibility: hidden`（还挂着，
  所以 `getClientRects()` 抓不到它，得用 `getComputedStyle`）。

判据两条一起用：**有 `__lexicalEditor`** 且 **`contentEditable === "true"`** 且**可见**。
拿不到编辑器实例就**一个 focus 都别做** —— 裸 focus 会把 DOM 插入点放到偏移 0，
Lexical 又可能把 DOM 选区回收成模型选区，结果是"文字插到草稿开头"。这种情况记
`noteDegrade("focus:no-editor", …)`，不要猜。

**看数不写字的按钮也要挡一下**：成本药丸是 `display:contents` 的 span，余额药丸是 button，
点它们都会把输入框的焦点弄丢（非聚焦元素被点时焦点掉到 body）。它们只挂
`keepComposerFocus`（不抢），**不要**调 `focusComposer`（看花费不是要写字，不该把光标抓过来）。

**官方 `/` 菜单里的命令分两类，插件能做的完全不同**（⚠ 下半段关于"客户端自有命令"的
结论已被 2026-10-05 取代，见紧随其后的新节；这里保留原文是因为"命令确实分两类、`execute`
对第二类返回 `undefined`"仍然成立）：

- **宿主命令**（压缩 compact / 权限 permission / 模型 model / 下载日志 export）：可以走
  `remote.commands.execute(sessionId, line, [])` 直接执行，点一下即生效。
  注意 agent 参数用 sessionId（与 `execute` 的既有用法一致），并且**必须条件注入**
  `ctx.inject(["remote", "remote.commands"])` —— 注册那一刻的快照会是 null，要传 getter
  在点击时现取。
- **客户端自有命令**（文件 file / 目标 goal / 计划 plan / 反馈 feedback）：README 原文是
  "贡献项是客户端自有命令…裸调用消费触发 token 后运行回调，不提交消息"。它们**不走宿主**，
  `commands.execute` 对它们**永远返回 `undefined`**。它们只能由输入框的 `/` 菜单 pick 触发，
  而那个蓝色 token 是客户端输入框的内部结构 —— `commandUi` 只暴露 `decorate`（给已有命令加
  装饰），`inputActions` 里**没有"以编程方式选中一条命令"的入口**（它有的是
  `setDraft` / `insertText` / `submit` 这类，见上面的更正）。插件最多只能落下白色文本，
  视觉上永远比不上菜单 pick 的蓝色 token。

判断办法：填了命令 + 回车看结果，或直接看 `execute` 的返回值是不是 `undefined`。

## 官方命令可以直接走菜单 pick 通道（2026-10-05 实测，取代上面两条否定结论）

**结论**：插件**能**做出与"从输入框左下角 `+` 菜单里选中一条命令"完全一致的效果 ——
包括蓝色命令 chip、参数提示（claimed 状态），以及无参数命令的直接执行。
办法不是自己造 chip（那确实造不出来），而是**把那次 pick 交回官方**。

三步，全部是官方 `dsh-client-ui-commands` 包里 `CommandUiRuntime` 的既有路径：

```js
// ① 目录就绪（descriptor 只在 ready 时能 resolve）
await ctx.get("commandUi").directory.ensureReady(sessionId, signal)   // signal 必须是真的！
const span = inputActions.captureInsertion();                          // { start, end, draftRev }
// ② 官方菜单 pick 的决策表：contribution/decoration → popup 或 action；
//    有 input 的宿主命令 → 返回 { claim }；无 input 的 → 自己 consume + 执行，返回 "handled"
const outcome = commandUi.dispatch({ candidate: { name }, session, span });
// ③ 拿到 claim 就交回会话 shell（与菜单点击后 execute(outcome, span) 做的事一模一样）
binding.ctx.bail(binding.ctx, "slash/input-begin-command", { claim: outcome.claim, span });
```

- `session` 与 `binding.ctx` 来自 `sessions.binding(sessionId)`（`sessions` 在公开服务目录里）。
- 落点是 `lib/client.js` 的 `commandBridge` / `runOfficialCommand` / `runCommandButton`；
  `commandUi`、`sessions` 都是**官方内部服务**（不在公开服务目录），所以整条路径写成
  "任一步拿不到就返回 `null`、由调用方降级"，而不是让竖条不渲染。

**两个实测踩到的坑（都会静默退化成"点了没反应"）**：

1. **`ensureReady(sessionId, signal)` 的 `signal` 不能省。** 它内部第一件事是读
   `signal.aborted`，传 `undefined` 当场抛 TypeError；被 catch 吞掉后目录永远不 ready，
   `dispatch` 拿不到 descriptor → 静默降级。用一个永不中止的 `AbortController().signal`。
2. **`ctx.get("remote")` 会抛。** 未声明注入时是
   `cannot get property "remote" without inject`；这个调用点在**点击时**，抛错会把整次点击
   吞成"失败"。要用 `ctx.inject(["remote", "remote.commands"], (scope) => ...)` 条件注入、
   点击时现取。

**降级顺序（通道不可用时）**：按 descriptor 有没有 `input` 分流 ——
有 input（目标 / 计划）→ 填 `命令 + 空格` 进草稿（回车时客户端自己会进 claim，功能一致）；
没有 input（压缩 / 权限）→ 走 `remote.commands.execute`。
**不能对无参数命令填草稿**：`/compact ` 带空格回车会被当成普通消息发出去。

**真机证据（2026-10-05，DSH 桌面应用）**：点竖条上的官方命令按钮后 ——
`/目标` → 草稿出现蓝色 chip `/目标` + 提示「输入目标，智能体将持续执行」；
`/计划` → 蓝色 chip `/计划` + 「描述你的任务以生成计划」；
`/权限` → 弹出官方权限选择器（仅可查看 / 工作区内修改 / 完全权限 / Auto review）。
三者都与从菜单选中同一条命令的表现一致。`/compact` 未做端到端点击（会真的压缩会话，
属破坏性操作），但它与 `/权限` 同属"无 input → runDetached"分支，该分支已由 `/权限` 证通。

**顺带更正**：官方 `BUILTINS`（`dsh-client-ui-commands/lib/client.js`）把 goal / plan / feedback /
compact / permission / export 都定义成**宿主命令**（`definitionId` 指向 `dsh-command-goal`、
`dsh-plan-mode`、`dsh-command-compact` …），"客户端自有命令"那半段描述的是更早的 README。
菜单的「添加」段 = `file / goal / plan / feedback`，「指令」段 = `compact / permission / model / export`；
中文界面下 pick 写进草稿的是**本地化拼写**（`claimToken` → `token.goal` = `目标`），
不是 `/goal`。
