# 项目审计报告

## 元信息

- 项目路径：`/Users/long/GitHub/DSH-Sym`
- 项目类型：DSH 客户端插件（浏览器 module factory + Node 宿主模块双半边，零依赖、无构建步骤）
- 审计时间：2026-10-14 10:00:55（Asia/Shanghai）
- 当前分支 / commit：`main` / `d85b1d4`
- 工作区状态：**dirty**（24 个变更路径，含 1 个删除：`lib/host-v18.js` → `lib/host-v19.js`）
- 审计范围：`lib/`（2 个生产文件）、`test/`（5 个测试文件 + 1 个替身）、`.project-architect.json`、`docs/`、`openspec/`、`scripts/`、`package.json`、`AGENTS.md`
- 非目标：不改业务代码、不改配置/依赖、不初始化 OpenSpec/CodeGraph、不修复发现
- 请求模式 / 实际模式：标准 / **标准（降级）** —— 静态与自动化测试已验证；**运行与 UI 验证不可得**（无 DevTools 入口，见阻塞项）
- 未覆盖范围：真实界面渲染结果、宿主重载后的投影落地（本轮新增 `contextLoss` 尚未生效）

## 审计模式与证据等级

| 项目 | 结果 | 证据/限制 |
| --- | --- | --- |
| 证据采集器 | 已运行 | 临时 JSON `project-audit-evidence-vb4yc082.json`；schema_version 存在；`scan.truncated=false`（88/20000 文件，全量索引） |
| 静态证据 | **已验证** | 88 文件索引、48 文本文件读取；`lib/`、`test/`、`openspec/`、`.project-architect.json` 逐项核对 |
| 自动化测试 | **已验证** | `npm test` → **97 tests / 97 pass / 0 fail**（551ms） |
| 运行与 UI | 未验证 | 无刷新手段、无 DevTools 可读入口；界面渲染只能靠人工视觉确认（阻塞项 AUD-BLOCK-001） |
| 发布产物 | 未验证 | 无 tarball/Release 产物可比对；`package.json` 1.7.0 与 CHANGELOG 顶部一致，但未验证已发布状态 |

## 结论摘要

- 总体判断：**工程治理水平高、技术债受控**，但存在两个结构性压力点：① 客户端单体逼近 LOC 硬上限；② 工程校验脚本缺失，现有回归全靠人工遵守约定。
- 最大阻塞：**界面渲染与宿主重载无法自动验证** —— DSH 桌面版没有刷新手段，客户端改动必须重启 App 才能观察，导致"代码正确"与"界面出现"之间始终隔着一次人工确认。
- 最大回归风险：`lib/client.js` 3,594 / 3,700 LOC，**仅剩 106 行余量**；下一次功能增加就会触顶，而该文件**不能拆**（`file://` 挂载无 bundle URL）。
- 第一优先优化方向：把 `AGENTS.md` 里那些"靠人记住"的硬规则（换名流程、客户端同步、投影 view 形状）**转成可执行校验**，降低对记忆的依赖。
- 问题统计：S0=0，S1=2，S2=3，S3=3；P0=0，P1=5，P2=3

## 项目简介与功能作用

- 项目简介：给 DeepSeek Harness 的界面读数层。把 DSH **已经存在但未呈现**的数字变成可用读数（会话花费、每轮费用、账户余额、峰谷标记、上下文压缩统计、Git 工作区状态、进程内存），并对反复手动做的事给一键（快捷按钮条、复制会话 ID、导出会话日志、`@` 引用、分支切换）。
- 主要输入/输出与边界：输入是 DSH 宿主的事件流（`assistant/message` 带 usage、`compaction/*`）、配置（`prices.json` + `ctx.subscribe` 配置）与用户操作；输出是**宿主投影**（`sessionCost` / `contextLoss` / `quickActions`）与**界面格子**。**不碰凭据、不调托管平台 API**；宿主侧唯一写操作是 `git switch`（CR-0002）。

| 功能/场景 | 目标用户 | 入口与输入 | 主要输出 | 实现状态 | 证据 |
| --- | --- | --- | --- | --- | --- |
| 会话花费 / 每轮费用 | DSH 使用者 | 输入框下方 `composer.dock` 花费格 | 人民币金额 + 悬停账单 | 已实现 | `lib/client.js` `CostPill`；`data-sym-cost*` |
| 上下文压缩统计 | 同上 | `composer.dock` 末格 | `压缩 N 次 · 丢失 X` | **已实现未生效** | `contextLossProjection`（host-v19）+ `ContextLossPill`；投影未落地（见 AUD-RUNTIME-001） |
| 账户余额 | 同上 | `conversation.input.right` | 余额文本 | 已实现 | `dshBalance_root`；需 `remote.<ns>` 条件注入 |
| 峰谷时段标记 | 同上 | 品牌行 `::after` | 高峰/空闲胶囊 | 已实现 | `installPeakTag`，纯 CSS 无接管 |
| Git 胶囊 + 分支切换 | 同上 | 会话头部 `header.utilities` | 分支/增删行/未跟踪 | 已实现 | `data-git-status`；`GET\|POST /api/sym.git` |
| 快捷按钮条 | 同上 | 侧栏右缝竖条 + 设置页 | 按钮/命令/技能一键 | 已实现 | `QuickActionsRail` / `QuickActionsSettings` |
| 复制会话 ID / 导出日志 | 同上 | 侧栏会话「⋯」菜单 | 剪贴板 / 日志文件 | 已实现 | CR-0003；`MenuItemButton` 复用 |
| `@` 引用回复 | 同上 | 助手回复操作行 | 引用标记 → 宿主展开 | 已实现 | `quoteMark` / `expandQuoteMarks` |
| 进程内存读数 | 同上 | `composer.dock` 花费格内 | `xxxM` | 已实现 | `data-sym-memory`；`readProcessMemory()` |

## 审计覆盖率

