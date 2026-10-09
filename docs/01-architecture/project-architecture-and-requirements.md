# dsh-sym 项目架构与需求基线

> 本文档是 `dsh-sym` 的**需求与技术路径基线**，由 `project-architect` 技能的「首次启动」模式建立。
> 它是下游 `docs/04-delivery/project-plan-task-charter.md` 的**唯一上游依据**。
>
> **校验状态**：⚠️ **人工对照，无脚本校验**。
> 该技能正文引用的 `scripts/check_project_architecture.py` 等三个校验脚本、8 份 `references/*.md`
> 与 `assets/audit/` 模板**在实际 skill 目录中并不存在**（详见附录 B）。因此本文档的所有约束
> 由人工逐条对照执行，**没有任何机器校验的背书**。

- 建立日期：2026-09-30
- Profile：`core` + `ui` + `service`
- 项目根：`~/GitHub/DSH-Sym`（2026-09-30 从 profile 的 `plugins/` 目录搬出；插件仍由
  `~/.dsh/profiles/desktop/cordis.patch.yml` 里的 `file://` 条目挂载，换路径后需重启 App）
- 当前版本：`1.5.0`（未发布 npm；经 GitHub Release 分发，变更记录见 `CHANGELOG.md`）

---

## 1. 输入与假设

### 1.1 输入门禁确认结果

| 门禁项 | 结论 | 来源 |
|---|---|---|
| 要解决的问题 | DSH 界面上已有信息没有"算给人看"；反复手动做的事缺少一键 | 用户访谈（本次会话） |
| 目标用户 | 首要为作者本人；次要为 DSH 社区（已公开仓库） | 用户确认 |
| 首个核心场景 | 会话进行中，随时看到花费 / 余额 / 时段，不必离开对话去查 | 已实现并验证 |
| 平台 | macOS + DSH Desktop（Electron）；DSH 亦有 Web 形态 | 运行环境实测 |
| 关键约束 | 零依赖、无构建步骤、不替换官方组件、不新增客户端→宿主通道 | 见 §5、§7 |
| 项目根目录 | `~/GitHub/DSH-Sym` | 本次盘点 |
| 写入授权 | **已授权**：可创建治理文件并提交到仓库 | 用户明确授权 |

### 1.2 假设（假设必须显式标注，不得伪装成约束）

- **A-1**：DSH 的插件插槽契约（`list` 型可加法注册、`single` 型为替换）在可预见的版本内保持稳定。
- **A-2**：用户主要使用 DeepSeek 官方模型，其他厂商为偶发。价目表的正确性以 `pi-ai` 目录与 DeepSeek 官方价为准。
- **A-3**：状态栏与侧边栏的可用宽度不会显著缩小，读数不至于被挤压到不可读。
- **A-4**：宿主侧改动需要"换文件名 + 停用/启用"来生效这一机制不会改变。

### 1.3 当前状态（本次盘点，2026-09-30）

```
Git        干净（0 未提交）· main · git@github.com:seeseeczl/dsh-sym.git
已有规范   README.md / PUBLISHING.md / LICENSE
缺失规范   AGENTS.md · CONTRIBUTING.md · .project-architect.json · docs/
测试入口   无（package.json 无 scripts 字段）
依赖       零（dependencies 与 devDependencies 均空）
代码规模   2268 行：client.js 1349 + host-v18.js 833 + move-session.js 86
```

---

## 2. 目标与非目标

### 2.1 目标

- **G-1**：把 DSH 界面**已经存在但未呈现给用户**的数字，转换成可直接使用的读数（成本、余额、时段、内存）。
- **G-2**：对**需要反复手动执行**的动作提供一键入口（引用回复、复制路径、在访达中显示）。
- **G-3**：这些能力以**加法**方式接入，官方 UI 的行为与布局在插件缺席时不变。
- **G-4**：长期可维护——新增能力不因名字或结构受限（"共生体"命名的用意即在此）。

### 2.2 非目标

