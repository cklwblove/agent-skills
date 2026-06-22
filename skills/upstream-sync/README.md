# upstream-sync

上游仓库同步工具。自动处理目录结构差异，将上游仓库的内容增量同步到本地项目。

## 功能

- 增量同步：基于 commit SHA 追踪，只同步增量变更
- 路径映射：上游和本地目录结构不同时自动映射
- 智能分类：小变更自动合并，大变更标记为需人工审阅
- 完整性校验：合并后验证文件不丢失、不为空
- 安全回退：自动创建备份分支，支持随时回退

## 触发方式

在 Claude Code 中使用关键词触发：

```
同步上游仓库
sync upstream
```

或手动调用：

```
/upstream-sync
```

## 输入

| 参数 | 说明 | 示例 |
|------|------|------|
| 上游仓库 URL | Git 仓库地址 | `https://github.com/org/repo` |
| 起始 commit SHA | 从此提交开始同步 | `9f4457c9f7a76dfc82d8d2440991faae8058686d` |

## 目录结构

```
upstream-sync/
├── SKILL.md          # 工作流文档（Claude 读取）
├── README.md         # 本说明
└── scripts/
    ├── sync-upstream.ts   # 5 阶段同步主脚本
    └── sync-utils.ts      # 工具函数库
```

## 工作流程

1. **准备** — 配置 upstream remote，fetch 上游数据
2. **分析** — 对比 commit 差异，应用路径映射，分类变更
3. **备份** — 创建 `backup/pre-sync-<ts>` 和 `sync/<ts>` 分支
4. **合并** — 逐文件从上游获取内容写入本地映射路径
5. **报告** — 输出同步摘要，保存冲突报告

## 配置文件

同步过程中会在项目根目录生成两个配置文件：

### `.upstream-mapping.json`

定义上游路径到本地路径的映射关系：

```json
{
  "exclude": ["README.md"],
  "mappings": [
    { "upstream": "01_intro/", "local": "docs/zh/01_intro/" },
    { "upstream": "SUMMARY.md", "local": "SUMMARY.md" }
  ]
}
```

### `sync-state.json`

追踪同步状态：

```json
{
  "upstream_remote": "upstream",
  "upstream_branch": "main",
  "last_synced_commit": "2261be59...",
  "last_sync_time": "2026-06-22T02:24:44.926Z",
  "sync_history": []
}
```

## 合并策略

| 变更类型 | 处理方式 |
|---------|---------|
| 新增文件 | 自动合并 |
| 小变更 (< 30 行) | 自动合并 |
| 大变更 (>= 30 行) | 人工审阅 |
| 有本地修改 | 人工审阅 |
| 文件被删除 | 人工审阅 |
| SUMMARY.md | 始终人工审阅 |

## CLI 参数

```bash
node --import tsx scripts/sync-upstream.ts [OPTIONS]

--from <sha>         从此 commit 开始同步
--dry-run            预览模式，不修改文件
--no-fetch           跳过 git fetch
--skip-build-check   跳过构建验证
```