| 对象 | 分类 | 覆盖状态 | 证据方式 | 未覆盖原因 |
| --- | --- | --- | --- | --- |
| `lib/client.js` | 核心 | 已验证（静态+单测） | 逐段阅读 + 36 条单测 | 界面渲染需人工确认 |
| `lib/host-v19.js` | 核心 | 已验证（静态+单测） | 逐段阅读 + 46 条单测 + 2 条 e2e | 换名后未重载验证 |
| `test/*.mjs` | 支撑 | 已验证 | `npm test` 97/97 | — |
| `openspec/changes/CR-0001~0003` | 支撑 | 抽样 | 目录与 design/tasks 阅读 | 未跑 strict 校验（工具未确认安装） |
| `docs/05-audits/*` 历史报告 | 支撑 | 已验证 | 问题 ID 提取 + 当前状态复核 | — |
| `.project-architect.json` | 核心 | 已验证 | 逐字段阅读 | — |
| `scripts/reload-host.mjs` | 支撑 | 抽样 | `--dry-run` 与 `--apply` 实际执行 | — |

## 严重程度总览

| 问题 ID | 证据状态 | 优先级 | 严重程度 | 领域 | 问题 | 核心证据 |
| --- | --- | --- | --- | --- | --- | --- |
| AUD-FLOW-002 | 已验证 | P1 | S1 | 闭环 | 上下文压缩模块的八段闭环在"发布证据"段断裂（投影未落地） | `FM-0485BD1E` 对账表；79 个缓存中 `contextLoss` 命中 0 |
| AUD-RUNTIME-001 | 已验证 | P1 | S1 | 运行时 | 本轮新增的 `contextLoss` 投影**未在任何会话落地**，宿主重载与界面渲染均未完成验证 | 79 个投影缓存文件中 `contextLoss` 命中数 = **0** |
| AUD-SIZE-001 | 已验证 | P1 | S2 | 规模 | `lib/client.js` 3,594 LOC，距自定硬上限 3,700 仅剩 **106 行**，且**不能拆文件** | `wc -l` ；`.project-architect.json` `loc.hardCeiling` |
| AUD-GOV-001 | 已验证 | P1 | S2 | 治理 | 项目的硬规则（换名流程 / 客户端同步 / 投影 view 形状）**只存在于文档**，无脚本校验；本轮已证明它们会被违反 | 本轮 3 次误判（宿主 state 当 client view、忘记同步包副本、让用户按刷新键） |
| AUD-MOD-001 | 已验证 | P1 | S2 | 模块隔离 | `lib/client.js` 承担 **13 类职责**，是事实上的上帝文件；单文件改动即全量回归面 | 单一文件含 4 个插槽族 + 3 个面板 + 105 枚图标 + 命令桥 |
| AUD-QUAL-004 | 已验证 | P2 | S3 | 质量 | 渲染与插槽注册**只覆盖 2 个组件的冒烟测试**，其余 11 个格子无渲染守卫 | `test/client.test.mjs` 仅调用 `QuickActionsRail` / `QuickActionsSettings` / `ContextLossPill` |
| AUD-SUPPLY-001 | 已验证 | P2 | S3 | 供应链 | `dsh.bundle.patch` 声明存在，但**无发布产物与校验流程**可验证包完整性 | `package.json` `dsh.bundle.patch`；无 tarball/CI |
| AUD-DOC-003 | 已验证 | P2 | S3 | 文档 | 技能附件"不存在"的记载**与实际不符**（附件齐备且含 15 个可执行脚本），导致本轮差点跳过可用的校验工具 | `~/.dsh/skills/project-architect/` 实有 `scripts/`（15 个 .py）、`references/`（7 个）、`assets/` |

## 项目架构

### 当前结构

- 形态：**双半边插件**。宿主半边是 Node ESM 模块（`lib/host-v19.js`，1657 行），客户端半边是浏览器 module factory（`lib/client.js`，3594 行）；两者**不能共享模块**，跨端只靠常量拷贝 + 契约测试守卫。
- 分层：宿主折叠事件 → 投影（`sessionCost` / `contextLoss` / `quickActions`）→ 客户端 `useProjection(key)` 读取 → 渲染到官方插槽。另有一条**认证路由** `GET|POST /api/sym.git` 供 Git 读数与分支切换。
- 依赖方向：客户端 → 官方内部服务（`slots` / `locale` / `commandUi` / `sessions` / `remote.*` / `sessionLogDownload`），全部**条件注入 + 降级**；宿主 → Node 内置 + `ctx.sessionProjections` / `ctx.subprocess`。

### 关键链路

| 链路 | 入口 | 核心模块 | 数据/状态流 | 外部依赖 | 结论 |
| --- | --- | --- | --- | --- | --- |
| 计费读数 | `composer.dock` 花费格 | `sessionCostProjection` → `CostPill` | `assistant/message`(usage) → token 桶 → wire view（金额在 view 算） | 价目：CNY 表 / 厂商 catalog / `prices.json` | 已闭环 |
| 上下文损耗 | `composer.dock` 末格 | `contextLossProjection` → `ContextLossPill` | `compaction/summary`+`prune` → 计数与 shadowed token | 无 | 未验证（投影未落地） |
| Git 读数/切换 | 会话头部胶囊 | `createGitStatusReader` / `gitStatusRoute` | git status+diff → 投影载荷 → 胶囊；切换走 POST | 系统 git（argv 调用） | 已闭环（e2e 覆盖） |
| 快捷按钮 | 侧栏竖条 | `QuickActionsRail` + `commandBridge` | localStorage 配置 ↔ 竖条；命令走官方 pick 通道 | `commandUi` / `sessions`（内部服务） | 已闭环（含降级） |
| 引用回复 | 助手回复操作行 | `quoteMark` ↔ `expandQuoteMarks` | 客户端写标记 → 宿主展开为完整回复 | 无 | 已闭环（契约测试端到端） |
| 会话菜单两项 | 侧栏「⋯」 | `CopySessionIdMenuItem` / `ExportSessionMenuItem` | 剪贴板 / `sessionLogDownload` 服务 | 官方 primitives | 已闭环 |

### 模块边界与隔离

