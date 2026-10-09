# dsh-sym 交付计划与任务书

> **上游依据**：`docs/01-architecture/project-architecture-and-requirements.md`（唯一依据）。
> 本文档中的每张任务卡都必须能追溯到该文档的 FR/NFR/ADR 编号。
>
> **校验状态**：⚠️ **人工对照，无脚本校验**。本技能的 `scripts/check_project_architecture.py`
> 与 `assets/audit/` 模板均不存在（见上游文档附录 B），所有门禁由人工核对。

- 建立日期：2026-09-30
- Profile：`core` + `ui` + `service`
- 基线版本：`1.0.0`
- 事实源：`.project-architect.json`（LOC 阈值、模块路径、公开契约、忽略项）

---

## 1. 里程碑

| 里程碑 | 目标 | 判定条件 | 状态 |
|---|---|---|---|
| **M0 治理基线** | 需求与技术路径落盘，后续变更可追溯 | 本文件与上游文档存在并被确认 | 本次建立 |
| **M1 可重复回归** | 回归从"临时脚本"变为仓库内可执行资产 | `package.json` 有 `test` 入口且能跑通全部断言 | **已达成（2026-09-30）**：`npm test` 31 个断言全绿，见 T-03~T-05 |
| **M2 变更流程固化** | 宿主改动、价目更新、版本发布都有成文步骤 | 项目级 `AGENTS.md` 与 `CONTRIBUTING.md` 存在 | 待办（T-01/T-02/T-06） |
| **M3 年度可维护** | 节假日表与价目有明确的年度更新路径 | 2027 年节假日更新步骤成文且有校验 | 待办（T-07/T-09） |

---

## 2. 质量门禁（适用于每一张任务卡）

- **门禁 1**：涉及客户端逻辑的改动必须附带**可复现验证**，且该验证在 M1 完成后必须是仓库内资产。
- **门禁 2**：涉及宿主的改动必须在**真实运行环境**验证（不能只跑单测）。
- **门禁 3**：公开契约（见 `.project-architect.json` 的 `contracts`）变更必须先立 CR，同步两端。
- **门禁 4**：单卡至多改 5 个生产文件、净新增至多 300 行；超出则先拆卡。
- **门禁 5**：任何模块 LOC 超过 `loc.hardCeiling` 时，必须先拆分再继续。
- **门禁 6**：任务完成后回写本节"时间线"与上游文档的追溯表。

### 2.1 允许路径 / 禁止路径（全局）

- **允许**：`lib/**`、`docs/**`、`assets/**`、`package.json`、`cordis.patch.yml`、根目录 Markdown。
- **禁止**：`/Applications/DeepSeek Harness.app/**`（DSH 安装目录，不得修改）；用户凭据与 `.credentials*`；`~/.dsh/sessions/**` 的会话数据（只读除外）。
- **需授权**：`~/.dsh/profiles/desktop/cordis.patch.yml`（profile 级配置，改动影响本机运行）。

---

## 3. 原子任务卡（12 张）

### T-01 项目级 AGENTS.md

- **输入**：上游 §6 模块边界、§7 质量约束、附录 A（已排除路径）
- **依赖**：无
- **主要模块**：根目录文档
- **产物**：`AGENTS.md` —— 面向后续会话的治理约定
- **内容要求**：宿主改动流程（换文件名）、公开契约不可擅改、加法插槽优先、验证要求、插件边界**已证实结论**（避免后续会话重复投入附录 A 的死路）
- **验收**：文件存在且包含上述五项；不复制用户级 `~/.dsh/AGENTS.md` 的内容
- **命令**：`test -f AGENTS.md && grep -c "换文件名\|契约\|插槽" AGENTS.md`
- **预期**：文件存在，关键条目命中
- **停止条件**：发现与用户级 AGENTS.md 冲突的约定 → 停下询问
- **回滚**：删除该文件（无其他依赖）
- **时间线**：待回写

### T-02 CONTRIBUTING.md

