---
name: vitepress-course-tools-setup
description: |
  配置与同步 VitePress 课程文档站的 @smart-cs/vitepress-course-tools：空工程脚手架、侧栏菜单、PDF 封面目录 tocManifest、商品详情 productDetail、npm 导出脚本、源码包发布。
  当用户提到 vitepress-course-tools.config.ts、同步 docs/zh 菜单、tocManifest、productDetail、商品详情 PDF、pdf:export:product、课程 PDF 导出、README 截图配置、code:release、code:pack、源码包发布/Gitee Release，或要在空目录初始化/新建课程文档站时使用本 skill，即使用户只说「更新文档站配置」「对齐侧栏和 PDF 配置」或「新建文档工程」也应触发。
---

# VitePress 课程工具配置

面向使用 `@smart-cs/vitepress-course-tools` 的 VitePress 文档站。目标：磁盘上的 `docs/zh/**/*.md` 与导航、PDF 封面目录、商品详情页保持一致，并补齐 npm 导出命令。

## 涉及文件

| 文件 | 作用 |
|------|------|
| `docs/zh/**/*.md` | 文档真源（以磁盘为准） |
| `docs/.vitepress/config.mts` | 网站侧栏 / 导航 `link` |
| `vitepress-course-tools.config.ts` | PDF、封面、商品详情、截图、codePack / codeRelease |
| `scripts/export-site-utils.ts` | 旧版导出脚本中的 `ZH_*_DOCS` 列表（若存在） |
| `shared/course-theme-class.ts` | 主题 class，勿在 VitePress 客户端 import 完整 config |
| `package.json` | `pdf:*` / `screenshots:*` / `code:pack` / `code:release` 脚本 |

`basePath`（config）须与 `docs/.vitepress/config.mts` 的 `base` 完全一致。

## 工作流

```
进度：
- [ ] 0. 空工程判断：无 VitePress 工程则先从模板脚手架
- [ ] 1. 扫描 docs/zh 实际 .md 文件
- [ ] 2. 同步 docs/.vitepress/config.mts 侧栏
- [ ] 3. 同步 vitepress-course-tools.config.ts → cover.tocManifest
- [ ] 4. 同步 scripts/export-site-utils.ts（若项目仍使用该文件）
- [ ] 5. 配置或更新 productDetail
- [ ] 6. 确认 package.json 导出脚本与依赖
- [ ] 7. 校验（可选运行导出）
```

### 0. 空工程：先脚手架再配置

**判断**：项目根没有 `docs/.vitepress/config.mts` 且没有 `vitepress-course-tools.config.ts`（全新目录，或只有 `.git`/零散文件）→ 视为空工程，**先基于模板仓库创建项目工程**，再进入 1–7 的同步流程。

模板仓库：https://github.com/cklwblove/claude-code-theme-vitepress （默认分支 `main`）

```bash
# 目录完全为空：
git clone --depth 1 https://github.com/cklwblove/claude-code-theme-vitepress.git .

# 目录已有文件（如已有 .git，clone 到 '.' 会失败）：克隆到临时目录再拷入
git clone --depth 1 https://github.com/cklwblove/claude-code-theme-vitepress.git .scaffold
rm -rf .scaffold/.git            # 断开模板历史，作为独立新项目
cp -Rn .scaffold/. . && rm -rf .scaffold   # -n 不覆盖已有文件；发现同名冲突先报告再处理
[ -d .git ] || git init

npm install --legacy-peer-deps   # 依赖走 https Git URL，无需 ssh 重写；peer 冲突按现状安装
npm run docs:dev                 # 验证站点可启动
```

模板已提供：`docs/zh/index.md`、`docs/en/index.md`、`docs/.vitepress/`（config + theme）、`scripts/export-site-utils.ts`、`scripts/capture-readme-screenshots.ts`、`shared/course-theme-class.ts`、`vitepress-course-tools.config.ts`（Git 依赖式 import），以及含 `pdf:*` / `math:*` / `code:pack` 脚本的 `package.json`；**缺** `code:release`、`pdf:export:product`、`screenshots:readme`，在第 6 步补齐。

**脚手架后必改的模板残留**（模板带着上一门课的配置）：

- `package.json`：`name` / `description` / `version`
- `vitepress-course-tools.config.ts`：`basePath`（模板残留 `/AgroAgentOS_docs/`）、`pdf.name` / `footerMark`、`codePack.exclude` 里的旧项目文件
- `docs/.vitepress/config.mts`：`base`（须与 `basePath` 完全一致）、站点标题
- `CLAUDE.md`：按新项目重写；`.cursor/` 可删
- 起步内容 `docs/zh/index.md`

改完身份配置后写入真实文档，再按 1–7 同步侧栏 / PDF / 商品详情。

### 1. 扫描 docs/zh

```bash
find docs/zh -name '*.md' | sort
```

区分：
- 根目录技术文档：`index.md`、`00-*.md` … `10-*.md`
- 面试资料：`interview/*.md`

侧栏显示名通常取自文件名（去掉序号前缀与 `.md`），或与现有 `text` 字段风格保持一致。