| 模块 | 独立文件/目录 | 公共接口 | 独立测试 | 跨模块依赖 | 修改爆炸半径 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| M-HOST | `lib/host-v19.js` | 3 个投影 + 路由 + 纯函数族 | 46 单测 + 2 e2e | 仅官方宿主服务 | 中（换名流程） | 边界清晰 |
| M-CLIENT | `lib/client.js` | 13 个 `data-sym-*` 钩子 | 36 单测 + 冒烟 | 6 个官方内部服务 | **高（改一处即全量）** | **上帝文件** |

## 技术路径与交付形态

- 技术路径：零依赖、无构建步骤；`react` / `react-dom` 用 `require` 取并包 try/catch；平台 schema 库（`@deepseek-ai/schemastery`）可选。
- 实现/壳形态：DSH 插件，靠 `~/.dsh/profiles/desktop/cordis.patch.yml` 的 `file://` 条目挂载工作副本（`sym-dev`）；包安装那条（`sym-cost`）当前 `disabled: true`。
- 构建与交付：无构建；宿主改动走 `scripts/reload-host.mjs` 换名 + 同步 19 处引用（本轮已执行 v18→v19）。

| 交付物 | 格式/载体 | 生成方式 | 安装/部署 | 签名/发布证据 | 结论 |
| --- | --- | --- | --- | --- | --- |
| 插件包 | GitHub 依赖 `github:seeseeczl/dsh-sym` | pnpm 安装 | profile `node_modules/dsh-sym` | CHANGELOG 1.7.0 对齐；**无 Release 产物核对** | 未验证 |
| 工作副本挂载 | `file://` + `cordis.patch.yml` | 手工/脚本 | App 重启后装配 | AGENTS.md 记载 | 已验证（本轮实地核对） |

## 平台支持

| 平台/版本 | CPU/运行环境 | 已声明 | 可构建 | 已测试 | 已发布 | 证据/限制 |
| --- | --- | --- | --- | --- | --- | --- |
| macOS（darwin） | Node >= 20 | 是 | 不适用（无构建） | 是（97 测试） | 未验证 | 本轮实测环境 |
| Windows | 同上 | 是（F12 快捷键分支） | 不适用 | 未验证 | 未验证 | 代码有 win32 分支但无实测 |
| Linux | 同上 | 未声明 | 不适用 | 未验证 | 未验证 | — |

## 上帝文件与模块隔离

### 文件行数门禁

- 门禁：以 `.project-architect.json` 的 `loc.hardCeiling` 为准（**M-HOST 1800 / M-CLIENT 3700**）。本轮**不采用**通用脚本的 250/400 阈值 —— 该阈值针对常规应用源码，与插件的"单文件双半边、不可拆分"约束冲突；按技能要求以项目事实源为准。
- 扫描范围：项目自有生产文件（`lib/`）；已排除 `node_modules`、`.git`、`docs`（文本类另行评估）。

| 文件 | 行数 | 门禁结果 | 核心链路 | 建议 | 问题 ID |
| --- | --- | --- | --- | --- | --- |
| `lib/client.js` | 3594 | **预警（余量 106 行）** | 是 | 下一功能前先就地压缩，或评估改为 HTTP bundle 形态以支持拆文件 | AUD-SIZE-001 |
| `lib/host-v19.js` | 1657 | 正常（余量 143 行） | 是 | 保持 | 不适用 |

### 上帝文件候选

| 文件或逻辑类型族 | 规模/职责 | 扇入/扇出或共享状态 | 修改/回归证据 | 结论 | 拆分边界 |
| --- | --- | --- | --- | --- | --- |
| `lib/client.js` | 3594 行 / **13 类职责**：4 个插槽族（花费、上下文损耗、Git、菜单）、3 个面板、105 枚图标 + 校正表、命令桥、光标归还、快捷键条、设置页、引用、余额、峰谷 | 被 97 条测试中的 36 条覆盖；每次改动触发全量回归 | 历史上因"改名漏改一处 `data-*`"导致整条竖条卸载（已补冒烟测试） | **已确认上帝文件**（但受平台约束不可拆） | 若转 HTTP bundle 形态，可按「插槽族 / 图标表 / 命令桥 / 设置页」四向拆 |

### 模块隔离风险

| 问题 ID | 功能 | 当前分布 | 耦合点 | 连带回归 | 建议边界 |
| --- | --- | --- | --- | --- | --- |
| AUD-MOD-001 | 13 类能力 | 全部在单文件 | 共享 `React` / `NS` 字典 / `noteDegrade` / `useDisplayOptions` | 改任一格都可能影响其余 | 见上表拆分边界（需先解决加载形态） |

## 项目成熟度

等级：`L0 缺失`、`L1 临时`、`L2 可重复`、`L3 标准化`、`L4 可度量`。

| 维度 | 等级 | 当前机制 | 证据 | 主要缺口 |
| --- | --- | --- | --- | --- |
| 构建 | 不适用 | 零依赖无构建 | `package.json` 无 build 脚本 | — |
| 测试 | **L3** | 97 条断言 / 5 个文件；含真机 e2e（临时仓库起真 git） | `npm test` 97/97 | 渲染仅 3 个组件冒烟；11 个格子无守卫 |
| E2E | **L2** | 仅 Git 链路有真机 e2e | `test/git-e2e.test.mjs` | 界面链路全无 e2e |
| UI 回归 | **L1** | 靠人工视觉确认 + `data-sym-*` 钩子 | 19 个 `data-sym-*`（历史 4 → 现 18） | 无截图基线、无自动断言 |
| CI | **L0** | 无 `.github/workflows` | 目录不存在 | 无自动门禁；`npm test` 靠人跑 |
| 发布回滚 | **L2** | CHANGELOG 版本规则 + 已发布条目不改写 | `CHANGELOG.md` 1.7.0 | 无产物校验、无回滚演练 |
| 文档 | **L3** | AGENTS.md（712 行）沉淀了大量实测结论；开源契约表 | `AGENTS.md`、`docs/01-architecture/` | 个别记载已过时（AUD-DOC-003） |
| 依赖 | **L4** | 零依赖、零 devDependencies | `package.json` | 无（风险已消除） |
| 可观测性 | **L2** | `noteDegrade` 统一降级日志（45 + 14 调用点，每来源一次、上限 40） | `lib/*.js` | 无结构化日志/指标；无 DevTools 入口 |
| 安全 | **L3** | 唯一写操作严格收窄（白名单 + argv + `--` + 独立超时）；不碰凭据 | `switchBranch` 实现 | 无密钥扫描/依赖审计（零依赖已大幅降低） |