- **输入**：上游 §7、`.project-architect.json` 的 `changeProcedure`
- **依赖**：T-01
- **主要模块**：根目录文档
- **产物**：`CONTRIBUTING.md` —— 贡献者需知的流程
- **内容要求**：改动前读哪份文档、如何验证、宿主改动为何要换文件名、价目覆盖的提交流程、不接受的改动类型
- **验收**：文件存在，且"宿主改动流程"一节与 T-01 表述一致
- **命令**：`test -f CONTRIBUTING.md && grep -c "换文件名" CONTRIBUTING.md`
- **预期**：命中 ≥1
- **停止条件**：两处表述不一致 → 以 `.project-architect.json` 的 `changeProcedure` 为准
- **回滚**：删除文件
- **时间线**：待回写

### T-03 把回归断言搬进仓库（第一步：宿主折叠）

- **输入**：上游 §8.2 追溯表（FR-05/FR-06）；现存 `/tmp/costtest/test6.mjs`、`save.mjs`
- **依赖**：无
- **主要模块**：新增 `test/host.test.mjs`
- **产物**：仓库内可执行的宿主侧断言（展开逻辑 + 缓存/谷时省钱边界）
- **允许路径**：`test/**`、`package.json`
- **禁止路径**：`lib/**`（本卡只搬运不改行为）
- **验收**：`node --test test/host.test.mjs` 全绿；断言数量 ≥ 现存的 6 例
- **命令**：`node --test test/host.test.mjs`
- **预期**：通过数 ≥ 6，失败 0
- **停止条件**：搬运过程中发现断言依赖 `/tmp` 中的外部文件 → 一并内联，不得留外部依赖
- **回滚**：删除 `test/`（本卡不触发运行时行为）
- **时间线**：**2026-09-30 完成**。`test/host.test.mjs`：`npm test` 全绿，其中该文件 18 例
  （峰时边界、周末/节假日、引用展开、未知 id、索引淘汰、价目常量、内存读数、失败路径 5 例）。
  另见 ADV-P1-01/ADV-P1-02（对抗审计的失败路径与测试助手整改，同批完成）。

### T-04 把回归断言搬进仓库（第二步：客户端账单文本）

- **输入**：FR-01/FR-06/FR-07
- **依赖**：T-03
- **主要模块**：新增 `test/client.test.mjs`
- **产物**：`describeScope` 的账单文本断言（缓存省下、谷时省下、峰谷拆分、未知模型、非峰谷定价厂商）
- **验收**：`node --test` 全绿；覆盖上游 §3.1 中 FR-06/FR-07 的全部验收点
- **命令**：`node --test`
- **预期**：与 T-03 合并后全部通过
- **停止条件**：需要 DOM 才能断言 → 用最小 hooks 替身，不引入 jsdom 依赖
- **回滚**：删除该测试文件
- **时间线**：**2026-09-30 完成**。`test/client.test.mjs`：9 例，覆盖峰谷混合、非峰谷定价厂商、
  未收录模型、scope 缺字段、两次加载独立、`formatCny`，以及 ADV-P1-03 的插槽幂等与降级日志。
  用 `test/helpers/load-client.mjs` 的替身物化模块，**未引入 jsdom**。

### T-05 package.json 增加 test 入口

- **输入**：T-03、T-04
- **依赖**：T-03、T-04
- **主要模块**：`package.json`
- **产物**：`"scripts": { "test": "node --test" }`
- **验收**：`npm test`（或 `pnpm test`）零失败；**不新增任何依赖**
- **命令**：`npm test`
- **预期**：全部断言通过
- **停止条件**：`node --test` 在 `engines: >=20` 上行为不一致 → 改为显式文件列表
- **回滚**：移除 scripts 字段
- **时间线**：**2026-09-30 完成**。`package.json` 增加 `"scripts": { "test": "node --test" }`，
  **零依赖**。停止条件已触发一次：`node --test test/` 在 Node 24 下把目录当模块解析而失败，
  裸 `node --test` 正常——这一条已写进项目 `AGENTS.md` 的验证要求，避免后人再踩。

