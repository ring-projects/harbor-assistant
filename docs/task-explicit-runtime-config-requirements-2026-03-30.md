# Task Explicit Runtime Config Requirements

## 1. 文档信息

- 文档名称：Task Explicit Runtime Config Requirements
- 日期：2026-03-30
- 状态：Proposed Canonical Design
- 适用范围：
  - `apps/service/src/modules/project`
  - `apps/service/src/modules/task`
  - `apps/service/src/lib/agents`
  - `apps/web/src/modules/tasks`
- 关联文档：
  - [task-api.md](./task-api.md)
  - [task-resume-runtime-overrides-requirements-2026-03-30.md](./task-resume-runtime-overrides-requirements-2026-03-30.md)
  - [task-effort-requirements-2026-03-29.md](./task-effort-requirements-2026-03-29.md)
  - [task-runtime-system-design-2026-03-23.md](./task-runtime-system-design-2026-03-23.md)
  - [tdd/task.md](./tdd/task.md)
  - [tdd/task-explicit-runtime-config.md](./tdd/task-explicit-runtime-config.md)

## 2. 背景

当前 Harbor 的 task runtime 配置来源混杂了三层语义：

1. `Project.settings.execution` 中的项目默认配置
2. `create task / resume task` 请求中显式传入的 runtime 参数
3. task 应用层与校验层中的额外 fallback / resolve 逻辑

在当前实现中：

1. project domain 创建时会注入默认值：
   - `defaultExecutor = "codex"`
   - `defaultModel = null`
   - `defaultExecutionMode = "safe"`
2. project 持久化映射层也会继续补同样的默认值
3. `createTaskUseCase` 会在请求未传值时继续回退到 project 默认值，随后再回退到硬编码默认值
4. `resumeTaskUseCase` 会在 task snapshot、请求 override、capabilities 默认模型之间继续做解析
5. 前端因此不得不展示 `Runtime Default` / `Provider Default` 一类占位语义，而不是明确的当前值

这会造成以下产品与实现问题：

1. project 配置层和 runtime 决策层耦合，项目对象本身携带了隐式执行策略
2. create / resume 请求即使没有传完整 runtime 参数，也会在后端被补出一个“可运行结果”
3. 前端很难解释当前页面上看到的值到底是“用户显式配置”，还是“系统临时推导”
4. model 与 effort 的显示值和最终执行值之间存在断层
5. 后端为了维持“默认可运行”，被迫在多个模块中保留 fallback 逻辑，增加系统不确定性

本轮需要把这套隐式默认解析收敛掉，使 runtime config 的 source of truth 回到 task create / resume contract。

## 3. 目标

本需求文档定义的目标如下：

1. 删除 project 层对 task runtime 的隐式默认配置注入
2. 要求 create task 时显式传入完整 runtime config
3. 让后端只负责 runtime config 的合法性校验，而不是替调用方做默认解析
4. 让前端在进入创建 / resume 场景时就决定并展示明确的 `executor / model / effort / executionMode`
5. 让 task snapshot 从创建开始就持有明确 runtime 值，避免 `default / auto / null` 进入展示层
6. 为后续继续保留 resume override 能力提供更清晰的 contract 基础

## 4. 非目标

本次改造不处理以下问题：

1. 不重新设计 provider capability 协议
2. 不在本轮让后端提供“resolved default runtime config”接口
3. 不在本轮讨论多端入口之间如何共享同一套前端默认策略
4. 不改变 Codex / Claude Code adapter 的底层 provider 集成方式
5. 不在本轮支持 create / resume 切换 executor session 的语义
6. 不把项目设置页扩展成 runtime policy 配置中心

## 5. 核心判断

### 5.1 project 不应承担 runtime 默认解析职责

`Project.settings.execution` 的职责应当是：

1. 表达项目被用户显式保存的设置
2. 支撑项目设置页的配置读写
3. 不为 task create / resume 提供隐式 runtime fallback

因此：

1. project domain 创建时不应自动注入 `codex / safe / null` 作为 task runtime 默认值
2. project 持久化映射层不应把数据库中的空值重新补成 runtime 默认值
3. create / resume 的 runtime 决策应当从 project 剥离出去

### 5.2 create contract 应成为 runtime config 的 source of truth

从产品语义上，task 在创建时就应该拥有明确 runtime snapshot。

因此 create contract 应满足：