- 总体成熟度与依据：**L2（可重复）**。以主链路最低等级判断 —— UI 回归 L1 与 CI L0 是两个拖后腿项；测试与文档已达 L3。

## 回归验证机制

| 检查项 | 当前机制 | 自动化/CI | 覆盖 | 证据 | 缺口 |
| --- | --- | --- | --- | --- | --- |
| 核心模块 | `node --test` 5 文件 | 自动化，**无 CI** | 纯函数 + 真机 git e2e | 97/97 | 渲染与插槽注册覆盖薄 |
| 跨模块链路 | 契约测试断言两端常量 + 标记端到端 | 自动化 | 6 个常量 | `test/contracts.test.mjs` 8 条 | 投影**字段形状**无守卫（本轮踩坑根因） |
| UI | `data-sym-*` + 渲染冒烟 | 手工 | 3 个组件 | `client.test.mjs` | 11 个格子无守卫 |
| 影响选测 | 无 | 无 | — | — | 每次全量跑 |
| 发布前回归 | AGENTS.md 约定 | 手工 | — | — | 无清单化脚本 |
| 失败留痕 | 测试输出 + `noteDegrade` | 部分 | — | — | 界面故障（组件返回 null）**不留痕**，本轮因此连错三版 |

## OpenSpec 规范管理

| 状态 | 结论 | 证据 |
| --- | --- | --- |
| 工具、项目配置、实际使用、规范一致性、strict 校验 | **部分**：项目内有 `openspec/`（`project.md` + 3 个 CR change 目录 + templates），CR-0001/0002/0003 结构完整；**未验证** 工具是否安装、未跑 strict 校验 | `openspec/changes/CR-0001-git-status-pill/{design,tasks}.md` 等 |

## CodeGraph 使用情况

| 状态 | 结论 | 证据 |
| --- | --- | --- |
| 安装、初始化、索引新鲜度、实际使用、更新机制 | **未发现证据**；按技能要求降级为 `rg`/`glob` 静态检索 | 项目内无 CodeGraph 配置或索引；本轮跨模块影响分析用 `grep` 完成 |

## 文档增量与变更留档

| 变更类型 | 载体/机制 | 增量历史 | 关联键 | 字段完整性 | 抽样证据与缺口 |
| --- | --- | --- | --- | --- | --- |
| 需求变更 | `openspec/changes/CR-*` | 有（3 个 CR） | CR 编号 | 完整（design + tasks） | 未跑 strict 校验 |
| 技术变更 | `docs/01-architecture/`（含 ADR-003） | 部分 | 文件名日期 | 完整 | 部分 ADR 未在事实源登记 |
| 文件修改记录 | Git（`main` @ `d85b1d4`，dirty 24 路径） | 有 | commit | 完整 | 工作区未提交，审计基于 dirty 状态 |
| 发布记录 | `CHANGELOG.md` | 有（1.7.0） | 版本号 | 完整 | 与 GitHub Release 未核对 |

## 功能模块闭环度

- 模块统计：发现数：9；已审计数：9；未覆盖数：0
- 清单校准：**脚本 `functional_modules` 返回 0 条**。原因：该采集器按常规应用目录结构（`src/`、显式模块目录）识别，本插件是"单目录 `lib/` + 双半边"形态，不匹配其启发式。已按技能要求**人工补充 9 个 FM** 并逐项对账；`FE-*` 同理（脚本给 1 条自动候选，人工校准为 11 条入口）。

| 模块 ID | 模块/能力 | 需求/入口 | 主路径/关键链路 | 数据/状态闭环 | 异常/恢复 | 日志/可观测性 | 回归/验收 | 发布证据 | 结论 | 问题 ID |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FM-E1E6C8DD | 会话计费与每轮费用 | 花费格 `data-sym-cost` | `assistant/message` → 桶 → view | 投影（只存 token，金额在 view 算） | 未结算时只关花费半边、保留内存 | `noteDegrade` 价目降级 | 单测 + 契约 | 运行中可见 | 已闭环 | 不适用 |
| FM-B625B303 | 进程内存读数 | 花费格内 `data-sym-memory` | `readProcessMemory()` | 随会话活动更新 | `process` 缺失返回 null | 无专属日志；以 `data-sym-memory` 钩子供验证脚本断言 | 单测 + 渲染冒烟 | 运行中可见 | 已闭环 | 不适用 |
| FM-0485BD1E | 上下文压缩统计 | 末格 `data-sym-context-loss` | `compaction/*` → 投影 → 格 | 投影（计数 + token） | 投影缺失返回 null | 无专属日志；以 `data-sym-context-loss` / `data-sym-context-lost-tokens` 钩子供断言 | 6 条宿主单测 + 渲染冒烟 + 契约 | 投影未落地（未重启） | 未验证 | AUD-FLOW-002 / AUD-RUNTIME-001 |
| FM-2501B27C | 账户余额 | `input.right` | `remote.<ns>` → 余额 | 服务托管配置 | 服务缺失则不注册 | `noteDegrade` | 单测 | 运行中可见 | 已闭环 | 不适用 |
| FM-4B260D44 | 峰谷时段标记 | 品牌行 `::after` | `isPeakTime(ms, holidays)` | 纯计算 + CSS 变量 | 未匹配则留空 | 无专属日志；以 `html[data-dsh-peak]` 属性供验证脚本断言 | 单测（含节假日边界） | 运行中可见 | 已闭环 | 不适用 |
| FM-693C6B1D | Git 读数与分支切换 | 头部胶囊 `data-git-status` | git status+diff → 路由 → 胶囊 | 读缓存 0.7s 合流；写后失效 | 非仓库 404、git 拒绝 409、超大 413 | `noteDegrade` | 46 单测 + **真机 e2e** | 运行中可见 | 已闭环 | 不适用 |
| FM-A7361DED | 快捷按钮条与设置页 | 侧栏竖条 + 设置页 | localStorage ↔ 竖条；命令走官方 pick | 浏览器本地存储 | 通道不可用则降级填草稿 | `noteDegrade` | 渲染冒烟 + 单测 | 运行中可见 | 已闭环 | 不适用 |
| FM-A65BDF8C | 复制会话 ID / 导出日志 | 侧栏「⋯」菜单 | 剪贴板 / `sessionLogDownload` | 无状态 | 服务缺失则不注册 | `noteDegrade` | 单测 | 运行中可见 | 已闭环 | 不适用 |
| FM-B3701962 | `@` 引用回复 | 助手操作行 | 客户端标记 ↔ 宿主展开 | 引用索引（上限 400） | 标记解析失败返回 null | `noteDegrade` | 契约端到端 | 运行中可见 | 已闭环 | 不适用 |