### T-06 版本与变更记录

- **输入**：上游 §1.3
- **依赖**：无
- **主要模块**：`package.json`、新增 `CHANGELOG.md`
- **产物**：`CHANGELOG.md`（Keep a Changelog 风格）+ 版本号与 Release tag 的对应规则
- **验收**：`CHANGELOG.md` 首条对应 `v1.0.0`，内容与 GitHub Release 说明一致
- **命令**：`head -20 CHANGELOG.md; grep '"version"' package.json`
- **预期**：版本一致
- **停止条件**：发现历史 tag 与 package.json 版本不符 → 记录差异，不擅自改历史
- **回滚**：删除文件并还原版本号
- **时间线**：**2026-09-30 完成（随 1.1.0 发布）**。新增 `CHANGELOG.md`（Keep a Changelog 风格），
  含 `[1.1.0]` 与 `[1.0.0]` 两条；1.0.0 条目的功能清单与 GitHub Release `v1.0.0` 的说明一致。
  同时把版本引用一处不漏地跟着改：`package.json` 的 `version` 与 `files`（加入 CHANGELOG.md）、
  `README.md`/`PUBLISHING.md` 的 tgz 示例、`docs/01-architecture` 的当前版本、`openspec/project.md`。
  **验收口径修正**：原写"首条对应 v1.0.0"，实际应为"首条对应当前最新发布"，否则每次发版都要改验收标准。
  **2026-09-30 再次发布（1.2.0）**：`CHANGELOG.md` 新增 `[1.2.0]` 条目，四段（新增 / 改进 /
  修复 / 移除）覆盖 v1.1.0 之后的 95 个提交；版本引用按上面同一份清单同步，并顺手更正了
  `PUBLISHING.md` 里两处过时数字（手动挂载示例的文件名 `host-v3.js` → `host-v12.js`，
  `files` 清单 6 个 → 19 个、tgz 约 200 KB → 约 240 KB）。
  **2026-10-01 发布（1.3.0）**：`CHANGELOG.md` 新增 `[1.3.0]`（变更 / 修复两段），主线是余额格
  改挂 `conversation.input.right`（模型选择器正左边）并删掉那条重排官方侧栏 footer 的静态规则；
  版本引用按上面同一份清单同步（`package.json` / `README.md` / `PUBLISHING.md` /
  `docs/01-architecture` / `openspec/project.md`）。
  **2026-10-02 修复发布（1.3.1）**：`CHANGELOG.md` 新增 `[1.3.1]`（修复两段）—— 计费组件
  `CostPill` 在新会话第一轮进行中不再连坐内存读数（并修掉一个条件 hook），竖条背景改回官方
  弹层配方以适配浅色主题；版本引用按上面同一份清单同步。

### T-07 节假日表外置与年度更新路径

- **输入**：FR-04、NFR-04；上游 §6.3（`holidays` 为公开契约）
- **依赖**：无
- **主要模块**：`lib/host-v18.js`（**高代价模块**）、`lib/prices.json`
- **现状问题**：节假日同时存在于宿主常量 `DEFAULT_HOLIDAYS` 与 `prices.json`，**两处需同步**
- **产物**：二者以 `prices.json` 为唯一事实源；宿主常量仅作兜底
- **验收**：改 `prices.json` 后峰谷判定随之变化（用伪造时钟验证 2027 年某日）
- **命令**：改 `prices.json` 加入一条假日 → 伪造时钟实测；再还原
- **预期**：标记按新表翻转
- **停止条件**：发现二者语义不同（例如一处按 UTC 一处按北京时） → 停下出具 CR
- **回滚**：还原两处改动（**本卡必须走宿主换文件名流程**）
- **时间线**：待回写

### T-08 决策：`lib/move-session.js` 的去留

