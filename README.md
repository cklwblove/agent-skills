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

### upstream-sync

从上游 Git 仓库增量同步内容到本地项目，支持路径映射、冲突分类与完整性校验。特点：

- 基于 commit SHA 追踪，只同步增量变更
- 通过 `.upstream-mapping.json` 处理上下游目录结构差异
- 小变更（< 30 行）自动合并，大变更、本地修改、`SUMMARY.md` 等标记为人工审阅
- 同步前自动创建 `backup/pre-sync-<ts>` 与 `sync/<ts>` 分支，支持回退
- 脚本：`scripts/sync-upstream.ts`（5 阶段编排）、`scripts/sync-utils.ts`（路径映射与校验）

**何时使用**：用户提到同步上游、merge upstream、pull upstream、`上游同步`、`sync upstream`，或提供上游仓库 URL 与起始 commit SHA 时。

### xianyu-sensitive-word-check

闲鱼商品文案敏感词检测。发布前检查标题、描述是否可能触发违禁词、版权词、极限词或引流规则。特点：

- 15 类风险词库，2100+ 内置词条（商品违禁词、版权词、盗版违规词等）
- 支持谐音/拆字/符号变体匹配（如 vx、薇信、微-信）与手机号、链接、社交账号正则
- 输出分级报告（高危 / 中危 / 低危）与可发布的改写建议
- 可选 CLI：`scripts/check_text.py`（JSON 输出）；业务案例见 `examples/business_cases.py`

**何时使用**：用户提到闲鱼敏感词、违禁词、极限词、广告法禁用词，或在闲鱼/Xianyu 发布前校验商品文案、降低下架/限流风险时。

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

# 示例：安装 upstream-sync
cp -r skills/upstream-sync ~/.cursor/skills/

# 示例：安装 xianyu-sensitive-word-check
cp -r skills/xianyu-sensitive-word-check ~/.cursor/skills/
```

`upstream-sync` 首次使用时，还需将脚本复制到**目标项目**根目录（若尚未存在）：

```bash
mkdir -p <PROJECT_ROOT>/scripts
cp skills/upstream-sync/scripts/sync-upstream.ts <PROJECT_ROOT>/scripts/
cp skills/upstream-sync/scripts/sync-utils.ts <PROJECT_ROOT>/scripts/
# 项目需 devDependencies 中有 tsx：npm i -D tsx
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

**upstream-sync**

```
把 https://github.com/org/upstream-repo 从 commit 9f4457c 开始同步到本地
```

```
帮我配置 upstream remote 并 dry-run 预览这次上游同步
```

```
上游 main 有新提交，按 .upstream-mapping.json 增量同步
```

**xianyu-sensitive-word-check**

```
帮我检测这段闲鱼文案有没有敏感词：九成新 iPhone，加微信看细节
```

```
只检查引流词和联系方式，标题是「全网最低 假一赔万」
```

```
用 xianyu-sensitive-word-check 审查这份商品描述再给出合规改写
```

Agent 会按各 `SKILL.md` 中的流程执行。`project-changelog` 会在**目标项目仓库根目录**写出 `更新日志_2026-05-20_v1.2.0.txt`（不写入 Skill 目录本身）。

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

### upstream-sync 集成到其他工作流

| 场景 | 做法 |
|------|------|
| Fork 文档站 / 翻译仓库 | 安装技能 → 分析上下游目录 → 生成 `.upstream-mapping.json` 与 `sync-state.json` → 运行同步 |
| 首次全量对齐 | 指定 `--from <起始 SHA>` 初始化 `sync-state.json`，大 diff 走 `sync-conflict-report.md` 人工审阅 |
| 日常增量同步 | 直接运行 `node --import tsx scripts/sync-upstream.ts`；状态文件自动续接 `last_synced_commit` |
| 发版前验证 | 去掉 `--skip-build-check`，同步后执行 `npm run docs:build`（或项目等价命令） |
| 安全预览 | 加 `--dry-run` 仅预览变更分类，不写入文件 |