### 前端功能入口闭环

- 入口统计：发现数：12；已审计数：12；未覆盖数：0
- 清单校准：脚本仅识别出 1 条（`FE-62C8A5F38A`），因其按 Web 路由/表单启发式匹配，插件入口是**插槽注册**而非路由。人工按插槽清单补充 10 条。

| 入口 ID | 页面/入口与类型 | 条件/权限 | 目标/handler | 状态覆盖 | 返回/恢复 | 测试/运行证据 | 结论 | 问题 ID |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FE-CFE3979B | `composer.dock` 格（order 10） | 会话存在 | `CostPill` | 未结算/已结算 | 点击开面板 | 单测 | 已闭环 | 不适用 |
| FE-C28AEE36 | `composer.dock` 格（order 30） | 同上 | `ContextLossPill` | 未压缩/已压缩/投影缺失 | 无（纯读数） | 宿主单测 + 冒烟 | 未验证 | AUD-RUNTIME-001 |
| FE-0C91DC60 | `composer.dock` 格（order 20） | 同上 | 链接右键菜单 | 有/无路径 | 菜单关闭 | 单测 | 已闭环 | 不适用 |
| FE-4AD434B5 | `conversation.input.right`（order 20） | `remote.<ns>` 可用 | `createBalanceCell` | 无余额/有余额 | 无 | 单测 | 已闭环 | 不适用 |
| FE-CD4B8CE7 | 品牌行 CSS `::after` | 主题令牌在 | `installPeakTag` | 峰/谷 | 无 | 单测 | 已闭环 | 不适用 |
| FE-12082A50 | `header.utilities`（order −20） | 会话 cwd | `GitStatusCell` | 非仓库/干净/脏/切换中 | 分支菜单 | 真机 e2e | 已闭环 | 不适用 |
| FE-98C5B56A | `header.utilities`（order 30） | 配置有效 | `QuickActionsSlot` | 启用/禁用/空 | 设置页 | 冒烟 | 已闭环 | 不适用 |
| FE-74182F67 | `settings.plugins.tab`（order 20） | — | `QuickActionsSettingsTab` | 加载/保存/错误 | 草稿丢弃 | 冒烟 | 已闭环 | 不适用 |
| FE-DB4FD5AB | `settings.section`（order 60） | 无 locale 投影 | `QuickActionsSettingsSlot` | 同上 | 同上 | 冒烟 | 已闭环 | 不适用 |
| FE-EB747A4B | 侧栏会话「⋯」（order 900） | 会话存在 | `CopySessionIdMenuItem` | 成功/失败 | **成功才关菜单** | 单测 | 已闭环 | 不适用 |
| FE-F62A6032 | 侧栏会话「⋯」（order 901） | `sessionLogDownload` 可用 | `ExportSessionMenuItem` | 进行中/成功/失败 | 菜单关闭 | 单测 | 已闭环 | 不适用 |
| FE-62C8A5F38A | 脚本自动发现的 Web 入口候选（聚合容器） | 不适用 | 经人工核对为渲染器插槽容器的聚合候选，非独立用户入口，已校准排除 | 不适用 | 不适用 | 报告 §架构 插槽清单 | 不适用 | 不适用 |

## 交互流程与 UI

### Product Design 参与情况

| 检查项 | 结论 | 证据/限制 |
| --- | --- | --- |
| 历史参与证据、本次调用、当前截图、视觉结论等级 | **未发现证据 / 本次未调用 / 无截图** | 本轮为只读审计且无法操作 GUI；按技能要求**不宣称**视觉或无障碍合规。降级：以 asar 内官方 CSS 令牌与 `dsh-design-flow` 文档为参照 |

### 关键流程证据

| 步骤 | 用户目标/操作 | 截图或运行证据 | 健康度 | UX/可访问性问题 | 证据限制 |
| --- | --- | --- | --- | --- | --- |
| 01 | 查看会话花费 | **无截图** | 不可判定 | — | 无法操作 GUI |
| 02 | 查看上下文压缩次数 | **无截图** | **阻塞**（投影未落地） | — | AUD-RUNTIME-001 |
| 03 | 切换 Git 分支 | e2e 断言通过 | 良好（功能） | 无视觉证据 | 真机 e2e 覆盖逻辑；界面未看 |

### UI 检查

| 页面/区域 | 层级与清晰度 | 一致性/状态 | 响应式 | 键盘/焦点/语义 | 问题 ID |
| --- | --- | --- | --- | --- | --- |
| 输入框下方 dock | 复用官方形制（`.dshSym_pill` 照 `StatsPills`） | 覆盖 4 类状态 | 容器查询（Git 胶囊 3 档） | 31 处 aria/role/focus-visible | 不适用 |
| 侧栏竖条 | 20px 栅格对齐（含 105 枚图标校正表） | 悬停/焦点态 | — | `aria-label` 齐备 | 不适用 |
| 会话菜单 | **复用官方 `MenuItemButton`**（含发丝分隔线） | 成功/失败两态 | — | 官方键盘走查 | 不适用 |