1. `executor` 明确
2. `model` 明确
3. `effort` 明确
4. `executionMode` 明确

后端不再接受“缺字段后再自动补默认”的创建方式。

### 5.3 默认值选择属于前端产品层，而不是后端领域层

本次方案不否认系统仍然需要“默认值选择”。

但这层默认值的职责应当明确归属前端产品层：

1. 前端在页面初始化时决定要预选什么 executor / model / effort / executionMode
2. 用户看到的是明确值，而不是 `default` / `auto`
3. 前端提交给后端的是完整 runtime config
4. 后端只校验这些显式值是否合法

也就是说：

1. 默认值仍然存在
2. 但它不再是 project domain 或 task application 内部的 fallback 逻辑
3. 它是前端创建体验的一部分

### 5.4 effort 与 model 应使用同一产品策略

本轮不再把 `effort` 当成需要特殊对待的“半隐式字段”。

判断如下：

1. 如果产品要求打开页面就展示明确值，那么 `effort` 和 `model` 一样，也必须在前端先被选定
2. 后端不再通过 `null` 表达“provider default effort”并把它暴露到展示层
3. create contract 中的 `effort` 与 `model` 一样，都属于明确 runtime snapshot 的组成部分

### 5.5 后端仍然保留合法性校验，而不是完全无脑直通

虽然本次要删除默认解析，但后端仍需保留：

1. executor 是否受支持
2. model 是否属于当前 executor
3. effort 是否被当前 model 支持
4. executionMode 是否属于允许枚举值

因此本次收敛的是 fallback / resolve，不是校验。

## 6. 目标设计

### 6.1 project execution settings 的边界收敛

`Project.settings.execution` 在本轮之后应满足：

1. 保持字段结构兼容，避免一次性扩大 project 模块改动面
2. 默认值应为 `null`，而不是隐式 runtime 选择
3. 这些字段只表示“项目显式配置”，不参与 create task fallback

最小语义变化如下：

1. `defaultExecutor: null`
2. `defaultModel: null`
3. `defaultExecutionMode: null`

如果未来确认 project 层不再需要这些字段，可以再做后续 schema 收敛；本轮先去除它们在 runtime path 中的影响。

### 6.2 create task contract 收敛

`POST /v1/tasks` 应调整为要求显式 runtime config：

1. `executor` 必填
2. `model` 必填
3. `effort` 必填
4. `executionMode` 必填

create task 的业务语义调整为：

1. 前端必须在发请求前完成 runtime config 选择
2. 后端不再从 project 或应用层 fallback 中补齐缺项
3. 如果字段缺失，直接返回请求错误

### 6.3 resume task contract 保持 override 语义，但不再暴露 default 占位态

本轮 focus 仍然是 create contract 收敛；resume 继续允许覆盖 `model / effort`。

但随着 create snapshot 变成明确值，resume 语义也会更清楚：

1. task 自身始终持有明确的 `executor / model / effort / executionMode`
2. resume 若不传 override，则沿用 task 当前 snapshot
3. resume 若传 override，则覆盖为新的明确值
4. 前端不需要再展示 `default / auto`

### 6.4 capability 的职责

后端 capability 仍然保留，职责如下：

1. 为前端提供可选 executor / model / effort 候选集
2. 为后端提供 create / resume 的组合合法性校验依据
3. 不再承担“把空值补成最终 runtime 值”的职责

## 7. 功能需求

### FR-1 project domain 不再注入 runtime 默认值

1. 创建 project 时，`settings.execution.defaultExecutor` 默认为 `null`
2. 创建 project 时，`settings.execution.defaultModel` 默认为 `null`
3. 创建 project 时，`settings.execution.defaultExecutionMode` 默认为 `null`
4. project mapper 不再把数据库空值回填为 `codex` 或 `safe`

### FR-2 create task 请求必须显式提供完整 runtime config

1. `POST /v1/tasks` 请求体必须包含 `executor`
2. `POST /v1/tasks` 请求体必须包含 `model`
3. `POST /v1/tasks` 请求体必须包含 `effort`
4. `POST /v1/tasks` 请求体必须包含 `executionMode`
5. 缺失任一字段时，返回明确的请求错误

### FR-3 create task 应用层不再从 project fallback runtime config