- **输入**：ADR-003、附录 A、接口边界
- **依赖**：无
- **主要模块**：`lib/move-session.js`、`README.md`
- **背景**：该模块功能完整、已用真实数据副本验证，但**无调用方**，且阻塞原因是架构性的
- **产物**：二选一并记录 ADR —— (a) 移入 `docs/` 作为设计记录并删除代码；(b) 保留但在 README 明确标注未接通
- **验收**：README 中**不得**把它列为已交付能力；`.project-architect.json` 的 `M-MOVE.kind` 与实际一致
- **命令**：`grep -c "move-session\|会话移动" README.md`
- **预期**：表述与决策一致
- **停止条件**：发现可用的现成 Remote 通道 → 立即中止本卡并出具新 ADR（此前的排除结论需重审）
- **回滚**：本卡为文档与文件位置调整，按记录反向操作
- **时间线**：**2026-09-30 完成，取方案 (a)**。`lib/move-session.js`（86 行）已删除，
  原始实现（未改动）完整移入新增的 `docs/01-architecture/adr-003-session-move-not-wired.md`，
  连同三处一致的改动点、执行顺序、路径编码与「zstd 多 frame」两个坑。
  `.project-architect.json` 移除 `M-MOVE` 并新增 `archivedModules` 记录去向，生产代码
  2371 行（原 2457）；README 的「已知限制」明确写出**没有**这个功能，避免被当成已交付能力。

### T-09 内存读数的更新时机说明与改进评估

- **输入**：FR-08、NFR-06；上游 §5.2
- **依赖**：无
- **主要模块**：`lib/client.js`、`README.md`
- **现状**：内存值随**会话活动**更新（受 `viewCache` 约束），空闲时不刷新
- **产物**：README 说明 + 一份可行性结论：是否值得为"空闲时也刷新"付出代价
- **约束**：**不得**为了让数字实时而破坏 `view` 的引用稳定性（会导致无限重渲染，见 §5.2）
- **验收**：结论有明确取舍说明；若判定不改，则文档中写清"空闲时不更新"这一已知行为
- **命令**：`grep -A3 "随.*会话活动\|空闲" README.md`
- **预期**：说明存在
- **停止条件**：发现客户端可独立获取宿主内存的途径 → 推翻 ADR-003 的相关结论并复审
- **回滚**：仅文档改动，直接还原
- **时间线**：待回写

### T-10 README 与本基线的交叉引用

- **输入**：上游全文
- **依赖**：T-01、T-02
- **主要模块**：`README.md`
- **产物**：README 顶部或末尾加入"架构与治理"一节，指向 `docs/01-architecture/...` 与本文件
- **验收**：README 中出现两处有效相对链接；链接目标存在
- **命令**：`grep -o "docs/[a-z0-9/-]*\.md" README.md | while read f; do test -f "$f" || echo "断链: $f"; done`
- **预期**：无断链输出
- **停止条件**：README 结构改动会破坏既有锚点 → 改为追加末尾
- **回滚**：还原 README
- **时间线**：待回写

### T-11 宿主改动的换文件名流程脚本化

- **输入**：上游 §6.1、`.project-architect.json` 的 `changeProcedure`
- **依赖**：T-01
- **主要模块**：新增 `scripts/reload-host.mjs`
- **背景**：该流程（停用 → 换名 → 同步两处引用 → 启用）在本次会话中手工执行多次，且**每次都会在宿主内存里留下旧模块注册**
- **产物**：一个脚本，自动完成换名与三处引用同步，并打印"下次重启可清理残留"的提醒
- **验收**：脚本在干净工作区执行后 `git diff` 只涉及预期文件；**不自动执行**停用/启用（那需要 DSH 参与）
- **命令**：`node scripts/reload-host.mjs --dry-run`
- **预期**：打印将要改动的文件与行
- **停止条件**：脚本需要调用 DSH 内部 API → 降级为"只做文件改名与引用同步"
- **回滚**：删除脚本
- **时间线**：**2026-09-30 完成**。`scripts/reload-host.mjs`：默认 dry-run，`--apply` 才写盘；
  自动找出当前入口（读 `package.json` 的 `main`，不猜文件名），换名并同步所有引用
  （本次实测覆盖 11 个文件，含仓库外的 profile `cordis.patch.yml`）；
  **历史审计产物不改写**（`docs/05-audits/`、`adversarial-audits/`，保住证据链）；
  不调用任何 DSH 内部 API，停用/启用与重启仍由人完成，脚本末尾会打印这三步。