## 专项工程审计

| 专项领域 | 状态 | 核心证据 | 主要风险/缺口 | 问题 ID |
| --- | --- | --- | --- | --- |
| 安全与隐私 | **已验证** | 唯一写操作 `switchBranch`：白名单校验 + argv 传参 + `--` + 独立超时 + 不用 `-f/--discard-changes/stash/reset`；不碰凭据、不调平台 API | 无（零依赖同时消除了供应链攻击面） | 不适用 |
| 性能与资源 | **推断** | 读缓存 0.7s 合流 + 分支清单 4s 复用 → 稳态约 2 条 git 命令/轮（~40ms）；渲染依赖 `viewCache` 不被击穿 | 未做真实性能采样；无法测启动开销 | 不适用 |
| 可观测性与运维 | **部分** | `noteDegrade` 统一出口（59 个调用点，每来源一次、上限 40）；宿主换名流程已脚本化 | **界面故障不留痕**（组件返回 null 与未注册不可分）；无结构化日志/指标 | AUD-GOV-001 |
| 依赖、供应链与许可证 | **已验证** | **零 dependencies / 零 devDependencies**；MIT；`engines: node>=20` | 无 mindep 风险；但发布产物完整性未验证 | AUD-SUPPLY-001 |
| API、数据兼容与迁移 | **部分** | 投影有 `stateVersion`（sessionCost 3 / contextLoss 1）；`viewSchema` 做兜底 parse | **投影 view 的字段形状无守卫**——本轮即因宿主 state ≠ client view 连错三版 | AUD-GOV-001 |
| 无障碍与国际化 | **部分** | 31 处 aria/role/focus-visible；中英双语字典（127 条中文词条）；`tr()` 在无 `t` 时回落中文 | 无对比度/键盘走查实测；无 RTL 支持 | AUD-A11Y-002（P2 以下，未单列） |
| 构建可复现与产物完整性 | **不适用/未验证** | 无构建步骤（零依赖）；无 tarball 产物可校验 | 包安装形态未验证 | AUD-SUPPLY-001 |

## 增量审计对比

- 基线报告：`docs/05-audits/2026-09-30-184612-project-audit-report.md`（标准模式，同项目同范围，可比性高）

| 分类 | 问题 ID | 基线 -> 当前 | 证据/说明 |
| --- | --- | --- | --- |
| **已解决** | AUD-FLOW-001 | 开放 → 关闭 | 无调用方的 `lib/move-session.js` 已从生产模块移除（基线 S1，见 ADR-003"会话移动未接线"） |
| **已解决** | AUD-ARCH-001 | 开放 → 关闭 | `test/contracts.test.mjs` 现有 13 条断言，守卫 6 个跨端常量并做"标记→展开"端到端验证 |
| **已解决** | AUD-OPS-001 | 开放 → 关闭 | `claimedSlotCells` 去重账本 + `registerSlotCell` 吞异常降级（`lib/client.js:3063,3379`） |
| **已解决** | AUD-QUAL-002 | 开放 → 关闭 | `noteDegrade` 统一出口，59 个调用点，每来源一次 |
| **改善** | AUD-QUAL-003 | S3 → 显著改善 | 稳定 `data-sym-*` 标记从 4 项增至 **18 项**（含本轮新增 2 项） |
| **未变化** | AUD-OPS-002 | S2 → S2（接受风险） | 幽灵模块仍需重启清理；属 DSH 平台约束，已写入流程文档 |
| **未变化** | AUD-DOC-001/002 | — | 文档沉淀持续（AGENTS.md 712 行），但**新增过时记载**（见 AUD-DOC-003） |
| **新增** | AUD-FLOW-002 | 不存在 → 开放 S1/P1 | 本轮新增模块的闭环在发布证据段断裂（与 AUD-FLOW-001 编号区分：后者是已解决的历史问题） |
| **新增** | AUD-RUNTIME-001 | — | 本轮新增能力尚未完成运行时验证 |
| **新增** | AUD-GOV-001 | — | 治理规则无脚本校验；本轮 3 次误判为直接证据 |
| **新增** | AUD-SIZE-001 | — | 客户端余量降至 106 行（基线时余量更宽） |
| **新增** | AUD-MOD-001 | — | 客户端职责扩至 13 类 |
| **新增** | AUD-QUAL-004 | — | 渲染守卫仅覆盖 3/14 组件 |
| **新增** | AUD-SUPPLY-001 / AUD-DOC-003 | — | 见问题详情 |

## 阻塞项

| 问题 ID | 阻塞内容 | 影响范围 | 证据 | 解除条件 |
| --- | --- | --- | --- | --- |
| AUD-BLOCK-001 | **无法自动验证界面渲染**：DSH 桌面版无刷新手段（`toggleDevTools` 两项 `visible:false`，F12 仅 win32），客户端改动必须重启 App 才能观察 | 所有 UI 类验收点 | asar 菜单定义；本轮 `contextLoss` 投影 79 个缓存文件命中 0 | 人工重启 App 后视觉确认；或改用 `pnpm run dev:web` 获得 bundle watcher |

## 潜在风险

| 问题 ID | 风险 | 触发条件 | 影响 | 概率 | 应对建议 |
| --- | --- | --- | --- | --- | --- |
| AUD-RISK-001 | 下一次客户端功能触顶 LOC 硬上限 | 新增任意客户端能力 | 无法合规落地，被迫先压缩或改加载形态 | **高** | 下一功能启动前先就地压缩；或立 CR 评估 HTTP bundle 形态 |
| AUD-RISK-002 | `pnpm install` 清掉包副本，界面回退到旧客户端 | 任何依赖安装 | 界面功能静默消失 | 中 | 已在 AGENTS.md 记载；建议做成脚本化检查 |
| AUD-RISK-003 | 投影 view 形状变更导致格子静默消失 | 官方升级 DSH | 读数不显示且无报错 | 中 | 增加 view 形状守卫（见任务书 P1-02） |

## 问题详情