- **N-1**：**不替换任何官方组件**。`single` 型插槽不接管（例外与理由见 ADR-004）。
- **N-2**：**不新增客户端→宿主通道**。已验证该能力在当前架构下不可得（ADR-003）。
- **N-3**：不引入构建步骤、打包器或任何运行时依赖。
- **N-4**：不做微服务拆分（无独立部署、容量或隔离证据）。
- **N-5**：不修改 DSH 安装目录内的任何文件。

---

## 3. 功能需求（FR）

编号一经分配不再复用；已实现项标注实现位置与验收方式。

| ID | 需求 | 状态 | 实现位置 |
|---|---|---|---|
| FR-01 | 状态栏显示本会话累计花费（人民币），悬停展开逐桶账单 | 已实现 | `client.js` `CostPill` / `describeScope` |
| FR-02 | 状态栏同一按钮内显示右侧刻度选中那一轮的花费 | 已实现 | 同上（`useActiveTurn` 读取刻度） |
| FR-03 | 输入框工具行里、模型选择器左侧显示 DeepSeek 账户余额 | 已实现 | `client.js` `createBalanceCell`（挂 `conversation.input.right`） |
| FR-04 | 品牌行后显示峰时/谷时状态灯，并按固定边界刷新 | 已实现 | `client.js` `installPeakTag` |
| FR-05 | 每条回复的动作行提供"引用此回复作为上下文"按钮 | 已实现 | `client.js` `QuoteAction`；宿主 `agent/pre-step` 展开 |
| FR-06 | 点击花费金额弹出面板：实际支出、谷时省下、峰谷拆分、本次任务 | 已实现 | `client.js` `CostPanel`（缓存省下与「本来要花」已按用户要求移除） |
| FR-07 | 峰时用量给出"改到谷时可再省多少" | 已实现 | `client.js` `tierSpend` |
| FR-08 | 状态栏显示 DSH 进程常驻内存（rss） | 已实现 | 宿主 `readProcessMemory` + `client.js` `formatBytes` |
| FR-09 | 回复中的文件链接支持右键：复制路径、在访达中显示 | 已实现 | `client.js` `LinkContextMenu` |
| FR-10 | （搁置）会话跨工作区移动 | **未接通（代码已移出生产模块）** | 设计记录 `docs/01-architecture/adr-003-session-move-not-wired.md`，缺客户端→宿主通道 |
| FR-11 | 会话头部常驻显示当前分支 + 工作区改动规模（**不含建 PR 入口**：用户一个人在主干预直接推，2026-10-09 撤回） | 已实现（CR-0001） | 宿主 `lib/host-v18.js` 的 `GIT_STATUS_ROUTE` 路由（只读 git）+ 客户端 `lib/client.js` 的 `GitStatusCell`（挂 `conversation.session.header.utilities`, order -20） |
| FR-12 | 本地分支数 > 1 时，点胶囊上的分支名可切换本地分支（`git switch`，不 `-f`/不 stash） | 已实现（CR-0002） | 宿主 `lib/host-v18.js` 的 `switchBranch` + 路由 POST；客户端 `GitStatusCell` 的分支菜单 |

### 3.1 每条 FR 的验收方式

| FR | 验收 |
|---|---|
| FR-01/02 | 状态栏可见一个按钮，含两个金额；悬停出现账单文本 |
| FR-03 | 模型选择器左侧出现余额；读不到时显示 `—` 并**保持占位**（不显示 0，也不让格子忽隐忽现去推挤模型名） |
| FR-04 | 伪造时钟跨越 09:00/12:00/14:00/18:00/00:00，标记按时翻转；峰时琥珀、谷时绿 |
| FR-05 | 点击后输入框插入 `@引用#<12位id>`；发送时宿主展开为原文；**点完光标仍在输入框**（快捷按钮同理） |
| FR-06 | 点击金额弹出面板；点击面板外或 Esc 收起 |
| FR-07 | 仅有峰时用量时给出可省金额；非峰谷定价厂商**不**给该提示 |
| FR-08 | 状态栏出现内存读数；无 `process` 时该格**不渲染** |
| FR-09 | 文件链接上右键弹出菜单；非链接位置**放行**官方菜单 |
| FR-10 | 不适用（未接通） |
| FR-11 | 头部出现分支名与 `+N −M`，数值与 `git status` / `git diff --numstat HEAD` 一致；非 git 仓库的会话里整块不渲染；**不出现任何建 PR 入口** |
| FR-12 | 两个分支的仓库里点分支名能列出两个并切过去（`git branch --show-current` 跟着变）；工作区冲突时 git 拒绝并原样回显；只有一个分支时分支名不可点 |

