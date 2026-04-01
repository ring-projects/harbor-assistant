# Orchestration TDD Plan

## 1. 文档信息

- 文档名称：Orchestration TDD Plan
- 日期：2026-04-01
- 状态：Proposed
- 适用范围：
  - `apps/service/src/modules/orchestration`（future）
  - orchestration / task / schedule / runtime 新边界下的后端测试策略
- 关联文档：
  - [../orchestration-requirements-2026-03-31.md](../orchestration-requirements-2026-03-31.md)
  - [../backend-lite-ddd-design-2026-03-24.md](../backend-lite-ddd-design-2026-03-24.md)
  - [../task-runtime-system-design-2026-03-23.md](../task-runtime-system-design-2026-03-23.md)
  - [../service-database-schema-design-2026-03-25.md](../service-database-schema-design-2026-03-25.md)
  - [../interaction-context-design-2026-03-24.md](../interaction-context-design-2026-03-24.md)

## 2. 目标

这份文档只规划最终方案如何按 TDD 推进。

目标只有五个：

1. 先把 `orchestration` 的容器语义锁成测试
2. 再把 `task` 作为用户可交互工作对象的语义锁成测试
3. 明确运行状态直接并入 task，而不是再引入独立 execution 领域对象
4. 通过稳定 port 消费内部 runtime 执行层，而不是扩张新的产品对象
5. 保证前端主 contract 围绕 orchestration / task，而不是底层运行记录

这里默认采用的设计前提是：

1. `Orchestration` 是用户一级工作容器
2. `Task` 是用户可以直接交互的工作对象
3. 运行状态、事件关联与配置摘要直接归 task 所有
4. `Runtime` 拥有 provider session 与 raw events
5. `Interaction` 只消费 orchestration / task-facing notification / read model

## 3. TDD 总原则

新的 orchestration module 必须坚持一条底线：

先定义 orchestration 与 task 的业务语义测试，再写 runtime 接线细节。

推荐顺序：

1. domain tests
2. application command / query tests
3. orchestration-to-task facade tests
4. task-to-runtime facade tests
5. repository / projection tests
6. route tests
7. cross-context integration tests

不建议的顺序：

1. 先复制现有 task route 再硬包一层 orchestration
2. 先扩展 runtime adapter，再回头定义 orchestration aggregate
3. 先设计底层运行记录 API，再反推 task 语义

原因很简单：

最终方案的核心复杂度不在 HTTP，也不在 provider runtime，而在：

1. orchestration identity
2. orchestration 对多个 task 的组织语义
3. task 作为用户交互对象的边界
4. task 与 runtime 的边界
5. schedule 与 orchestration / task 的关系

## 4. 实现范围约束

最终方案下的 TDD 代码应满足：

1. 用户主流程的新测试与实现都落在 `apps/service/src/modules/orchestration`
2. `apps/service/src/modules/task` 继续承载用户可交互 task 的主体语义
3. runtime 只承担内部执行能力时，才允许补测试与实现
4. 不把 orchestration 逻辑回填进 route glue 或 interaction 层
5. 不再新引入独立 execution 领域对象

## 5. 测试分层

### 5.1 Domain tests

测试对象：

1. `Orchestration`
2. orchestration-task 关系不变量
3. schedule-to-task 关系不变量

这一层只验证业务规则，不碰：

1. Prisma
2. Fastify
3. websocket
4. provider runtime
5. runtime persistence mapping

Domain 层至少应锁住以下语义：

1. orchestration 创建时具有合法默认状态
2. orchestration 可以包含多个同级 task
3. task 必须归属于某个 orchestration
4. task 的轻量来源关系合法
5. schedule 只能绑定 orchestration
6. schedule 每次触发只创建新的 task

### 5.2 Application tests

测试对象：

1. `CreateOrchestration`
2. `GetOrchestrationDetail`
3. `ListOrchestrations`
4. `CreateOrchestrationTask`
5. `ListOrchestrationTasks`
6. `GetTaskDetail`
7. `SendTaskMessage`
8. `CancelTask`
9. `CreateSchedule`
10. `PauseSchedule`
11. `ResumeSchedule`
12. `TriggerScheduledTask`

这一层验证：

1. use case 编排
2. orchestration 与 task repository / port 的调用时机
3. task 与 runtime port 的调用边界
4. schedule trigger port 的消费边界
5. 错误分层与返回 read model
6. 前端主 contract 不围绕底层运行记录

### 5.3 Facade / Port tests

测试对象：

1. orchestration 对 task creation port 的调用
2. task 对 runtime port 的调用
3. orchestration 对 notification port 的 outward boundary
4. orchestration 对 schedule trigger port 的消费

这层的目标是：

1. 不让 orchestration 直接依赖 runtime raw protocol
2. 不让 orchestration 直接绑定旧 task route contract
3. 不让 task 直接暴露 raw runtime state 给前端
4. 通过稳定 port 把内部执行层隔离开

### 5.4 Repository / Projection tests

测试对象：

1. `OrchestrationRepository`
2. orchestration list / detail projection
3. orchestration-task list projection
4. task-facing projection