### T-12 价目表的年度复核

- **输入**：上游 §5.1（三级价目来源）、`.project-architect.json` 的 `tierPricing`
- **依赖**：无
- **主要模块**：`lib/prices.json`、`docs/`
- **产物**：一份年度复核清单 —— DeepSeek 官方价、谷时倍数、节假日表、汇率
- **验收**：清单中每一项都写明**核对来源**与**改动后如何验证**
- **命令**：`grep -c "DeepSeek 官方价\|谷时\|节假日\|汇率" docs/**/*.md`
- **预期**：四项均有
- **停止条件**：发现官方调价且与当前表不符 → **立即出具 CR**，不得静默改数
- **回滚**：删除清单文档
- **时间线**：待回写

---

### T-13 补齐 project-architect 的 references —— **部分完成（2/8，其余超出本次确认范围）**

- **输入**：`SKILL.md` 第 27、91 行的引用清单；上游文档附录 B
- **依赖**：无
- **主要模块**：skill 目录（**非本项目仓库**）
- **产物**：`references/{kickoff-and-architecture,governance-and-traceability,module-quality-and-regression,security-operations-and-release,toolchain-and-ui,audit-workflow,audit-checklists}.md`
- **背景**：官方 `openai/skills` 仓库的 39 个 curated skill **不含**这四个（已核实），故无原版可拉取，只能按其正文方法论重新撰写
- **验收**：每份文件存在，且正文里每一处 `references/xxx.md` 引用都能解析到真实文件
- **命令**：`cd ~/.agents/skills/project-architect && for f in $(grep -o "references/[a-z-]*\.md" SKILL.md | sort -u); do test -f "$f" || echo "断链: $f"; done`
- **预期**：无断链输出
- **停止条件**：发现正文某处引用的规范与前文自相矛盾 → 停下出 CR，不擅自取舍
- **回滚**：删除新增的 references 目录
- **时间线**：待回写

### T-14 补齐 adversarial-audit 与 first-principles 的 references —— **已完成**

- **输入**：两个 `SKILL.md` 的引用清单
- **依赖**：无
- **主要模块**：skill 目录（**非本项目仓库**）
- **产物**：`adversarial-audit/references/{attack-playbook,audit-report-template}.md`、两者共用的 `optimization-plan-template.md`
- **验收**：两处 `references/optimization-plan-template.md` 引用均可解析；两份模板的字段与各自 `SKILL.md` 的"强制落盘"要求一一对应
- **命令**：`for d in adversarial-audit first-principles; do cd ~/.agents/skills/$d; for f in $(grep -o "references/[a-z-]*\.md" SKILL.md | sort -u); do test -f "$f" || echo "断链 $d: $f"; done; done`
- **预期**：无断链输出
- **停止条件**：共用模板在两处的字段要求冲突 → 停下出 CR
- **回滚**：删除新增文件
- **时间线**：待回写

### T-15 补齐 personal-knowledge-base 的 references —— **已完成**

- **输入**：`SKILL.md`（281 行）的引用清单
- **依赖**：无
- **主要模块**：skill 目录（**非本项目仓库**）
- **产物**：`references/knowledge-base-map.md` —— 知识库的地图/索引约定
- **验收**：文件存在且与正文提到的 7 处"模板"要求一致
- **命令**：`test -f ~/.agents/skills/personal-knowledge-base/references/knowledge-base-map.md && grep -c "" ~/.agents/skills/personal-knowledge-base/references/knowledge-base-map.md`
- **预期**：行数 > 0
- **停止条件**：发现该 skill 依赖 Obsidian 的特定目录约定 → 先向用户确认库根路径
- **回滚**：删除该文件
- **时间线**：待回写