**检查清单**（同步合并前）：

- [ ] `upstream` remote 已配置且 `git fetch upstream` 成功
- [ ] `.upstream-mapping.json` 中目录映射以 `/` 结尾，文件映射无尾斜杠
- [ ] `sync-state.json` 中 `last_synced_commit` 与预期起点一致
- [ ] 已审阅 `sync-conflict-report.md` 中 manual-review 项
- [ ] 合并分支 `sync/<timestamp>` 经完整性校验后再合入 `main`

**CLI 速查**（在目标项目根目录）：

```bash
node --import tsx scripts/sync-upstream.ts --from <COMMIT_SHA>   # 指定起点
node --import tsx scripts/sync-upstream.ts --dry-run             # 预览
node --import tsx scripts/sync-upstream.ts --no-fetch            # 跳过 fetch
node --import tsx scripts/sync-upstream.ts --skip-build-check    # 跳过构建验证
```

### xianyu-sensitive-word-check 集成到其他工作流

| 场景 | 做法 |
|------|------|
| 发布前人工审查 | 对话中粘贴标题+描述，Agent 输出分级报告与改写建议 |
| 批量文案 / CI | 使用 `scripts/check_text.py --file copy.txt`，解析 JSON 的 `verdict` 与 `hits` |
| 团队自定义词 | 编辑 `data/custom_words.txt`（每行一词）；Agent 与脚本均会合并该词库 |
| 仅查部分类别 | 对话中说明范围，如「只检查引流词和极限词」 |
| 业务场景回归 | 运行 `examples/business_cases.py` 验证 13 类典型闲鱼文案 |

**CLI 速查**：

```bash
python skills/xianyu-sensitive-word-check/scripts/check_text.py "待检测文案"
python skills/xianyu-sensitive-word-check/scripts/check_text.py --file path/to/copy.txt
python skills/xianyu-sensitive-word-check/examples/business_cases.py
```

| verdict | 含义 |
|---------|------|
| 通过 | 未命中词库 |
| 存在风险 | 仅有中/低危命中 |
| 不建议发布 | 存在高危命中 |

### 技能目录速查

```
skills/fullstack-webapp-builder/
└── SKILL.md                          # 全栈构建流程（14–18 阶段）

skills/project-changelog/
├── SKILL.md                          # 撰写规范与聚合规则
└── references/
    └── 更新日志_模板.txt              # 代码/多语言对齐类样板

skills/upstream-sync/
├── SKILL.md                          # 同步工作流与映射规则
├── README.md                         # 详细说明
└── scripts/
    ├── sync-upstream.ts              # 5 阶段同步主脚本
    └── sync-utils.ts                 # 路径映射、git 与完整性校验

skills/xianyu-sensitive-word-check/
├── SKILL.md                          # 检测流程与报告模板
├── README.md                         # 详细说明
├── word_categories.md                # 15 类分类词库说明
├── data/
│   ├── custom_words.txt              # 自定义词
│   └── builtin/                      # 内置违禁/版权/盗版词库
├── scripts/check_text.py             # 本地 CLI（JSON 输出）
└── examples/
    ├── business_cases.py             # 13 个业务场景示例
    └── examples.md                   # 案例说明

# project-changelog 成品输出位置（在业务项目根目录，非本仓库）
更新日志_2026-05-20_v1.0.1.txt

# upstream-sync 运行时生成（在目标项目根目录）
.upstream-mapping.json
sync-state.json
sync-conflict-report.md
```

## 贡献新技能

新增技能时请遵循仓库根目录 `AGENTS.md`（或 `CLAUDE.md`）中的约定：`kebab-case` 目录名、`SKILL.md` frontmatter、可选 `scripts/` 与 `references/`，并在本 README「内置技能」中补充说明。