---

## 4. 非功能需求（NFR）

| ID | 需求 | 验证方式 |
|---|---|---|
| NFR-01 | **零运行时依赖**，无构建步骤 | `package.json` 的 dependencies 为空；无 scripts |
| NFR-02 | **数据不可得时安静退场**，不显示 0 或占位符 | 各组件在无数据时返回 null（已在单测覆盖） |
| NFR-03 | **插件缺席时官方布局不变** | 全部走 list 型插槽加法；峰谷标记为 `::after`；不写任何重排官方布局的规则 |
| NFR-04 | 视觉跟随主题，不硬编码颜色 | 只用 `--dsw-*` 语义变量（面板曾因猜变量翻车，见 ADR-005） |
| NFR-05 | 字号/行高与所在行的官方读数一致 | 实测对比通过（12px / 24px / 同色） |
| NFR-06 | 宿主半边改动不破坏既有会话数据 | 投影 `stateVersion` 变更时注册表拒绝旧 checkpoint 并重建 |
| NFR-07 | 单个组件异常不连累其他能力 | `require("react-dom")` 等外部依赖包在 try/catch，缺失即降级 |
| NFR-08 | 不在日志或界面泄露凭据 | 从不读取凭据文件；余额走官方 `remote.account` |

---

## 5. 推荐技术路径与取舍

### 5.1 路径

两个半边，各自运行在不同进程：

```
宿主（Electron 主进程，Cordis 插件树）
  lib/host-v18.js
    ├─ sessionProjections 注册 sessionCost（key=sessionCost, stateVersion=3）
    │   纯折叠 session/event：request/header、assistant/message、llm/retry-started
    │   只存 token 数（按峰谷 / 按轮次 / 按模型分桶），不存金额
    ├─ 价目三级来源：DEEPSEEK_CNY → pi-ai 目录 → lib/prices.json
    ├─ session/event 监听 → 维护 messageId→正文索引（引用展开用）
    ├─ agent/pre-step 监听 → 把 @引用#<id> 展开成完整原文
    └─ view() 时读取 process.memoryUsage().rss

客户端（渲染进程，React 组件注册到插槽）
  lib/client.js
    ├─ conversation.composer.dock        ×2  → 花费按钮 + 链接右键菜单
    ├─ conversation.chat.assistant-actions ×2 → 每轮费用 + 引用按钮
    └─ conversation.input.right           ×1  → 账户余额
```

### 5.2 关键取舍

- **为什么 token 在宿主算、金额在客户端算**：价目表可能随时被 `lib/prices.json` 改动。宿主只折叠可序列化的 token 数（跨重启一致），客户端每次渲染用**当前**价目重新折算，因此改价格不需要重算历史、也不需要重启。→ ADR-002
- **为什么用投影而非自建 remote**：客户端 Remote 命名空间由 `dsh-api-remotes` 在**构建期**选定，插件无法新增。投影是唯一"宿主产数据、客户端读"的现成通道。→ ADR-003
- **为什么内存读数放在 `view()` 而不是 `apply()`**：`view()` 只在会话变化时重算，与内存变化的粒度匹配；若每次读取返回新对象会击穿 `viewCache`，导致客户端无限重渲染。
- **为什么余额走 `remote.account` 而非自己请求**：与「设置 → 账户」同一份凭据、同一个官方接口，不接触凭据文件。→ NFR-08