### T-16 openspec CLI 的可用性确认

- **输入**：`openspec/project.md` 的工具登记表
- **依赖**：无
- **主要模块**：文档
- **背景**：`openspec` CLI 不在 PATH，但 `~/.config/openspec/config.json` 存在（历史使用痕迹）。若 CLI 可安装，则校验可从人工升级为命令
- **产物**：一份结论 —— 安装来源、命令形态，或明确记录"维持人工比对"
- **验收**：结论中写明**真实尝试过的命令**与输出；不得只写推测
- **命令**：`command -v openspec; ls ~/.config/openspec`
- **预期**：有明确结论
- **停止条件**：需要联网安装且来源不明 → 停下来问用户，不擅自装
- **回滚**：仅文档改动
- **时间线**：待回写


## 4. 风险登记

| ID | 风险 | 影响 | 缓解 |
|---|---|---|---|
| R-01 | 无仓库内回归，改动易引入静默回归 | 高 | T-03~T-05（M1 里程碑） |
| R-02 | 宿主改动留下的旧模块注册累积，可能导致注册冲突 | 中 | 重启 App 清理；T-11 脚本提示 |
| R-03 | 插件插槽契约变化导致注册失效（A-1） | 中 | 各能力独立注册，单点失效不连累其他（NFR-07） |
| R-04 | 节假日表两处不同步（T-07 的现状） | 中 | T-07 |
| R-05 | 价目或汇率长期未复核导致计费偏差 | 中 | T-12 |
| R-06 | `view` 缓存被不当绕过导致无限重渲染 | 高 | §5.2 的硬约束；已在 `.project-architect.json` 记录 |
| R-07 | 技能附件缺失，无机器校验背书 | 中 | 人工对照；本文件与上游文档均显式标注 |
| R-08 | 四个 skill 共有 6+11 处附件引用无法解析，任何依赖它们的会话都会中途卡住 | 中 | T-13~T-15 |
| R-09 | `openspec` / `codegraph` CLI 均不可用，治理只能人工执行 | 中 | 已走 `rg` 降级并实测；T-16 |

---

## 4.1 技能附件补齐结果（2026-09-30）

四个 skill 共 11 处附件引用，处理结果：

| skill | 引用数 | 已补 | 备注 |
|---|---|---|---|
| `project-architect` | 11 | 2 | 用户确认只补"启动"与"审计流程"两份最关键的 |
| `adversarial-audit` | 3 | 3 | 其中 `optimization-plan-template.md` 与 first-principles **软链接共用**，避免日后分叉 |
| `first-principles` | 2 | 2 | |
| `personal-knowledge-base` | 1 | 1 | 内容依据 Obsidian 知识库的**真实目录结构**写成，非虚构 |

**验证方式**（人工，无脚本）：逐个 skill 用
`grep -o "\(references\|scripts\|assets\)/[A-Za-z0-9._/-]*\.\(md\|py\)" SKILL.md`
提取引用后逐条 `test -r`，三个 skill 已无断链。

**未补部分的处置**：`project-architect` 剩余 6 份 references 与 3 个 scripts **在本任务书中保持未完成状态**，
其"无脚本校验"的后果已在 `SKILL.md` 对应的产物中如实标注。

## 4.2 会话交接（2026-09-30 中断记录）

**中断原因**：本次会话上下文耗尽，后期出现输出退化——重复声明"要做什么"但未实际执行，
并有一次**完全没有回复**（用户问"为什么上面显示已完成、下面任务卡还在跑"）。
这不是代码问题，是执行该会话的模型上下文到顶。

**中断时的真实状态**：

