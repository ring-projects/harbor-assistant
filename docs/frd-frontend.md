# Harbor Assistant 前端需求文档（FRD）

## 1. 文档信息

- 文档名称：Harbor Assistant Frontend Requirements Document
- 版本：v1.0
- 日期：2026-03-05
- 适用范围：Web 前端（Next.js + React + TypeScript）
- 关联文档：
  - [prd-executor-service.md](./prd-executor-service.md)
  - [project-api.md](./project-api.md)
  - [agent-runtime-integration.md](./agent-runtime-integration.md)

---

## 2. 背景与目标

Harbor Assistant 当前已具备项目管理基础能力与项目壳层 UI，但任务执行工作台仍处于骨架阶段。前端需要从“可演示”升级到“可稳定使用”，并对接后续独立执行层（Executor Service）。

本 FRD 的目标是明确：

1. 前端页面与信息架构
2. 用户操作流程与交互状态
3. 对后端/执行层 API 的依赖契约
4. 质量与验收标准

---

## 3. 产品定位（前端视角）

Harbor Assistant 前端是一个“本地多项目 AI 开发工作台”，核心价值是：

1. 让用户快速进入目标项目上下文
2. 发起并观察 AI 执行任务
3. 在统一 UI 中管理任务生命周期与运行反馈

---

## 4. 用户角色与使用场景

## 4.1 用户角色

1. **个人开发者（Primary）**
   - 管理多个本地仓库
   - 频繁发起 AI 代码任务并查看结果

2. **小团队工程师（Secondary）**
   - 需要任务历史、失败原因与重试路径
   - 需要统一入口切换不同执行器

## 4.2 核心场景

1. 首次进入应用，无项目时创建项目
2. 已有项目时快速切换并进入项目工作台
3. 在项目内提交任务、查看实时日志、取消/重试任务
4. 在设置页管理执行器与运行偏好

---

## 5. 信息架构与路由需求

## 5.1 顶层路由

1. `/`：Landing / 首次引导
2. `/:project_id`：项目主工作台（默认进入 task 视图）
3. `/:project_id/settings`：项目设置页
4. `/:project_id/@modal/(.)settings`：并行路由拦截的设置弹层

## 5.2 布局层级

1. App 全局布局：主题、Query Provider、全局样式
2. Project Shell 布局：
   - 左侧项目列表（Project Switcher）
   - 右侧主内容区（Task / Settings / 其他未来页面）

---

## 6. 功能需求（Functional Requirements）

## 6.1 Landing 与初始化（P0）

1. 当无项目时，显示 Landing 内容和 CTA。
2. 点击 `Get Started` 进入创建项目流程。
3. 创建成功后自动跳转到新项目页。
4. 失败时在页面内显示明确错误信息，不中断整个页面。

## 6.2 项目列表与切换（P0）

1. 侧边栏展示项目列表（名称、当前激活状态）。
2. 提供加载态 skeleton、错误态、空态。
3. 点击项目项可切换到对应项目路由。
4. “Add project” 按钮可打开添加项目模态框。

## 6.3 添加项目模态与目录选择器（P0）

1. 模态框内集成 `DirectoryPicker`。
2. 目录选择器需支持：
   - 面包屑导航
   - 键盘操作（上下选择、回车进入、Backspace 返回）
   - 加载态、空态、错误态
3. 提交时按钮禁用并显示进行中状态。
4. 选择无效路径或后端报错时需展示可读错误。

## 6.4 Task 工作台页面（P0）

1. 页面采用**单页面整合布局**（列表 + 详情同页），结构包含：
   - 顶栏（SidebarTrigger + 未来扩展入口）
   - 任务概览区（统计卡片）
   - 任务主面板（任务列表 + 详情）
2. 当前占位 UI 需升级为真实数据绑定。
3. 首版需至少支持：
   - 最近任务列表
   - 状态筛选（queued/running/completed/failed/cancelled）
   - 任务详情查看

## 6.5 任务创建与运行控制（P0）

1. 提供任务创建表单：
   - Prompt（必填）
   - Model（可选）
   - Executor（v1 固定为 `codex`，前端不提供切换器）
2. 支持创建后立即反馈（成功返回 taskId，失败给出错误原因）。
3. 支持任务取消（running/queued）。
4. 支持失败任务重试（生成新 run）。

## 6.6 任务日志与实时反馈（P0）

1. 任务详情区域显示：
   - 状态时间线
   - 标准输出（stdout）
   - 错误输出（stderr）
2. 优先支持 SSE 实时流；未接入 SSE 前可临时轮询降级。
3. 日志过长时需分页/虚拟滚动策略，避免页面卡顿。

## 6.7 执行器与模型策略（P1）

1. v1 执行器固定为 `codex`，仅展示 codex 能力状态（installed/version）。
2. 模型输入在 v1 允许手动输入，不强依赖多执行器模型下拉。
3. 当 codex 不可用时，给出明确引导（安装/配置提示）。
4. 多执行器切换能力在后续版本启用（不纳入 v1 交付）。

## 6.8 设置页（P1）

