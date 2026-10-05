---
id: OPENSPEC-CONTEXT-0001
type: requirements-governance
status: approved
version: 1.5.0
created_at: 2026-09-30T18:42:00+08:00
owner: project-owner
related: [ARCH-REQ-0001, PLAN-0001]
supersedes: []
evidence: []
---

# dsh-sym OpenSpec Context

> 本目录的约定**沿用本机既有 OpenSpec 实践**（对照 `~/GitHub/FAGUI/openspec` 适配），
> 不是新发明的格式。适配处已标注。

## 规则

- 将当前生效的功能/非功能需求放在 `specs/<capability>/spec.md`。
- 将每个需求语义变更放在 `changes/<CR-id>-<slug>/`，按 `proposal → specs → design → tasks`
  处理；完成且验证后归档。
- **不在 `docs/` 复制规格正文**；在架构、质量和交付文档中只引用 FR/NFR/CR ID。
- 在合并规格前运行当前项目版本支持的严格 OpenSpec 校验，并把**真实结果**登记到时间线和追溯矩阵。

## 目录约定（适配 dsh-sym）

```text
openspec/
├── project.md                        本文件
├── specs/<capability>/spec.md        FR/NFR 基线
├── changes/CR-XXXX-<slug>/           变更请求
│   ├── proposal.md                   为什么改、改什么、影响谁
│   ├── design.md                     技术方案与取舍
│   ├── tasks.md                      可验证的原子任务
│   └── specs/<capability>/spec.md    本次 CR 对基线的增量
└── templates/                        FR / CR 模板（复制后替换 ID）
```

## 与 .project-architect.json 的边界（**重要**）

| 关注点 | 归谁 |
|---|---|
| 需求、验收、CR | **本目录** |
| 阈值（LOC 上限、单卡文件数/行数） | `.project-architect.json` |
| 公开契约清单 | `.project-architect.json` |
| 架构决策（ADR） | `docs/01-architecture/` |

**规则**：需求编号由本目录分配；`docs/` 与 `.project-architect.json` 只**引用**，不重复定义。
需求冲突以本目录为准，**阈值冲突以 `.project-architect.json` 为准**。
（对照 FAGUI 的差异：该项目的阈值与契约在 `docs/` 内维护；本项目已在
`.project-architect.json` 集中，故此处显式划界，避免两套阈值。）

## 编号约定

- `FR-XXXX`：功能/非功能需求 → `specs/<capability>/spec.md`
- `CR-XXXX`：变更请求 → `changes/CR-XXXX-<slug>/`
- 编号**一经分配不再复用**；删除需求时保留编号并标记 `status: withdrawn`

## 当前基线状态（**已知临时例外**）

`dsh-sym` 在本目录建立之前**已实现 9 项能力**（见
`docs/01-architecture/project-architecture-and-requirements.md` §3 的 FR-01 ~ FR-09）。

按本目录约定它们应回填为已批准基线，但**回填尚未执行**：

- `specs/` 目前为空
- 基线事实源**暂时**是 `docs/01-architecture/` 的 §3 表格
- 这是**临时例外**，不得据此认为本目录可以省略

回填工作的编号分配属于新增任务，需先立 CR（见任务书）。
**在回填完成前，任何新需求都必须走 `changes/`，不得直接改 `specs/`。**

## 工具可用性与降级（skill 要求：探测后登记）

| 工具 | 本机状态 | 用途 | 真实命令 | 降级 |
|---|---|---|---|---|
| `openspec` CLI | **不在 PATH**（`~/.config/openspec/config.json` 存在，历史上用过） | 严格校验规格 | — | **人工比对 `templates/`** |
| `codegraph` CLI | **不可用**（npm 同名包 `codegraph@1.0.0` 是空壳：只有 package.json，`main` 指向的 `dist/index.js` 不存在，无 bin/README/description） | 跨模块影响、循环、选测 | — | **`rg`** |
| `rg` | 可用 | 同上降级 | `rg -n "<符号>" lib/` | — |

**降级实测**（2026-09-30，针对本项目的两份跨端契约）：

```bash
rg -n "sessionCost" lib/ cordis.patch.yml
#   lib/client.js:963, 1214   useProjection("sessionCost")
#   lib/host-v12.js:4, 746    定义处
rg -n "引用#|expandQuoteMarks" lib/
#   lib/host-v12.js:443  QUOTE_MARK 正则
#   lib/host-v12.js:519  展开函数
```

⚠️ **不得声称跑过 `openspec` 或 `codegraph` 的校验命令**——两者在本机都不可用。
