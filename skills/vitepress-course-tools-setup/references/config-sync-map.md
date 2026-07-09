# 配置同步关系

```
docs/zh/**/*.md  （真源）
       │
       ├─► docs/.vitepress/config.mts
       │     zhGuideItems[].link     → /zh/xx.md 或 /zh/
       │     zhGuideItems[].text     → 侧栏显示名
       │
       ├─► vitepress-course-tools.config.ts
       │     cover.tocManifest[]     → { title, routePath }  cleanUrls，无 .md
       │     productDetail.tocSections → 分组 + note（面向买家）
       │     productDetail.gallery     → 截图路径
       │     screenshots[]             → { language, routePath, outputName }
       │
       └─► scripts/export-site-utils.ts（旧脚本，若存在）
             ZH_GUIDE_DOCS[]           → 相对 docs/zh/ 的路径，含 .md
             ZH_INTERVIEW_DOCS[]
             readmeScreenshotTargets[]
```

## routePath 转换

| 磁盘路径（相对 docs/zh/） | routePath |
|--------------------------|-----------|
| `index.md` | `/zh/` |
| `02-架构设计详解.md` | `/zh/02-架构设计详解` |
| `interview/03-八股文-多Agent系统.md` | `/zh/interview/03-八股文-多Agent系统` |

## 侧栏 link 与 routePath

| 用途 | 格式 | 示例 |
|------|------|------|
| VitePress 侧栏 `link` | 可带 `.md` | `/zh/00-项目概览.md` |
| tocManifest / 截图 `routePath` | cleanUrls，无 `.md` | `/zh/00-项目概览` |

## basePath 对齐

| 文件 | 字段 |
|------|------|
| `docs/.vitepress/config.mts` | `base` |
| `vitepress-course-tools.config.ts` | `basePath` |
| `scripts/export-site-utils.ts` | `docsBasePath`（应一致） |

三者不一致会导致 PDF 导出 404 或截图空白。