### AUD-FLOW-002 上下文压缩模块的闭环链路在"发布证据"段断裂

- 状态：开放
- 证据状态：已验证
- 严重程度：S1
- 优先级：P1
- 影响范围：`FM-0485BD1E`（上下文压缩统计）—— 需求→入口→主路径→数据→异常→可观测→回归七段均在位，**唯独"发布证据"段断裂**：投影从未在任何真实会话落地
- 证据：`FM-0485BD1E` 的八段对账表；79 个投影缓存文件中 `contextLoss` 命中 0；`lib/host-v19.js` 已就位但未装配
- 根因判断：宿主模块不热重载，换名后必须"停用 → 启用"并重启 App 才能装载；本轮只完成了换名与引用同步
- 优化做法：执行装配与重启，并按唯一可靠判据（投影缓存出现 key）验证
- 技术路径：见任务书 P1.1
- 验收标准：`contextLoss` 在投影缓存命中 ≥ 1，且界面末格可见
- 验证方式：读投影缓存 + 人工看界面
- 回滚/降级：停用 `sym-dev` 即整块消失；组件缺席时返回 null，官方布局零影响

### AUD-RUNTIME-001 新增的上下文损耗投影尚未在运行时验证

- 状态：开放
- 证据状态：已验证
- 严重程度：S1
- 优先级：P1
- 影响范围：`FM-0485BD1E` / `FE-C28AEE36`；用户看不到压缩次数这一新读数
- 证据：79 个 `session_projcache/sessions/*.json` 中 `contextLoss` 命中数 = **0**；宿主已换名为 `lib/host-v19.js` 且 profile 引用已同步，但**未执行停用/启用、未重启 App**
- 根因判断：宿主代码不热重载（模块缓存钉住），换名只是第一步；必须**停用 → 启用**并重启才能装配新模块
- 优化做法：执行停用/启用 + 完全退出 App 重启；重启后按唯一可靠判据验证（投影缓存出现 `contextLoss` key）
- 技术路径：复用现有 `reload-host.mjs` 流程，无需新代码
- 验收标准：重启后任一活跃会话的投影缓存含 `contextLoss.val`，且界面 dock 末格显示「尚未压缩过上下文」或「压缩 N 次 · 丢失 X」
- 验证方式：`python3 -c` 读投影缓存断言 key 存在；人工看界面
- 回滚/降级：投影缺失时组件返回 null，官方布局不受影响（已验证的降级路径）

### AUD-GOV-001 治理硬规则只存在于文档，无脚本校验

- 状态：开放
- 证据状态：已验证
- 严重程度：S2
- 优先级：P1
- 影响范围：全部开发流程；本轮已造成 3 次实质误判
- 证据：本会话三次违规 —— ① 用宿主 state 形状写客户端代码（`tokenUsage.last` 不存在于 client view），连错 3 版；② 改完 `lib/client.js` 未同步 profile 包副本，用户看不到变化；③ 让用户"按 Cmd+R 刷新"（该按键在 macOS 无绑定）。三条都**写在 AGENTS.md 里**，但无任何脚本拦截
- 根因判断：规则以"人记住"为载体。DSH 插件有三处易错点（宿主换名、客户端双份、投影 view ≠ state），且失败模式**全部是静默的**（不报错、只表现为"没出现"）
- 优化做法：把三条规则转成可执行校验：① 投影 view 形状守卫（读 asar 或断言 view 函数字段）；② 客户端副本一致性检查；③ 流程清单脚本
- 技术路径：新增 `scripts/check-invariants.mjs`，纳入 `npm test` 或独立 `npm run check`
- 验收标准：三条校验可独立运行并在违反时**非零退出**
- 验证方式：故意制造违反（如改一处常量不同步），确认脚本报错
- 回滚/降级：新增脚本不影响现有 97 条测试；失败可单独移除

### AUD-SIZE-001 客户端单体逼近硬上限且不可拆分

- 状态：开放
- 证据状态：已验证
- 严重程度：S2
- 优先级：P1
- 影响范围：`M-CLIENT` 的所有后续演进
- 证据：`wc -l lib/client.js` = **3594**；`.project-architect.json` `M-CLIENT` hardCeiling = **3700**（余量 106 行）。历史上已因触顶三次上调阈值（3000→3300→3400→3700），文档明写"下一个客户端功能必须先就地压缩"
- 根因判断：客户端半边**不能拆文件** —— `file://` 挂载没有 `/??<id>/client.js&rev=` 形态的 bundle URL，`require.async` 的 chunk 解析必然失败（已查 `dsh-client-modules` 证实）
- 优化做法：两条并行 —— ① 短期：就地压缩（去冗余注释、合并重复模式），目标释放 ≥200 行；② 长期：立 CR 评估改为 HTTP bundle 包安装形态，从而获得拆文件能力
- 技术路径：短期纯文本压缩；长期需改 profile 挂载方式 + 包发布流程
- 验收标准：短期 —— `wc -l` ≤ 3400 且 97 条测试全绿；长期 —— 可拆为 4 个模块且功能无回归
- 验证方式：`npm test` + `wc -l`
- 回滚/降级：压缩是纯文本操作，git 可回退

### AUD-MOD-001 客户端为上帝文件，修改爆炸半径高

- 状态：接受风险
- 证据状态：已验证
- 严重程度：S2
- 优先级：P1
- 影响范围：任何客户端改动
- 证据：单一文件 3594 行含 13 类职责（4 插槽族、3 面板、105 枚图标 + 校正表、命令桥、光标归还、竖条、设置页、引用、余额、峰谷、i18n 127 词条、样式表）
- 根因判断：同 AUD-SIZE-001 的加载形态约束；历史上已因"改名漏改一处 `data-*`"导致整条竖条卸载
- 优化做法：与 AUD-SIZE-001 合并处理；在具备拆文件能力前，靠**渲染冒烟测试**扩大守卫面（见 AUD-QUAL-004）
- 技术路径：见 AUD-SIZE-001
- 验收标准：见 AUD-SIZE-001
- 验证方式：见 AUD-SIZE-001
- 回滚/降级：接受现状，以测试覆盖率补偿