1. 展示项目级运行配置（并发上限、日志策略、默认模型占位）。
2. 支持 MCP 开关入口（延续已有 action 能力）。
3. 支持在 modal 与 full-page 两种打开方式下保持一致行为。
4. “每项目默认模型”能力在本阶段以 mock 交互呈现，不做持久化写入。

## 6.9 Task 详细需求文档（P0）

1. task 前端详细需求拆分为独立文档：[frd-task-frontend.md](./frd-task-frontend.md)
2. 本文保留任务相关总览范围，详细交互与验收标准以独立 task FRD 为准。

---

## 7. 状态与交互规范

## 7.1 状态分层

1. 页面级状态：loading / ready / error
2. 模块级状态：list empty / partial loading / partial error
3. 操作级状态：submitting / success / failure / retrying

## 7.2 错误处理规范

1. API 错误必须映射为用户可理解文案。
2. 网络错误、业务错误、权限错误需区分展示。
3. 错误提示应支持“重试”操作，不要求用户刷新全页。

## 7.3 反馈与可见性

1. 用户操作后 150ms 内必须有视觉反馈（按钮 loading / skeleton / toast）。
2. 长任务必须持续展示“运行中”信号（状态标签、进度心跳或更新时间）。

---

## 8. 前端数据契约与接口依赖

## 8.1 现有依赖（已存在）

1. `GET /v1/projects`
2. `POST /v1/projects`
3. `PATCH /v1/projects/:id`
4. `DELETE /v1/projects/:id`
5. `GET /v1/projects/:id/settings`
6. `PATCH /v1/projects/:id/settings`
7. `POST /v1/projects/:id/archive`
8. `POST /v1/projects/:id/restore`
9. `POST /v1/projects/:projectId/files/list`
10. `GET /v1/agents/capabilities`

## 8.2 新增依赖（执行层接入后）

1. `POST /v1/tasks`
2. `GET /v1/projects/:projectId/tasks`
3. `GET /v1/tasks/:taskId`
4. `GET /v1/tasks/:taskId/events`（SSE）
5. `POST /v1/tasks/:taskId/break`
6. `POST /v1/tasks/:taskId/retry`

## 8.3 类型约束

1. 前后端共享 TypeScript 类型定义（建议 `zod schema + inferred type`）。
2. 前端不得依赖“隐式字段”；所有渲染字段需显式声明与兜底。

---

## 9. 非功能需求（前端）

## 9.1 性能

1. 首屏可交互时间（本地环境）目标 < 2s。
2. 任务日志渲染需避免一次性挂载超长文本。
3. 列表请求默认分页，避免全量拉取。

## 9.2 可用性

1. 关键路径（创建项目、创建任务、查看运行状态）必须支持键盘操作。
2. 表单字段与按钮需具备可访问名称（ARIA）。
3. 错误提示应可被屏幕阅读器识别（`aria-live` 建议）。

## 9.3 兼容性

1. 支持现代 Chromium、Safari、Firefox 最新两个大版本。
2. 在无 SSE 能力场景下可降级轮询模式。

## 9.4 国际化

1. 首版可中文优先，但文案应抽离到统一文本层，避免硬编码分散。
2. 错误码与展示文案映射独立维护，支持后续多语言切换。

---

## 10. 设计与组件规范

1. 基础组件沿用现有 `src/components/ui/*` 体系。
2. 任务相关模块化组织建议：
   - `src/modules/tasks/components/*`
   - `src/modules/tasks/hooks/*`
   - `src/modules/tasks/types/*`
3. 状态管理优先：
   - 服务端状态：TanStack Query
   - 交互局部状态：组件内 state 或局部 Zustand store

---

## 11. 埋点与可观测性需求

1. 关键事件埋点：
   - `project_create_clicked`
   - `project_created`
   - `task_create_submitted`
   - `task_create_failed`
   - `task_break_clicked`
   - `task_retry_clicked`
2. 每次任务创建、break、重试操作必须带 `projectId` 与 `taskId`（若可用）。
3. 前端错误日志应包含 route、action、errorCode。

---

## 12. 验收标准（MVP）

1. 用户可从 Landing 完成项目创建并自动进入项目页。
2. 用户可在项目内创建任务并看到状态变化。
3. 用户可查看任务输出并识别成功/失败原因。
4. 用户可 break 运行中 turn，状态可正确收敛为终态。
5. 主要路径在加载态、空态、错误态下均可工作且不崩溃。

---

## 13. 里程碑建议

## Milestone 1（P0）

- Landing + Project Shell + Add Project 流程稳定
- Progress 页接入真实任务列表
- 任务创建 + 基础状态展示

## Milestone 2（P0+）

- 任务详情 + 实时日志流（SSE）
- 取消/重试闭环
- 错误码到文案映射完善

## Milestone 3（P1）

- codex 能力可视化与模型体验优化
- 设置页能力补齐
- 埋点与前端可观测性落地

---

## 14. 已确认决策（2026-03-05）

1. Progress 页面采用单页面整合（列表 + 详情同页）。
2. v1 执行器固定为 `codex`，暂不支持多 executor 切换。
3. 任务历史筛选器需要纳入前端（至少支持时间范围与状态）。
4. 设置页“每项目默认模型”先以 mock 形态提供，暂不接入持久化。