### 2. 同步侧栏（config.mts）

在 `zhGuideItems` / `zhInterviewItems` 中：

- **link 格式**：`/zh/文件名.md` 或 `/zh/`（index）
- **text**：与文档标题或文件名语义一致
- **顺序**：`index` → 编号技术文档 → `interview/` 子目录按文件名排序

常见错误：`link` 指向已改名/删除的文件（如 `05-八股文-医疗AI专题.md` 实际为 `05-八股文-AI专题.md`）。

英文侧栏 `enGuideItems` 仅在 `docs/en/` 存在对应文件时维护。

### 3. 同步 cover.tocManifest

在 `vitepress-course-tools.config.ts` 的 `cover.tocManifest` 中，条目顺序与侧栏一致：

```ts
{ title: '侧栏 text', routePath: '/zh/路由' }
```

**routePath 规则**（`cleanUrls: true`）：
- `index.md` → `/zh/`
- `00-项目概览.md` → `/zh/00-项目概览`（无 `.md` 后缀）
- `interview/01-简历写法模板.md` → `/zh/interview/01-简历写法模板`

`title` 与侧栏 `text` 对齐；`routePath` 与包内 `sourceFileToRoutePath` 一致。

### 4. 同步 export-site-utils（若存在）

`scripts/export-site-utils.ts` 中的 `ZH_GUIDE_DOCS`、`ZH_INTERVIEW_DOCS` 须与侧栏顺序一致，但值为**相对 `docs/zh/` 的路径**（含 `.md`）：

```ts
'index.md',
'00-项目概览.md',
// ...
'interview/01-简历写法模板.md',
```

`readmeScreenshotTargets` 的 `routePath` 同样用 cleanUrls 格式。

### 5. 配置 productDetail

在 `vitepress-course-tools.config.ts` 增加 `productDetail`（类型 `ProductDetailConfig`）。

**与 cover 的关系**：
- `title` / `subtitle` 可与 `cover.mainTitle` / `subTitle` 对齐
- 未写 `intro` 时导出回退到 `cover.descCn`
- 未写 `tocSections` 时回退到 `pdf.tocGroups` 或自动生成

**intro 写法**（包内渲染规则）：

| 语法 | 效果 |
|------|------|
| 空行 | 分段 |
| 行首 `🔹` / `##` / `【标题】` | 小节标题 |
| 行首 `•` `-` `*` | 列表 |
| 普通行 | 段落 |

**tocSections**：按侧栏分组（如「技术文档」「面试资料」），每项 `{ title, note? }`，标题与 tocManifest 一致，note 为一句卖点。

**gallery**：指向 `screenshotsDir` 下 PNG；路径相对项目根。与 `screenshots` 配置或 `readmeScreenshotTargets` 对齐。图片不存在时包内会回退占位图——正式发版前先跑截图。

**exportVariants**：`['classic', 'minimal', 'card']` 或按需子集。

完整字段说明见 [references/product-detail-fields.md](references/product-detail-fields.md)。

### 6. package.json 脚本

依赖（Git 安装时无 dist，用 `tsx` 直跑 `src/cli`）：

```json
"@smart-cs/vitepress-course-tools": "github:cklwblove/vitepress-course-tools"
```

推荐脚本：

```json
"pdf:export": "tsx node_modules/@smart-cs/vitepress-course-tools/src/cli/pdf-export.ts --phase=all",
"pdf:export:sections": "... --phase=sections",
"pdf:export:cover-toc": "... --phase=cover-toc",
"pdf:export:merge": "... --phase=merge",
"pdf:export:cover": "tsx node_modules/@smart-cs/vitepress-course-tools/src/cli/pdf-cover.ts",
"pdf:export:product": "tsx node_modules/@smart-cs/vitepress-course-tools/src/cli/pdf-product-detail.ts",
"pdf:build": "npm run docs:build && npm run pdf:export",
"screenshots:readme": "tsx scripts/capture-readme-screenshots.ts",
"code:pack": "tsx node_modules/@smart-cs/vitepress-course-tools/src/cli/pack-code.ts",
"code:release": "tsx node_modules/@smart-cs/vitepress-course-tools/scripts/release-code.ts"
```

注意 `code:release` 的脚本在包根 `scripts/`，**不在** `src/cli/`。该命令由包提交 `dd02509`（2026-10-14）引入；旧安装（0.1.28 及更早）没有 `scripts/release-code.ts`，须先重装/更新 Git 依赖。

`vitepress-course-tools.config.ts` 顶部类型导入：

- 有 dist：`import type { CourseToolsConfig } from '@smart-cs/vitepress-course-tools'`
- 仅 Git 源码：改引 `./node_modules/@smart-cs/vitepress-course-tools/src/types.ts`

#### code:release：发布源码包到 Gitee Release

`code:pack` 产物为 `artifacts/code.<时间戳>.zip`（如 `code.20261014-153045.zip`），密码默认每次随机生成（16 位 hex），旁路生成 `code.<时间戳>解压密码<密码>.txt`。`code:pack` 返回 `{ archivePath, password, passwordHintPath }`。