| 项 | 状态 |
|---|---|
| P0-01 建 `test/` + `npm test` | ✅ 完成（12 断言通过，零依赖） |
| P0-02 宿主断言搬进仓库 | ✅ 完成 |
| P0-03 处置 `move-session.js` | ✅ 完成（2026-09-30，方案 a：移入设计记录） |
| P1-01 ~ P2-03（共 8 项） | 见下方"第二轮接续"的逐项结果 |
| ADV-P0-01 接口契约写进 AGENTS.md | ✅ 完成 |
| ADV-P1-01 / P1-02 / P1-03 / P2-01 | ✅ 全部完成 |

**第二轮接续（2026-09-30 晚，新会话）逐项结果**：

| 项 | 状态 |
|---|---|
| ADV-P2-01 无效标记不再拷贝整批 | ✅ 完成（`expandQuoteText` 只在成功替换时算改动） |
| ADV-P1-01 失败路径断言 / ADV-P1-02 测试助手不污染全局 | ✅ 完成 |
| ADV-P1-03 插槽注册幂等 | ✅ 完成（`registerSlotCell`：重复跳过；注册表拒绝时记录并继续） |
| P1-01 客户端账单断言 | ✅ 完成（`test/client.test.mjs`，9 例，无 jsdom） |
| P1-02 跨端契约单一事实源 | ✅ 完成（两端常量 + `test/contracts.test.mjs` 守卫，含端到端用例） |
| P1-04 宿主换名脚本 | ✅ 完成（`scripts/reload-host.mjs`，默认 dry-run） |
| P2-01 空 catch 统一日志出口 | ✅ 完成（两端 `noteDegrade`，每个来源只记一条） |
| P2-02 五项能力补可观测标记 | ✅ 完成（`data-sym-quote` / `-tier-spend` / `-cache-saved` / `-offpeak-saved` / `-would-have-cost` / `-move-nudge`） |
| P2-03 补 project-architect 附件 | ⏸ 用户明确决定**不做**：维持"照方法论人工执行，不假装跑了脚本" |
| 回归总数 | `npm test` **31 个断言全绿**，零依赖 |

> 注意：宿主侧改动（ADV-P2-01、P2-01 的宿主那一半）**只在源码里**。宿主代码不热重载，
> 必须换文件名 + 停用/启用插件 + 重启 App 才会真正生效并得到运行环境验证。

**宿主换名与运行环境验证（2026-09-30 晚，同一会话）**：

| 步骤 | 结果 |
|---|---|
| 换名 | `node scripts/reload-host.mjs --apply`：`lib/host-v6.js` → `lib/host-v12.js`，同步 11 个文件（含仓库外的 profile `cordis.patch.yml`）；`npm test` 31 例仍全绿 |
| 补丁重载 | HMR 已重新组合 profile：`include:sym-cost` 的 moduleName 为 `file:///…/lib/host-v12.js`，`fiberPhase = active` |
| 插槽实证（client Slots inspect，真实页面） | `conversation.composer.dock`：`sym-cost`(10)、`link-menu`(20) 与官方 `stats` 并存，均 active<br>`conversation.chat.assistant-actions`：`quote-reference`(20)、`turn-cost`(30) 与官方 `feedback` 并存，均 active<br>`conversation.input.right`：`account-balance`(20)（同日余额格改动后从 `sidebar.footer.action`(10) 迁来） |
| **尚未验证** | 状态栏两个金额与账户余额的**实际数值**、品牌行峰谷标记、`@` 引用展开、花费面板内的新 `data-sym-*` 标记——需要人眼看界面；且旧模块仍留在宿主内存，**重启 App 后才算完整验证**（AUD-OPS-002） |

回滚方式（若重启后异常）：`git revert 0d1fd9a` 会把入口名与全部引用还原为 `host-v6.js`，
再按同样流程换名/重启；或在补丁里把 `sym-cost` 条目改回旧文件名。

**接续方式**：新会话直接读本文件与 `docs/05-audits/2026-09-30-184612-*`、
`adversarial-audits/2026-09-30-185044-*` 三份产物即可，**不需要读旧对话**。

## 5. 审计计划

