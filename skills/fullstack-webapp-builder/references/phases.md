# 全栈 Web 应用构建 — 阶段模板

本文件定义 14–18 阶段计划的可选标准模板。可根据具体应用增删或合并阶段。

## 阶段 1：单体仓库/项目设置 + Git + CI 基础

- 子步骤：初始化仓库、依赖、目录结构、基础 CI 配置
- 交付：可构建的空项目、Git 与 CI 流水线骨架
- 关键文件：`package.json` / `pyproject.toml`、`.gitignore`、CI 配置（如 `.github/workflows`）
- 提交信息示例：`chore: init monorepo, deps, CI skeleton`
- E2E：可选的「访问首页」冒烟测试
- 检查点：构建通过、CI 绿

## 阶段 2：数据库架构 + ORM 设置

- 子步骤：设计表/集合、迁移、ORM 模型与种子数据
- 交付：可迁移的 schema、可运行的种子
- 关键文件：`prisma/schema.prisma` 或等价、迁移文件、种子脚本
- 提交信息示例：`feat(db): schema, migrations, seed`
- E2E：无（或仅健康检查接口）
- 检查点：迁移成功、种子可重复执行

## 阶段 3：身份验证和授权系统

- 子步骤：注册/登录/登出、JWT 或 OAuth、权限/角色
- 交付：受保护路由与 API、会话管理
- 关键文件：auth 模块、中间件/守卫、用户模型
- 提交信息示例：`feat(auth): register, login, JWT, guards`
- E2E：登录 → 获取受保护资源 → 登出
- 检查点：未授权访问被拒绝、令牌刷新正常

## 阶段 4：核心后端 API 接口

- 子步骤：CRUD 端点、校验、错误码、分页
- 交付：文档化且可调用的 API
- 关键文件：路由/控制器、DTO、校验 schema
- 提交信息示例：`feat(api): core CRUD, validation, errors`
- E2E：通过 API 或前端调用 CRUD，断言状态与响应
- 检查点：校验与错误处理一致、分页正确

## 阶段 5：前端框架 + 路由 + 状态管理

- 子步骤：框架初始化、路由、全局状态（如 Context/Redux/Zustand）
- 交付：可导航的多页/多路由 SPA
- 关键文件：`App`/路由配置、store/provider
- 提交信息示例：`feat(frontend): routing, state`
- E2E：导航主要路由、状态持久化（若适用）
- 检查点：路由与状态与设计一致

## 阶段 6：核心 UI 组件 + 响应式布局

- 子步骤：设计系统/主题、核心组件、布局与断点
- 交付：可复用的组件库与响应式页面骨架
- 关键文件：组件目录、布局、主题/样式
- 提交信息示例：`feat(ui): core components, responsive layout`
- E2E：不同视口下检查布局与可点击区域
- 检查点：WCAG 基础、移动端可用

## 阶段 7：API 集成 + 实时功能

- 子步骤：前端调用后端 API、错误与加载态、实时通道（如 WebSocket/Supabase）
- 交付：数据与后端一致、实时更新生效
- 关键文件：API 客户端、实时订阅/钩子
- 提交信息示例：`feat(integration): API client, realtime`
- E2E：创建/更新后列表或详情即时更新
- 检查点：网络错误与加载态处理正确

## 阶段 8：高级功能（离线、搜索、文件上传等）

- 子步骤：按需求实现 PWA/离线、全文搜索、上传等
- 交付：对应功能可用且与现有流程兼容
- 关键文件：service worker、搜索/上传相关模块
- 提交信息示例：`feat: offline support, search, upload`
- E2E：离线后操作、搜索/上传流程
- 检查点：离线策略与缓存合理、上传校验与限制

## 阶段 9：分析/仪表盘 + 图表

- 子步骤：埋点或分析接口、仪表盘页、图表展示
- 交付：可查看的指标与图表
- 关键文件：分析模块、仪表盘页、图表组件
- 提交信息示例：`feat(analytics): dashboard, charts`
- E2E：打开仪表盘、断言关键数据或图表存在
- 检查点：数据来源正确、无敏感信息泄露

## 阶段 10：管理/设置面板 + 主题

- 子步骤：管理后台入口、设置页、主题/外观切换
- 交付：可用的管理与设置、主题持久化
- 关键文件：管理路由与页面、设置 API、主题状态
- 提交信息示例：`feat(admin): settings, theme`
- E2E：修改设置/主题并刷新验证
- 检查点：权限控制、主题切换无闪屏

## 阶段 11：Playwright 端到端测试套件搭建

- 子步骤：安装配置 Playwright、fixtures、基础页面对象或工具函数
- 交付：可运行的 E2E 脚本骨架与 CI 集成
- 关键文件：`playwright.config.*`、`e2e/` 目录、CI 中 E2E 步骤
- 提交信息示例：`chore(e2e): Playwright setup, fixtures`
- E2E：运行一条示例测试
- 检查点：本地与 CI 均可执行

## 阶段 12：基于浏览器的完整端到端测试（多用户流程）

- 子步骤：编写覆盖主流程、多角色/多用户的 E2E 用例
- 交付：登录 → 创建 → 编辑 → 删除及边界场景的完整测试
- 关键文件：`e2e/*.spec.ts` 或等价
- 提交信息示例：`test(e2e): full user flows, edge cases`
- E2E：执行全部 E2E，记录通过/失败与截图或日志描述
- 检查点：主要业务流程 100% 通过

## 阶段 13：安全审计 + 性能优化（Lighthouse 95+）

- 子步骤：安全扫描、依赖审计、CSP/速率限制复查、Lighthouse 与性能优化
- 交付：审计结论与优化项修复、Lighthouse 目标分数
- 关键文件：安全与性能相关配置、可能的新中间件或前端优化
- 提交信息示例：`fix(security): audit, CSP; perf: Lighthouse 95+`
- E2E：无新增；回归 E2E 仍通过
- 检查点：无高危漏洞、Lighthouse 性能/可访问性达标

## 阶段 14：CI/CD 流水线 + 自动化测试

- 子步骤：完整 CI（lint、单元、E2E、构建）、CD 或部署脚本
- 交付：提交即触发流水线、测试与部署自动化
- 关键文件：CI 配置、部署脚本或平台配置
- 提交信息示例：`ci: full pipeline, deploy`
- E2E：CI 中 E2E 通过
- 检查点：流水线稳定、部署可重复

## 阶段 15：文档 + README + 环境配置

- 子步骤：README（设置、运行、部署）、环境变量说明、必要文档
- 交付：他人可据此搭建与部署
- 关键文件：`README.md`、`.env.example`、可选架构/API 文档
- 提交信息示例：`docs: README, env, setup`
- E2E：无
- 检查点：按 README 可完成本地与部署

## 阶段 16：部署到生产环境

- 子步骤：选择并配置托管（Vercel/Render/Netlify 等）、环境变量、域名（若需要）
- 交付：线上可访问的 URL
- 关键文件：平台配置、环境变量
- 提交信息示例：`deploy: production`
- E2E：无（下一阶段验证）
- 检查点：构建与部署成功

## 阶段 17：部署后验证（浏览器检查实时 URL）

- 子步骤：对生产 URL 执行 E2E 或关键路径检查、Lighthouse
- 交付：生产环境测试结果与评分
- 关键文件：无（或生产专用 E2E 配置）
- 提交信息示例：`chore: verify production`
- E2E：针对生产 URL 的冒烟/主流程测试
- 检查点：生产环境行为与预期一致、最终 Lighthouse/可访问性/安全评分
