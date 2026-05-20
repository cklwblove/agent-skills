# agent-skills

本仓库存放供 AI 使用的技能（Skills），用于在特定场景下扩展能力与工作流。

## 目录结构

```
agent-skills/
├── README.md
└── skills/
    └── <skill-name>/
        ├── SKILL.md          # 技能主文件（frontmatter + 使用说明）
        ├── references/       # 参考文档（按需加载）
        ├── scripts/          # 可执行脚本（可选）
        └── assets/           # 模板、资源文件（可选）
```

## 内置技能

### fullstack-webapp-builder

通用全栈 Web 应用构建器（高级自动执行模式）。从零构建可上生产环境的全栈应用，包含：

- 需求分析、技术栈选型、14–18 阶段计划与执行
- 端到端测试（Playwright）、安全与性能审计、CI/CD 与部署
- 最终产出：完整代码库、README、CI 配置、线上演示 URL、Lighthouse 评分与 E2E 测试总结

**何时使用**：用户描述应用名称、用途、功能、用户流程、技术偏好或数据模型，且希望一次性得到完整可运行项目时，加载该技能。

### project-changelog

按仓库规范撰写、整理中文项目更新日志（`更新日志_<日期>_v<版本>.txt`）。特点：

- 成品命名与页眉版本、日期一致，每次发布单独新建文件，不覆盖历史
- 文档类变更按**模块**聚合（如「面试准备」「VitePress 站点配置」），禁止罗列具体 `.md` 路径
- 代码类变更可写语言 + 文件路径，并支持 P0/P1/P2 分级与「文件变更清单」
- 模板见 `skills/project-changelog/references/更新日志_模板.txt`

**何时使用**：用户提到更新日志、发行说明、版本发布说明、changelog、`更新日志_模板`，或在版本发布、大功能合并后需要生成中文变更摘要时。

## 使用方式

### 安装技能

将对应技能目录复制到 AI 环境的 Skills 目录（或把 `SKILL.md` 加入项目知识库）：

| 环境 | 路径示例 |
|------|----------|
| Cursor | `~/.cursor/skills/` 或项目内 `.cursor/skills/` |
| Claude Code | `~/.claude/skills/` |
| claude.ai | 项目 Knowledge，或对话中粘贴 `SKILL.md` 正文 |

```bash
# 示例：安装 project-changelog
cp -r skills/project-changelog ~/.cursor/skills/
# 或 Claude Code
cp -r skills/project-changelog ~/.claude/skills/
```

安装后，Agent 启动时会读取各技能 frontmatter 中的 `name` 与 `description`；当对话场景匹配描述中的触发词时，再加载完整 `SKILL.md`。

### 触发与对话示例

在对话中直接说明意图即可，无需手动指定文件路径：

```
帮我写这次发布的更新日志，版本 v1.2.0，日期 2026-05-20
```

```
根据当前 git diff 整理一份文档站点的更新摘要
```

```
按 project-changelog 规范，把这次 Java/Go 对齐改动写成 changelog
```

Agent 会按 `SKILL.md` 中的流程：收集变更 → 按模块或 P0/P1/P2 聚合 → 套用结构 → 在**目标项目仓库根目录**写出 `更新日志_2026-05-20_v1.2.0.txt`（不写入 Skill 目录本身）。

### project-changelog 集成到其他工作流

| 场景 | 做法 |
|------|------|
| 与全栈构建并行 | 同时安装 `fullstack-webapp-builder` 与 `project-changelog`；项目交付或阶段结束时，单独发起「写更新日志」任务，避免与编码阶段争抢上下文 |
| 与 Git 发布流程 | 在 `git tag` / 发版 PR 前，让 Agent 基于 `git diff <上一标签>..HEAD` 或 PR 描述生成日志；人工核对页眉、文件名、汇总表三者一致后提交 |
| 文档站 / 多模块仓库 | 只安装 `project-changelog`；强调「文档类发布」，Agent 会走模块聚合规则，文末用「变更范围汇总」表，不写 `.md` 路径 |
| 代码对齐 / 多语言仓库 | 提示「代码类发布」；Agent 会先读 `references/更新日志_模板.txt`，再输出带「文件变更清单」「已知问题」等小节 |
| CI（可选） | 发版 job 中调用 Agent 或脚本生成草稿后，由维护者 review；本技能为 Markdown 规范，无强制 CLI |

**检查清单**（发版前人工或 Agent 自检）：

- [ ] 文件名 = `更新日志_<YYYY-MM-DD>_v<主.次.补丁>.txt`
- [ ] 页眉「版本」「更新日期」与文件名一致
- [ ] 文档类正文无 `docs/zh/xxx.md` 等路径
- [ ] 含「背景」与「变更范围汇总」表
- [ ] 未删除历史版本的更新日志文件

### 技能目录速查

```
skills/project-changelog/
├── SKILL.md                          # 撰写规范与聚合规则
└── references/
    └── 更新日志_模板.txt              # 代码/多语言对齐类样板

# 成品输出位置（在业务项目根目录，非本仓库）
更新日志_2026-05-20_v1.0.1.txt
```

## 贡献新技能

新增技能时请遵循仓库根目录 `AGENTS.md`（或 `CLAUDE.md`）中的约定：`kebab-case` 目录名、`SKILL.md` frontmatter、可选 `scripts/` 与 `references/`，并在本 README「内置技能」中补充说明。