这层只验证：

1. aggregate 读写正确
2. orchestration 与 task 关联正确
3. 默认列表不回流底层运行记录语义
4. 用户主视图围绕 orchestration 与 task，而不是 runtime 明细

### 5.5 Route tests

测试对象：

1. `POST /orchestrations`
2. `GET /orchestrations`
3. `GET /orchestrations/:orchestrationId`
4. `POST /orchestrations/:orchestrationId/tasks`
5. `GET /orchestrations/:orchestrationId/tasks`
6. `GET /tasks/:taskId`
7. `POST /tasks/:taskId/messages`
8. `POST /tasks/:taskId/cancel`
9. `POST /orchestrations/:orchestrationId/schedules`
10. `POST /schedules/:scheduleId/pause`
11. `POST /schedules/:scheduleId/resume`

这一层只验证：

1. schema validation
2. route 到 application use case 的接线
3. orchestration-facing 与 task-facing response contract
4. 底层运行记录不作为前端主 contract 暴露

### 5.6 Integration tests

测试对象：

1. orchestration 创建 task 的主流程
2. task 与 runtime 接线的主流程
3. runtime 结果回流 task 状态
4. schedule 触发 orchestration 下的新 task
5. interaction 消费 orchestration / task notification

这层不追求全覆盖，只覆盖最关键跨边界行为。

## 6. 红绿灯开发节奏

每一阶段都遵守：

1. 先写失败测试
2. 再补最小实现让测试变绿
3. 最后做必要重构，不扩边界

### 6.1 第一盏灯：Orchestration 聚合纯规则

先写红灯测试：

1. 创建 orchestration 时具备合法默认状态
2. orchestration title / description / defaultPrompt / defaultConfig 合法
3. archived orchestration 不能继续被新 schedule 绑定
4. orchestration identity 更新不影响其下 task 关系

变绿目标：

1. orchestration aggregate 稳定
2. 不引入 task / runtime / repository 依赖

### 6.2 第二盏灯：Task 归属与组织规则

先写红灯测试：

1. orchestration 下可以挂多个 task
2. task 必须归属于某个 orchestration
3. task 默认是同级对象
4. task 允许轻量来源关系，但不允许升级成复杂树模型

变绿目标：

1. orchestration 对 task 的组织语义稳定
2. 主模型不滑向 workflow tree

### 6.3 第三盏灯：Task 作为用户交互对象

先写红灯测试：

1. task 创建时具备 prompt / title / status 等合法默认值
2. task 可以继续接收消息
3. task 可以取消
4. task 详情能返回用户关心的状态、摘要与输出

变绿目标：

1. task 的产品语义稳定
2. task 能明确承担用户直接交互对象职责

### 6.4 第四盏灯：Task 到 Runtime 的内部边界

先写红灯测试：

1. 创建 task 时会初始化其运行字段或 runtime 关联
2. task resume / cancel 通过 runtime port 落到底层执行
3. runtime 状态变化能回流 task 状态
4. task 事件流能稳定承载用户侧会话展示

变绿目标：

1. task 与 runtime 的边界稳定
2. 不再需要单独的 execution 领域状态机
3. task 不直接依赖 raw runtime event 协议

### 6.5 第五盏灯：主读模型

先写红灯测试：

1. `listOrchestrations` 返回用户可见工作项
2. `getOrchestrationDetail` 返回编排详情与 task 摘要
3. `listOrchestrationTasks` 返回该容器下的 task 列表
4. 默认 detail 不回流 runtime 技术字段过多细节

变绿目标：

1. 主工作台 contract 稳定
2. 底层运行明细不成为前端主 contract

### 6.6 第六盏灯：schedule 语义

先写红灯测试：

1. schedule 触发新的 task
2. schedule 使用固定 prompt 与 config
3. schedule 失败不会破坏 orchestration identity
4. schedule 触发出的 task 能正常进入后续交互流程

变绿目标：

1. 定时触发入口与 orchestration / task 关系稳定

### 6.7 第七盏灯：route / integration

先写红灯测试：

1. orchestration route schema validation
2. orchestration 下创建 task 的接线稳定
3. task 与 runtime 的接线稳定
4. interaction 能收到 orchestration / task notification
5. runtime error 能稳定映射到 task 状态

变绿目标：

1. 对外 contract 和跨上下文接线稳定

## 7. 推荐的最小测试清单

### 7.1 Domain

1. `createOrchestration()`
2. `archiveOrchestration()`
3. `attachTaskToOrchestration()`
4. `createScheduleForOrchestration()`
5. `createTaskSourceRelation()`

### 7.2 Application

1. `createOrchestrationUseCase`
2. `getOrchestrationDetailUseCase`
3. `listOrchestrationsUseCase`
4. `createOrchestrationTaskUseCase`
5. `listOrchestrationTasksUseCase`
6. `getTaskDetailUseCase`
7. `sendTaskMessageUseCase`
8. `cancelTaskUseCase`
9. `createScheduleUseCase`
10. `triggerScheduledTaskUseCase`

### 7.3 Integration