1. `createTaskUseCase` 不再读取 project.settings 中的 runtime 默认值用于兜底
2. `createTaskUseCase` 不再回退到硬编码的 `codex` / `safe`
3. `createTaskUseCase` 只接受请求中显式传入的 runtime config
4. `createTaskUseCase` 仍调用统一的 runtime 校验逻辑

### FR-4 task snapshot 从创建开始就持有明确 runtime 值

1. 新创建 task 的 `executor` 不能为空
2. 新创建 task 的 `model` 不能为空
3. 新创建 task 的 `effort` 不能为空
4. 新创建 task 的 `executionMode` 不能为空
5. task detail / task list 不再依赖 `default` 占位文案解释这些字段

### FR-5 后端保留组合校验

1. 不支持的 executor 仍应拒绝
2. executor 下不存在的 model 仍应拒绝
3. model 不支持的 effort 仍应拒绝
4. 非法 executionMode 仍应拒绝

## 8. API 变更

### 8.1 `POST /v1/tasks`

当前 create 请求允许：

1. 只传 `prompt`
2. 或只传 `items`
3. 同时省略一部分 runtime config，让后端补齐

本轮之后应调整为：

1. 仍允许 `prompt` 或 `items` 作为输入内容
2. 但 runtime config 字段必须完整：
   - `executor`
   - `model`
   - `effort`
   - `executionMode`

示例：

```json
{
  "projectId": "project-1",
  "items": [
    { "type": "text", "text": "Investigate the failing CI pipeline." }
  ],
  "executor": "codex",
  "model": "gpt-5.3-codex",
  "effort": "medium",
  "executionMode": "safe"
}
```

### 8.2 `POST /v1/tasks/:taskId/resume`

本轮不要求 resume 立即变成所有 runtime 字段必传，但它应继续遵守：

1. task 当前 snapshot 是明确值
2. override 后的新 snapshot 仍是明确值
3. 前端展示不再依赖 `default / auto`

## 9. 实施边界

### 9.1 后端最小改动原则

为了避免临时且过度复杂的设计，本轮后端改造应遵守：

1. 优先删除隐式默认与 fallback
2. 不新增“resolved runtime config”这一套新 read model 概念
3. 不额外引入 project-level runtime resolver
4. 不新增 provider default inference API
5. 让 create contract 直接成为 runtime snapshot 的来源

### 9.2 前端职责边界

虽然本文件主要讨论后端边界，但本方案成立的前提是前端承担如下职责：

1. 在 create 页面初始化时预选一个明确 executor
2. 在 executor 已知时预选一个明确 model
3. 在 model 已知时预选一个明确 effort
4. 在页面展示层只显示明确值，不显示 `default / auto`

## 10. 验收标准

### AC-1 project 默认配置不再参与 runtime path

1. 新 project 创建后，execution 默认字段均为 `null`
2. project mapper 返回的 execution 默认字段不会被自动补成 `codex` / `safe`
3. create task 不再读取这些字段用于 fallback

### AC-2 create task 必须显式传递完整 runtime config

1. 缺失 `executor` 的 create 请求失败
2. 缺失 `model` 的 create 请求失败
3. 缺失 `effort` 的 create 请求失败
4. 缺失 `executionMode` 的 create 请求失败
5. 完整请求成功时，task detail 中四个字段均为明确值

### AC-3 后端不再保留 create runtime fallback

1. 删除从 project settings fallback 到 create runtime 的路径
2. 删除从硬编码 `codex / safe` fallback 到 create runtime 的路径
3. 代码审阅中不存在“create task 未传 runtime 仍可成功”的实现路径

### AC-4 展示层不再需要 default / auto 语义

1. create 后返回的 task detail 中，`executor / model / effort / executionMode` 均为明确值
2. 前端可以直接显示这些值，不需要解释为 `default / auto`

## 11. 风险与取舍

### 11.1 优点

1. runtime config source of truth 明确
2. project 与 task 的职责边界更清晰
3. 后端代码路径减少，不再需要多层 resolve
4. 前端展示语义与执行语义更一致

### 11.2 代价

1. create contract 变严格，所有调用方都要补齐参数
2. 前端初始化逻辑需要真正承担默认值预选职责
3. 现有测试需要整体调整为显式 runtime config

### 11.3 本轮取舍

本轮接受这些代价，因为它们换来的是更清晰、长期可维护的系统边界，而不是继续在后端保留隐式 fallback。