---

## 6. 模块、数据与接口边界

### 6.1 模块清单

| 文件 | 职责 | 变更代价 |
|---|---|---|
| `lib/host-v18.js` | 投影折叠、价目来源、引用展开、内存读数 | **高**：需"停用 → 换文件名 → 启用"或重启；换名与同步引用用 `scripts/reload-host.mjs` |
| `lib/client.js` | 四处显示、峰谷标记、花费面板、链接右键菜单 | 低：热更新即生效 |
| `lib/prices.json` | 价目覆盖 / 汇率 / 节假日 | 低：按 mtime 即时生效 |
| `cordis.patch.yml` | 组合包补丁，使 profile 一次性装好 | 中：改动触发宿主重载 |
| `test/`、`scripts/` | 仓库内回归（`npm test`）与开发脚本 | 不适用（不计入生产代码） |

> `lib/move-session.js` 已于 2026-09-30（治理审计 P0-03）移出生产代码，
> 原始实现完整保留在 `docs/01-architecture/adr-003-session-move-not-wired.md`。

### 6.2 数据边界

- **投影 `sessionCost`（stateVersion 3）** 是宿主与客户端之间**唯一**的数据契约。
- 投影只存 token 数、请求次数、轮次索引；**金额、单价、汇率均不入库**。
- 客户端可读的字段：`cny` `requests` `peakRequests` `tokens` `cost` `models` `unpriced` `turns` `usdToCny` `peakNow` `catalogSize` `memory`。

### 6.3 接口边界（对外契约）

- **价目覆盖文件格式**：`{ usdToCny, holidays[], models{} }` —— 对用户可见，**改变即为破坏性变更**。
- **引用标记格式**：`@引用#<messageId 去连字符前 12 位>` —— 客户端与宿主共享，**改变需两端同步**。
- **DOM 属性**：`data-sym-cost-part` / `data-sym-turn-cost` / `data-sym-memory` / `data-sym-link-menu` / `data-sym-cost-panel` —— 供验证脚本定位，**非稳定 API**。

---

## 7. 设计与质量约束

### 7.1 设计约束

- **加法优先**：优先使用 `list` 型插槽；`single` 型插槽仅在不接管就无法达成目标时使用，且必须保留官方行为。
- **语义色**：颜色一律取自 `--dsw-*` 变量。峰时用 `state-warn-primary`（琥珀），谷时用 `state-success-primary`（绿）。
- **排版一致**：读数与同行的官方读数共用字号/行高表达式（`--dsh-content-font-size-secondary` 等）。
- **弹层材质**：与官方一致 —— `--dsw-specific-menu` + `--dsw-elevation-prominent` + `--dsw-radius-lg`。

### 7.2 质量约束

- 新增或修改客户端逻辑时应附带**可复现的验证**；涉及宿主的改动需**在真实运行环境验证**。
- **已知缺口**：验证脚本目前位于 `/tmp/costtest/`，**未纳入仓库**，因此在治理意义上**不可追溯**。→ 已列为任务卡 T-08。
- ⚠️ 本技能的三个校验脚本不存在，**无法执行机器校验**。

---

## 8. ADR 与 REG 追溯

### 8.1 架构决策记录（ADR）

| ID | 决策 | 理由 | 状态 |
|---|---|---|---|
| ADR-001 | 采用"宿主投影 + 客户端渲染"双半边结构 | DSH 插件的既定形态；宿主负责不可在浏览器做的事 | 已采纳 |
| ADR-002 | token 在宿主折叠，金额在客户端折算 | 价目可随时改，改价不需要重算历史或重启 | 已采纳 |
| ADR-003 | 不新增客户端→宿主 Remote 通道 | 客户端命名空间由 `dsh-api-remotes` 构建期选定；已实测四条路径全部不可行 | 已采纳 |
| ADR-004 | 不替换 `single` 型插槽（品牌行例外） | 接管会丢失官方行为（如账户菜单的退出登录）；品牌行改用 CSS `::after`，不接管 | 已采纳 |
| ADR-005 | 视觉常量一律查证官方源码后使用 | 曾因猜测 `--dsw-alias-bg-elevated` 导致面板配色与官方不一致 | 已采纳 |
| ADR-006 | 项目命名 `dsh-sym`（symbiote） | 不限定功能范围；原名 `dsh-session-cost` 在加入引用功能后即名不副实 | 已采纳 |

