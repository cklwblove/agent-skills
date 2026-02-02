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

## 使用方式

将 `skills/<skill-name>/` 目录或打包后的 `.skill` 文件配置到你的 AI 环境（如 Cursor 的 Skills、Claude 的 Skills），在对话中提及对应场景即可触发该技能。
