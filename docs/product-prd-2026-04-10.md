# Harbor Assistant Product Requirements Document

## 1. 文档信息

- 文档名称：Harbor Assistant Product Requirements Document
- 日期：2026-04-10
- 状态：Accepted
- 适用范围：
  - 当前产品定义与模块边界
  - `apps/web`
  - `apps/service`
- 关联文档：
  - [./backend-lite-ddd-design-2026-03-24.md](./backend-lite-ddd-design-2026-03-24.md)
  - [./auth-user-service-design-2026-04-01.md](./auth-user-service-design-2026-04-01.md)
  - [./workspace-foundation-requirements-2026-04-06.md](./workspace-foundation-requirements-2026-04-06.md)
  - [./project-dual-source-requirements-2026-04-02.md](./project-dual-source-requirements-2026-04-02.md)
  - [./workspace-github-integration-requirements-2026-04-06.md](./workspace-github-integration-requirements-2026-04-06.md)
  - [./orchestration-requirements-2026-03-31.md](./orchestration-requirements-2026-03-31.md)
  - [./task-runtime-requirements-2026-04-10.md](./task-runtime-requirements-2026-04-10.md)
  - [./task-api.md](./task-api.md)
  - [./project-api.md](./project-api.md)

## 2. 产品概述

Harbor Assistant 是一个用于组织和执行 AI 开发任务的工作台产品。

它不是单纯的本地仓库聊天工具，也不是浏览器内 IDE，而是一个围绕工作容器、任务执行和协作归属构建的 agent orchestration workspace。

当前产品主链路为：

```text
Workspace -> Project -> Orchestration -> Task
```

## 3. 产品目标

1. 让用户能够在统一工作台中管理多个项目与代码源。
2. 让用户能够围绕一个工作主题组织多个 AI 任务，而不是只运行单次对话。
3. 让任务具备可执行、可恢复、可追踪、可配置的运行能力。
4. 让项目逐步具备多人共享、成员协作和共享代码源接入能力。
5. 为后续知识沉淀、文档协作和自动化编排提供统一产品模型。

## 4. 核心产品对象

1. `Workspace`
   产品的归属边界，承载成员关系和未来协作能力。
2. `Project`
   内容与执行上下文容器，承载项目来源、设置和运行边界。
3. `Orchestration`
   用户的一级工作对象，表达一项持续推进的工作主题。
4. `Task`
   用户直接交互的执行单元，承载 prompt、配置、状态、事件和输出。

## 5. 当前产品模块

### 5.1 账号与访问

1. GitHub OAuth 登录
2. 用户会话管理
3. 资源访问控制
4. 从 owner-scoped 向 workspace membership 的访问边界迁移

### 5.2 工作区协作

1. Workspace 创建与读取
2. Personal Workspace / Team Workspace 区分
3. Membership 关系模型
4. Workspace 成员列表
5. Team Workspace 成员添加、移除与邀请

### 5.3 项目与项目源

1. 项目创建、读取、列表、切换
2. 项目设置管理
3. 项目归档与恢复
4. 项目源建模：
   `local path`
   `git`
5. 支持本地目录、GitHub 仓库、手动 git URL 三类入口

### 5.4 GitHub / 代码源集成

1. GitHub App installation 接入
2. Workspace 级 installation 关联
3. 仓库读取与仓库绑定
4. Git-backed project 的 workspace provision
5. Git 项目同步能力

### 5.5 编排中心

1. Orchestration 创建与列表
2. 在 Project 下组织多个 Orchestration
3. 在单个 Orchestration 下组织多个 Task
4. 以 Orchestration 作为一级工作容器

### 5.6 任务执行工作台

1. Task 创建
2. Task 对话交互
3. Task 实时事件流
4. Task 运行状态管理
5. Task cancel / resume
6. 显式 runtime 配置：
   `executor`
   `model`
   `executionMode`
   `effort`

### 5.7 知识文档

1. requirements、plan、review、final report 等知识对象
2. 与 project / task 的稳定关联
3. 当前已进入设计与后端实现方向，但尚不是前台主入口模块

## 6. 当前版本主流程

1. 用户登录 Harbor。
2. 进入某个 Workspace。
3. 创建或选择一个 Project。
4. 为项目接入本地目录或 GitHub 仓库。
5. 在项目下创建一个 Orchestration。
6. 在 Orchestration 下创建并执行 Task。
7. 查看 Task 实时输出。
8. 对 Task 继续追问、恢复执行或新建同级 Task。
9. 在同一 Workspace 内与团队成员共享项目与代码源能力。

## 7. 当前版本范围

### P0

1. 登录与基础访问控制
2. Workspace 基础模型与成员管理闭环
3. 项目管理与项目源建模
4. GitHub 集成与仓库绑定
5. Orchestration 列表与创建
6. Task 工作台、实时事件、resume/cancel
7. Task 显式 runtime 配置

### P1

1. Workspace-first 的完整前端导航重构
2. 更完整的团队协作体验
3. 文档能力前台化
4. Schedule / 自动化触发能力产品化

## 8. 当前不做

1. 复杂 RBAC
2. Project 级细粒度 ACL
3. 复杂树状工作流引擎
4. 邀请未注册用户之外的更重协作流程
5. 浏览器内 IDE 式替代体验

## 9. 一句话总结

Harbor 当前是一个以 `Workspace` 为归属边界、以 `Project` 为内容容器、以 `Orchestration` 为工作容器、以 `Task` 为执行单元的 AI 编排工作台。