1. orchestration creates task correctly
2. task starts runtime correctly
3. runtime completion updates task state
4. runtime failure can be surfaced as task failure
5. schedule creates new task under orchestration

## 8. 命名与边界约束

最终方案下的 TDD 命名应遵守：

1. 用户一级对象统一叫 `orchestration`
2. 用户可交互工作对象继续叫 `task`
3. 不再新增独立 `execution` 领域对象
4. 不再新增任何 execution-facing 的产品命名
5. 不把 task 主模型重命名成 execution

## 9. 一句话结论

orchestration-centered 方案的 TDD 顺序，必须先锁住 orchestration 作为工作容器，再锁住 task 作为用户工作对象，最后才让 runtime 承接内部执行。

也就是说：

```text
first lock orchestration as the work container,
then keep task as the user-facing work object,
and only then let runtime serve the internal execution path.
```

## 10. 与实施阶段对齐的 TDD 顺序

本节用于把 `docs/orchestration-requirements-2026-03-31.md` 中的“新需求开发步骤”映射成具体的测试推进顺序，避免开发步骤和 TDD 节奏脱节。

### 10.1 阶段 0：冻结目标模型

这一阶段不要求写大量自动化测试，但需要先补两类保护性测试：

1. 命名与边界 smoke tests
2. orchestration / task contract snapshot tests

目标：

1. 防止后续继续新增 execution-facing 产品接口
2. 防止 orchestration / task 的命名在实现中继续漂移

### 10.2 阶段 1：数据模型落地

此阶段的测试重点应是 repository 与 schema 层。

优先测试：

1. `Orchestration` 能被创建与读取
2. `Task` 新增 `orchestrationId` 后仍能正确读写
3. 旧 task 数据在迁移后仍能被稳定读取
4. 以 `orchestrationId` 查询 task 列表可用

建议先写：

1. Prisma repository tests
2. migration verification tests
3. task mapper compatibility tests

### 10.3 阶段 2：orchestration 后端能力立起

此阶段的测试重点应是 orchestration application 层。

优先测试：

1. `createOrchestrationUseCase`
2. `getOrchestrationDetailUseCase`
3. `listProjectOrchestrationsUseCase`
4. `createOrchestrationTaskUseCase`
5. `listOrchestrationTasksUseCase`

目标：

1. 先确保 orchestration 已能成为新的服务端业务入口
2. 先不要让 schedule 或 runtime 复杂度混进这一阶段

### 10.4 阶段 3：task 归属切换

此阶段的测试重点应是 task 的归属与查询语义切换。

优先测试：

1. 新 task 必须带 `orchestrationId`
2. 旧 project 维度查询仍可兼容
3. 新 orchestration 维度查询返回结果正确
4. task 来源关系字段不会把主模型拉成树结构

目标：

1. 确保 task 已真正挂到 orchestration 下
2. 确保兼容路径不会阻断新模型推进

### 10.5 阶段 4：前端主导航切到 orchestration

此阶段的测试重点应是读模型与前端契约。

优先测试：

1. orchestration list query contract
2. orchestration detail query contract
3. orchestration 下的 task list contract
4. 复用现有 task session panel 时的最小兼容测试

目标：

1. 让前端先完成容器化切换
2. 避免在这一阶段大改 task 会话区而导致测试面爆炸

### 10.6 阶段 5：schedule 落地

此阶段的测试重点应是 schedule 与 task 的关系，而不是 runtime 深处。

优先测试：

1. schedule 创建成功
2. schedule pause / resume 生效
3. schedule 每次触发创建新的 task
4. schedule 使用固定 prompt 与 config
5. schedule 失败不破坏 orchestration identity

目标：

1. 把 schedule 锁成“创建 task 的触发器”
2. 避免 schedule 越界成复杂流程编排器

### 10.7 阶段 6：task 运行态收口

此阶段的测试重点应是把当前运行状态语义逐步收口到 task。

优先测试：

1. `Task.status` 成为唯一用户可见状态来源
2. `waiting` 语义能稳定表达等待输入状态
3. task detail 能返回最终需要的运行态摘要
4. runtime 错误能稳定映射到 task 状态与 task 事件流

目标：

1. 减少当前实现中的双状态源问题
2. 让 task 模型与最终文档更一致

### 10.8 阶段 7：兼容清理

此阶段的测试重点应是兼容性与回归风险控制。

优先测试：

1. 旧 project-task 接口兼容行为
2. 新 orchestration-task 接口行为
3. interaction 对新旧路径的最小兼容
4. 文档中声明的 canonical 接口具备稳定 contract

目标：

1. 让旧路径安全降级为兼容层
2. 防止未来新需求又写回旧路径

### 10.9 推荐的测试优先级

如果开发资源有限，建议按以下顺序优先补测试：

1. orchestration repository / use case tests
2. orchestration-task relation tests
3. orchestration-facing route tests
4. schedule-to-task tests
5. task runtime convergence tests
6. 旧路径兼容 tests

### 10.10 一句话建议

```text
让测试顺序服从实施顺序：
先把容器立住，
再把 Task 挂进去，
再把 schedule 接进来，
最后再收口运行态。
```