- **下次审计**：M1 里程碑达成后（T-03~T-05 完成）。
- **审计模式**：标准审计（含架构、质量、交付三个维度）。
- **产物**（按 SKILL.md）：`docs/05-audits/YYYY-MM-DD-HHMMSS-project-audit-report.md` 与
  `docs/05-audits/YYYY-MM-DD-HHMMSS-optimization-tasks.md`，同一时间戳，永不覆盖历史。
- **限制**：技能的 `scripts/audit_project.py` 不存在，**审计的采证与对账由人工完成**，
  报告中必须标注证据等级（`已验证` / `推断` / `未验证`）。
- **重点**：R-01（回归缺失）与 R-06（重渲染风险）。

---

## 6. 时间线（完成后回写）

| 日期 | 任务卡 | 事件 |
|---|---|---|
| 2026-09-30 | —— | 治理基线建立（上游文档 + 本文件 + `.project-architect.json`） |
| 2026-09-30 | —— | 接通 OpenSpec（`openspec/`）；补审计模板（`assets/audit/`）；CodeGraph 走 `rg` 降级 |
| 2026-09-30 | T-14 | ✅ 完成：`attack-playbook.md`、`audit-report-template.md`、`optimization-plan-template.md`（与 first-principles 软链接共用） |
| 2026-09-30 | T-15 | ✅ 完成：`knowledge-base-map.md`（依据 Obsidian 实际结构写成） |
| 2026-09-30 | —— | 深度审计产出：`docs/05-audits/2026-09-30-184612-*`（145 + 230 行，10 张卡） |
| 2026-09-30 | P0-01/P0-02 | ✅ 完成：`test/` + `npm test` 入口，12 个断言全通过，零新依赖 |
| 2026-09-30 | —— | 对抗性审计产出：`adversarial-audits/2026-09-30-185044-*`（92 + 122 行，5 张卡 ADV-*） |
| 2026-09-30 | ADV-* | 🟡 开始执行 5 张 ADV 卡，**仅完成签名采集即中止**——会话上下文耗尽 |
| 2026-09-30 | T-13 | 🟡 部分完成 2/8：`kickoff-and-architecture.md`、`audit-workflow.md`；其余 6 处经用户确认超出本次范围 |
| 2026-10-04 | —— | dsh-design 四角色设计审计产出（视觉／交互／动效／产品）：[审计报告](../05-audits/2026-10-04-222628-design-audit-report.md) + [优化计划书](../05-audits/2026-10-04-222628-design-optimization-tasks.md)；判为 **blocked**（14 结构性 / 18 打磨），证据目录 `docs/05-audits/evidence-2026-10-04/` |
| 2026-10-04 | —— | 审计整改**第一批**落地并发布 **1.4.0**：S-1／S-11／S-12／S-13／S-14 + 「保存」按钮配色（改前 → 改后实测见 [CHANGELOG](../../CHANGELOG.md) 的 `[1.4.0]`）；其余待拍板项留在优化计划书 |
| 2026-10-05 | —— | 快捷按钮**加回官方命令**并发布 **1.5.0**：官方菜单 pick 通道（`commandUi.dispatch` + `submit`/claim）、竖条与设置页三类分组、图标统一配色与放大、名称列压窄（改前 → 改后实测见 [CHANGELOG](../../CHANGELOG.md) 的 `[1.5.0]`） |
|  |  |  |

---

## 附录：本文件的约束来源对照

| 本文件的约束 | 来源 |
|---|---|
| 单卡 ≤5 生产文件 / ≤300 行净新增 | SKILL.md「任务与收尾」 |
| 分两份产物、同一时间戳、永不覆盖 | SKILL.md「正式审计」 |
| 每张卡需写明回滚与停止条件 | SKILL.md「任务与收尾」 |
| LOC 阈值只在 `.project-architect.json` 维护 | SKILL.md「变更与回归门禁」 |
| 审计默认只读、证据分级 | SKILL.md「正式审计」 |