`code:release` 自动先打包再发布，**只上传 zip** 到发布仓库（默认 `gitee.com/its-orange-juice-2026/published`，用 `codeRelease.repo` 调整）的 Release；**密码 txt 不上传**，发布成功后脚本把 zip 下载链接写入 txt（压缩包 / 下载链接 / 解压密码 三行），作为本地交付文件发给买家。

- 认证：环境变量 `GITEE_ACCESS_TOKEN`（或 `GITEE_TOKEN`），令牌须对发布仓库有 Releases 写权限（申请勾选 projects 权限）
- 常用参数：`--dry-run`（预览不调 API）、`--skip-pack`（发布 artifacts 下最新 zip）、`--tag/--name/--notes`（临时覆盖配置）
- tag / name / notes 三级取值：**CLI 参数 > `codeRelease` 配置 > 自动推断**；项目名/版本推断顺序：`codeRelease.projectName/projectVersion` > `pdf.name/pdf.version` > `package.json` 的 `name/version`
- 占位符（配置与 `--notes` 均可用）：`{project}` `{version}` `{zip}` `{zipStem}` `{timestamp}` `{date}` `{commit}` `{branch}` `{subject}` `{author}`

`codeRelease` 配置段（可选，全字段有默认值）：

```ts
codeRelease: {
  repo: 'its-orange-juice-2026/published',        // owner/repo 或 Gitee 地址
  tag: '{project}-{version}-build.{timestamp}',   // 默认 {project}-{version}-{timestamp}
  name: '{project} {version} 源码包',
  notes: '### {project} {version}\n- 打包: {date}\n- 源提交: {commit}',
  appendAttachmentNote: true,   // 配置 notes 后是否仍附加自动附件说明段
  projectName: 'xx-guide',      // {project} 来源
  projectVersion: 'v1.0.0'      // {version} 来源
}
```

**固化通用发版描述**：交付型项目不要用默认的「commit 信息」描述，用 `codeRelease.notes` 模板固化统一文案（结构与 `productDetail.intro` 口径一致，仅保留 `{version}/{date}/{commit}/{branch}/{zip}` 动态项），并配 `appendAttachmentNote: false` 避免责声明重复。完整模板与要点见 [references/code-release.md](references/code-release.md)。

**发布排障**（400 `target_commitish` / 403 私有仓库 / 旧 zip 干扰）与 **Git 依赖更新命令**（ssh→https 重写 + `--legacy-peer-deps`）同样见 [references/code-release.md](references/code-release.md)。

### 7. 校验

```bash
# 侧栏与磁盘一致（人工或 diff）
find docs/zh -name '*.md' | sort

# 整本课程 PDF（需先 build）
npm run docs:build
npm run pdf:export

# 商品详情 PDF（不依赖 build，但 gallery 图需存在）
npm run pdf:export:product
npm run pdf:export:product -- --variant classic

# README 截图 → productDetail.gallery
npm run docs:build && npm run screenshots:readme

# 源码包发布（先 dry-run 预览，确认 tag/标题/描述来源后再正式发布）
npm run code:release -- --dry-run
```

成品路径：
- 课程 PDF：`artifacts/pdfs/<pdf.name>-guide-zh.pdf`
- 商品详情：`artifacts/pdfs/<pdf.name>-product-*.pdf`
- 源码包：`artifacts/code.<时间戳>.zip` + 旁路 `code.<时间戳>解压密码<密码>.txt`（发布成功后含下载链接，作为交付文件）

## 新增 / 删除文档时的检查单

1. 在 `docs/zh/` 增删 `.md`
2. 更新 `config.mts` 对应 `zhGuideItems` 或 `zhInterviewItems`
3. 更新 `cover.tocManifest` 同序条目
4. 更新 `productDetail.tocSections`（若有分组目录）
5. 更新 `export-site-utils.ts` 的 `ZH_*_DOCS`（若存在）
6. 新章节若需预览图：加入 `screenshots` / `gallery` / `readmeScreenshotTargets`

## 注意事项

- 勿在 `docs/.vitepress/theme/index.js` 中 import 完整 `vitepress-course-tools.config.ts`（会拖入 Node 依赖导致白屏）；主题 class 用 `shared/course-theme-class.ts`
- `docsBasePath` 在 `export-site-utils.ts` 可能与 `config.mts` 的 `base` 不一致，以 **config.mts 为准** 并统一
- 虚拟商品文案注意平台合规：避免医疗执业、极限词、站外引流；详见项目内 `品文案.md`（若存在）

## 参考

- 脚手架模板仓库（空工程初始化用）：https://github.com/cklwblove/claude-code-theme-vitepress
- 包内 README：`node_modules/@smart-cs/vitepress-course-tools/README.md`
- 字段速查：[references/product-detail-fields.md](references/product-detail-fields.md)
- 同步关系图：[references/config-sync-map.md](references/config-sync-map.md)
- 源码包发布（固化描述模板 / 排障 / 依赖更新）：[references/code-release.md](references/code-release.md)