### 8.2 需求—实现—验证追溯

| FR | 实现 | 验证证据 |
|---|---|---|
| FR-01/02 | `client.js` | 线上实测：按钮含两金额；坐标顺序验证 |
| FR-03 | `client.js` | 线上实测：¥429.70 正常显示；未登录时不渲染 |
| FR-04 | `client.js` | 伪造时钟跨边界实测：峰 `rgb(245,158,11)` / 谷 `rgb(34,197,94)` |
| FR-05 | 两端 | 单测：展开逻辑与 6 类边界；`focusComposer` 的会话收窄 / 已在框内不动 / 跳过隐藏与非编辑器 / 拿不到编辑器实例不裸 focus（假 DOM） |
| FR-05b | `client.js` | 源码守卫：四个会抢焦点的控件（竖条、`@`、成本药丸、余额药丸）都要挂 `keepComposerFocus`，两处插入成功后要 `focusComposer` |
| FR-06/07 | `client.js` | 单测：谷时省下各边界、缓存省下不再出现（反例守卫）；线上实测面板内容 |
| FR-08 | 两端 | 线上实测：`349618176` 字节 → `333M` |
| FR-09 | `client.js` | 线上实测：右键弹出菜单、点复制有反馈、无异常 |

> **REG（回归资产）现状**：上述单测以脚本形式存在于 `/tmp/costtest/`，**尚未纳入仓库**，
> 因此当前**不具备可重复执行的回归能力**。这是本基线已知的最大质量缺口，见任务卡 T-08。

---

## 附录 A：本次会话中已排除的技术路径（避免重复投入）

| 路径 | 排除结论 |
|---|---|
| `remote.session.openWorkspacePath` 作为"移动会话"手段 | 它是"用系统程序打开路径"，与会话归属无关 |
| `remote.workspace.insertSessionBefore` 跨工作区 | 只支持**工作区内**排序；校验会话必须已在该工作区 |
| 官方内部 `attachSession` / `detachSession` | 存在但**未暴露为 Remote** |
| `ctx.typert.register()` 手工注册 Remote | 宿主侧注册成功，但**客户端挂载是构建期行为**；且客户端自挂载要求生成的严格 codec |
| `dynamicCordisRunner` 作为通道 | 沙箱**刻意禁用** fs/网络/进程/定时器；且它是"定义并运行一个插件"，不是"执行一次动作" |
| 合成 `paste` / `drop` 注入图片到输入框 | 目标元素须为 Lexical root；且外壳已禁用屏幕捕获与剪贴板读取 |

## 附录 B：技能附件缺失记录

`project-architect` 技能（`~/.agents/skills/project-architect/` 与 `~/.codex/skills/project-architect/`）
**均只包含 `SKILL.md` 一个文件**，其正文引用的以下附件**不存在**：

```
references/kickoff-and-architecture.md        references/audit-workflow.md
references/governance-and-traceability.md     references/audit-checklists.md
references/module-quality-and-regression.md   references/toolchain-and-ui.md
references/security-operations-and-release.md
scripts/check_project_architecture.py         scripts/bootstrap_project_architecture.py
scripts/audit_project.py                      assets/audit/（报告模板）
```

同目录另外三个技能（`adversarial-audit`、`first-principles`、`personal-knowledge-base`）**同样只有单个文件**。
这些技能的 frontmatter 均带 `agent_created: true`，推断为 AI 生成时只写了正文、未创建配套附件。

**影响**：本基线按 `SKILL.md` 正文的方法论人工执行，**无脚本校验**。
