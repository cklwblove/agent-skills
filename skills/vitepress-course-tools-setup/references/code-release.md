# code:release 源码包发布参考

发布流程、参数、占位符、`codeRelease` 全字段见 SKILL.md 主文「code:release」小节。本文件沉淀实战补充：固化通用描述模板、发布排障、Git 依赖更新命令。

## 固化通用发版描述（交付型项目推荐）

描述默认走「自动生成（最新 commit 信息）」，措辞随每次提交变化。交付型项目建议用 `codeRelease.notes` 固化为统一文案：结构固定，只保留少量动态占位符。实盘模板（document-review-agent 项目验证过）：

```ts
codeRelease: {
  // 关闭脚本自动附加的附件说明段（该段自带一句免责声明，会与模板尾部重复）
  appendAttachmentNote: false,
  notes: [
    '### {中文项目名}（{英文项目名}）{version} 源码包',
    '',
    '一句项目定位：技术栈组合 + 交付物范围（源码 / 领域配置 / 文档篇数）。',
    '',
    '🔹 核心内容',
    '• 架构与代码走读：……',
    '• 使用指南：……',
    '• 开发与部署：……',
    '• API 参考：……',
    '',
    '🔹 版本信息',
    '- 打包日期: {date}',
    '- 源提交: {commit}（{branch}）',
    '- 附件: `{zip}`（`code/` 目录全栈源码包，带随机解压密码）',
    '',
    '> 免责声明（AI 结果仅供参考等）+ 部署提醒（自行配置 API Key、改默认口令）。',
  ].join('\n'),
}
```

要点：

- 文案口径与 `productDetail.intro`（资料简介）保持一致，可直接从中提炼，无需新写
- 模板是多行数组 `join('\n')`，比转义 `\n` 的单字符串易维护
- dry-run 输出里描述来源会显示「配置 codeRelease.notes」，占位符即时可见展开结果
- 附件说明已并入「版本信息」行（`{zip}` 占位符），故关掉 `appendAttachmentNote`

## 发布排障（按报错对照）

| 报错 / 现象 | 原因与处理 |
|------|------|
| `400 {"messages":["target_commitish is missing"]}` | 0.1.29 包内 commit `1ffd6f6`（2026-10-14）之前的 bug：每次时间戳 tag 均为新 tag，Gitee 必填 `target_commitish`，而脚本未传。更新依赖到 `1ffd6f6+`（命令见下节） |
| `403 Forbidden` | 发布目标是**私有仓库**——最常见是把 `codeRelease.repo` 误配成项目自己的私有源码仓库。发布仓库必须是公开交付仓库（默认 `its-orange-juice-2026/published`，通常无需配置 repo）；若已是公开仓库则检查令牌账号对其是否有写权限 |
| 发布了旧包 / `--skip-pack` 选错 zip | artifacts 里残留无时间戳的旧格式 `code.zip`：字典序上 `code.zip` > `code.2026…`，被当作「最新」选中。删除旧格式 zip 及其配套密码 txt |
| 「工作区存在未提交改动」警告 | zip 会包含未提交改动，但发布说明只对应 HEAD 提交。先提交再发布，或明确接受差异 |
| Gitee 报错显示原始 JSON | Gitee 校验错误用 `messages`（复数数组），包内 `giteeApi` 只解析 `message` 单数，属包的显示问题，原始 JSON 中已含原因 |

无令牌 / 令牌无效为 `401`：设置 `GITEE_ACCESS_TOKEN`（申请入口 gitee.com/profile/personal_access_tokens，勾选 projects 权限，令牌须对发布仓库有 Releases 写权限）。

## 更新 Git 依赖的命令

npm 按 lock 的 `git+ssh://` 拉取会直连 GitHub 22 端口超时，且项目常见 peer 冲突，统一用：

```bash
GIT_CONFIG_COUNT=1 \
GIT_CONFIG_KEY_0='url.https://github.com/.insteadOf' \
GIT_CONFIG_VALUE_0='ssh://git@github.com/' \
npm update @smart-cs/vitepress-course-tools --legacy-peer-deps
```

- `--legacy-peer-deps`：`markdown-it-mathjax3` 等直接依赖与 vitepress 的 peerOptional 声明冲突时保持现状安装
- 临时 git 环境变量把 `ssh://git@github.com/` 重写为 `https://github.com/` 走代理，不污染全局 git 配置
- `codeload.github.com` 偶发 `ECONNRESET`：网络瞬断，原样重试即可
- 工具包本地维护仓库：`/Volumes/liwb-ssd/hs_work/lab/vitepress-course-tools`（用户即上游维护者）——修包 bug 直接改它、push origin main，再回使用方项目执行上面的 update 拉官方修复
