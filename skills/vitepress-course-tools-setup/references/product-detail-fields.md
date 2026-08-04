# productDetail 字段速查

来源：`@smart-cs/vitepress-course-tools` → `ProductDetailConfig`

## 常用字段

| 字段 | 说明 |
|------|------|
| `variant` | 默认样式：`classic` \| `minimal` \| `card` |
| `exportVariants` | CLI 未传 `--variant` 时导出的样式列表 |
| `title` | 商品主标题 |
| `subtitle` | 副标题，如「电子版资料 · …」 |
| `badge` | 角标；缺省取 `cover.editionLabel` |
| `intro` | 介绍正文，`string` 或 `string[]`，支持 🔹 / • 语法 |
| `highlights` | 标签数组，如 `['官方整理', '持续更新']` |
| `galleryTitle` | 预览区标题，默认「效果预览」 |
| `galleryLayout` | `stack` 单列 \| `grid` 两列 |
| `gallery` | `{ image, caption? }[]`，路径相对项目根 |
| `tocTitle` | 目录区标题 |
| `tocSubtitle` | 目录区副标题 |
| `tocItems` | 平铺目录 `{ title, note? }[]` |
| `tocSections` | 分组目录 `{ title, items[] }[]` |
| `footnote` | 页脚免责声明 |

## intro 模板

```ts
intro: `
🔹 资料简介
一段话概述项目定位与交付物。

🔹 核心内容
重点介绍项目的核心内容，包括但不限于：
- 项目架构
- 项目亮点
- 项目难点
- 项目成果
- 项目技术文档
- 项目技术栈

🔹 适合人群
• 求职者 …
• 学习者 …`,
```

## tocSections 模板

```ts
tocSections: [
  {
    title: '技术文档',
    items: [
      { title: '快速开始', note: '5 分钟跑通' },
      { title: '架构设计详解', note: '六 Agent 流水线' }
    ]
  },
  {
    title: '面试资料',
    items: [
      { title: '简历写法模板', note: '3 种版本' }
    ]
  }
]
```

## gallery 与截图联动

1. 在 `screenshots` 或 `scripts/export-site-utils.ts` → `readmeScreenshotTargets` 定义路由
2. 运行 `npm run screenshots:readme`（需先 `docs:build`）
3. 在 `productDetail.gallery` 引用 `docs/public/screenshots/readme/*.png`

## CLI

```bash
npm run pdf:export:product
npm run pdf:export:product -- --variant classic
npm run pdf:export:product -- --variant all
```

输出：`artifacts/pdfs/<pdf.name>-product-<variant>.pdf`