### AUD-QUAL-004 渲染与插槽注册守卫仅覆盖 3 个组件

- 状态：开放
- 证据状态：已验证
- 严重程度：S3
- 优先级：P2
- 影响范围：11 个界面格子
- 证据：`test/client.test.mjs` 只调用了 `QuickActionsRail`、`QuickActionsSettings`、`ContextLossPill` 三个组件；`CostPill` / `BalanceCell` / `GitStatusCell` / `PeakTag` / 两个菜单项等**无渲染调用**
- 根因判断：渲染冒烟是"事后补课"式加入的（历史故障驱动），未系统铺开
- 优化做法：为 11 个入口各加一条最小渲染断言（造最小 props，断言不抛错且返回元素或 null）
- 技术路径：复用现有 `load-client.mjs` 替身，无需新依赖
- 验收标准：每个 `FE-*` 入口至少一条渲染断言；注入一处故意错误（如未定义变量）时测试变红
- 验证方式：`npm test`
- 回滚/降级：纯新增测试

### AUD-SUPPLY-001 发布产物完整性未验证

- 状态：开放
- 证据状态：未验证
- 严重程度：S3
- 优先级：P2
- 影响范围：包安装形态的用户
- 证据：`package.json` `dsh.bundle.patch` 指向 `./cordis.patch.yml`；`CHANGELOG` 1.7.0 与 `version` 一致；但无 tarball、无 CI、无哈希/签名核对
- 根因判断：项目以 `file://` 工作副本为主要开发形态，包发布是次要路径
- 优化做法：发布前增加一次 `npm pack` 产物核对（文件清单 + 入口可加载）
- 技术路径：`npm pack --dry-run` + 现有的 `files` 白名单
- 验收标准：包内含 `lib/client.js` / `lib/host-v19.js` / `prices.json` / `cordis.patch.yml`，且入口能 import
- 验证方式：解包后 `node -e "import(...)"`
- 回滚/降级：不适用（只读核对）

### AUD-DOC-003 技能附件"不存在"的记载与实际不符

- 状态：开放
- 证据状态：已验证
- 严重程度：S3
- 优先级：P2
- 影响范围：后续所有使用 project-architect 的会话
- 证据：`AGENTS.md` 记载"`project-architect` 等四个技能的附件（`references/` `scripts/` `assets/`）**不存在**，只有 `SKILL.md`；照方法论人工执行，**不要假装跑了校验脚本**"。实际 `/Users/long/.dsh/skills/project-architect/` 含 `scripts/`（15 个 .py）、`references/`（7 个 .md）、`assets/`（audit + blueprint 模板）、`tests/`
- 根因判断：该记载写于附件确实缺失的时期（skill 目录后来被补齐，时间戳 2026-08-05/10-12），未回访更新
- 优化做法：更正该条记载；同时在文档里登记可用的校验脚本入口（本报告即使用它们完成）
- 技术路径：文档修订
- 验收标准：AGENTS.md 不再声称附件不存在，且列出关键脚本用法
- 验证方式：人工复核
- 回滚/降级：纯文档修订，无运行时影响；如需撤销直接还原该段落即可。

## 验证记录

| 命令/检查 | 目的 | 结果摘要 | 是否通过 |
| --- | --- | --- | --- |
| `npm test` | 全量回归 | **97 tests / 97 pass / 0 fail**（551ms） | **是** |
| `python3 audit_project.py collect . --mode standard` | 证据采集 | 生成临时 JSON；88 文件索引，`truncated=false` | 是 |
| `python3 check_project_architecture.py --check-docs --check-kickoff --check-traceability --check-fitness --strict` | 架构校验 | 33 项 ERROR：2 条 LOC（口径差异，见门禁说明）、31 条治理文档缺失（模板规范与本项目既有约定不一致） | **否**（记为发现） |
| `node scripts/reload-host.mjs --dry-run` / `--apply` | 宿主换名 | `host-v18.js → host-v19.js`，同步 19 处引用含 profile `file://` | 是 |
| `node -e "import('./lib/host-v19.js')"` | 宿主模块可加载 | 导出 `CONTEXT_LOSS_KEY` / `contextLossProjection`，折叠结果正确 | 是 |
| `cmp` 工作副本 vs profile 包副本 | 双份一致性 | 逐字节一致（198,062 字节） | 是 |
| 投影缓存扫描（79 文件） | `contextLoss` 是否落地 | **命中 0** → AUD-RUNTIME-001 | 否（预期，未重启） |
| `audit_project.py validate <report> <tasks> --evidence` | **产物配对与内容契约校验** | `Audit outputs are valid` | **是** |
| `audit_project.py coverage <evidence> <report>` | **FM/FE 覆盖校验** | `Functional module and frontend entry coverage are valid`（9 FM / 12 FE） | **是** |
| `audit_project.py compare <baseline> <current>` | 增量分类 | 已解决 4 / 改善 1 / 未变化 2 / 新增 8 | 是 |

## 计划外发现

- **脚本阈值与本项目约定冲突**：通用校验脚本用 250/400 行阈值，会给两个生产文件都报 ERROR；按技能要求"所有阈值读取目标项目的 `.project-architect.json`"，本轮以项目 `hardCeiling`（1800/3700）为准，并将差异记入本报告而非直接采信。
- **技能目录已被补齐**：见 AUD-DOC-003。这直接改变了本次审计的执行方式（从"人工执行方法论"变为"实际运行校验脚本"）。
- **`lib/host-v18.js` 在本轮审计前刚被删除**（换名为 v19），工作区处于 dirty 状态；本次审计基于该 dirty 状态，已记录 commit 与变更路径数。

## 遗留问题

- 界面渲染与无障碍合规**未验证**（AUD-BLOCK-001），需人工重启 App 后确认。
- OpenSpec 工具的安装状态与 strict 校验**未验证**。
- CodeGraph **未安装**，跨模块影响分析以 `grep` 降级完成。
- 发布产物（tarball / GitHub Release）**未核对**。
