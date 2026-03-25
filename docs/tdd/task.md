# Task TDD 红绿灯计划

## 1. 文档信息

- 文档名称：Task TDD 红绿灯计划
- 日期：2026-03-25
- 状态：Proposed
- 适用范围：
  - `task` context
  - future `apps/service/src/modules/task`
- 关联文档：
  - [../task-context-design-2026-03-25.md](../task-context-design-2026-03-25.md)
  - [../backend-lite-ddd-design-2026-03-24.md](../backend-lite-ddd-design-2026-03-24.md)
  - [../task-runtime-system-design-2026-03-23.md](../task-runtime-system-design-2026-03-23.md)
  - [../service-database-schema-design-2026-03-25.md](../service-database-schema-design-2026-03-25.md)
  - [../interaction-context-design-2026-03-24.md](../interaction-context-design-2026-03-24.md)

## 2. 目标

这份文档只规划新的 `task` module 如何按 TDD 推进，不讨论 `runtime` 的内部实现细节，也不讨论前端 websocket 适配。

核心目标有四个：

1. 先把 `Task` 聚合的业务规则锁成测试
2. 再把 task commands / queries 的应用编排写成测试
3. 通过 facade 消费当前 `project / runtime / interaction` 边界，不直接继承旧实现
4. 最后才落 repository、route 和跨上下文集成

这里默认采用的设计前提是：

1. `Task` 是 aggregate root
2. `task` 拥有 task-facing read model
3. `runtime` 拥有 raw event 和 session lifecycle
4. `interaction` 只消费 task notification boundary

## 3. TDD 总原则

新的 `task` module 必须坚持一条底线：

先定义 task 业务语义测试，再写 runtime 编排细节。

推荐顺序：

1. domain tests
2. application command / query tests
3. facade tests
4. repository tests
5. route tests
6. cross-context integration tests

不建议的顺序：

1. 先复制旧 `task.service.ts`
2. 先把 runner / runtime policy 接进来，再回头想 task aggregate
3. 先做 route，再反推 command 语义

原因很简单：

`task` 的核心复杂度不在 HTTP，也不在 provider runtime，而在：

1. task lifecycle
2. task-facing read model
3. task 状态变更与执行编排的边界

## 4. 每一轮红绿灯怎么执行

后续每个 task use case 都按同一模板推进，不允许跳步。

### 4.1 红灯

先写一个失败测试，只表达一个明确语义：

1. 输入 command / query 是什么
2. 当前 task state 是什么
3. 依赖 port 返回什么
4. 期望返回什么 task 结果或错误

红灯阶段的要求：

1. 先失败，且失败原因清晰
2. 一次只锁一个行为
3. 不为了“顺手通过”提前实现 runtime / route 细节

### 4.2 绿灯

再补最小实现让测试通过：

1. 只写让当前失败测试变绿所需的最小代码
2. 不提前扩展 provider-specific 细节
3. 不在这一轮顺手做 websocket / route / persistence

### 4.3 重构

测试变绿之后，再做必要重构：

1. 消除重复校验逻辑
2. 收紧错误模型
3. 收紧命名与 use case 责任
4. 保持对外 command / query contract 不变

重构阶段不允许：

1. 扩边界
2. 把 runtime 内部细节重新塞回 task
3. 把 interaction contract 混进 task read model

## 5. 测试分层

### 5.1 Domain tests

测试对象：

1. `Task`
2. task lifecycle invariants

这一层只验证业务规则，不碰：

1. Prisma
2. Fastify
3. websocket
4. provider runtime

### 5.2 Application tests

测试对象：

1. `CreateTask`
2. `ArchiveTask`
3. `DeleteTask`
4. `UpdateTaskTitle`
5. `GetTaskDetail`
6. `ListProjectTasks`
7. `GetTaskEvents`

这一层验证：

1. use case 编排
2. project / runtime / policy facade 调用时机
3. task repository 调用约束
4. 错误分层与返回结果

### 5.3 Facade tests

测试对象：

1. task 对 current project facade 的调用
2. task 对 current runtime facade 的调用
3. task notification facade 给 interaction 的输出边界
4. task event projection facade 的调用边界

这层的目标是：

1. 不动旧实现内部
2. 先把依赖边界收敛成可替换 facade
3. 不让 `task` 直接依赖旧 `tasks service` 大对象
4. 不让 `task` 的 outward boundary 直接绑定 `rxjs`

### 5.4 Repository tests

测试对象：

1. `TaskRepository`
2. task read model persistence mapping

这层只验证：

1. DB mapping 正确
2. aggregate 读写正确
3. 不重新证明所有 domain rules

### 5.5 Route tests

测试对象：

1. `/tasks`
2. `/tasks/:taskId`
3. `/tasks/:taskId/events`
4. `/projects/:projectId/tasks`

这一层只验证：

1. schema validation
2. route 到 application use case 的接线
3. response contract

### 5.6 Integration tests

测试对象：

1. task 与 current runtime facade 的编排
2. task event query projection
3. task notification boundary 被 interaction 消费

这层不追求全覆盖，只覆盖关键边界。

## 6. 红绿灯开发节奏

这里的“红绿灯”是指每一阶段都要遵守：

1. 先写失败测试
2. 再补最小实现让测试变绿
3. 最后做必要重构，不扩边界

### 6.1 第一盏灯：Task 聚合纯规则

先写红灯测试：

1. 新 task 创建时具备合法默认状态
2. archived task 不能再次归档
3. archived task 不能被任意 route 直接改回活动态
4. title 更新不改变 task identity

变绿目标：

1. task aggregate 规则稳定
2. 不引入 runtime / repository 依赖

### 6.2 第二盏灯：基础 queries

先写红灯测试：

1. `GetTaskDetail(taskId)` 返回 task detail
2. `ListProjectTasks(projectId)` 返回 project-scoped task list
3. `GetTaskEvents(taskId)` 返回 task-facing projected event stream
4. invalid taskId / projectId 返回结构化 task 错误

变绿目标：

1. task query 只依赖 task repository 与 projection port
2. task query 不认识 websocket contract

### 6.3 第三盏灯：基础 commands

先写红灯测试：

1. `ArchiveTask` 只能归档未归档 task
2. `DeleteTask` 返回 task-side delete result
3. `UpdateTaskTitle` 只改 title 相关字段

变绿目标：

1. 先完成与 runtime 耦合最小的 use cases
2. task aggregate 与 repository 责任清晰

### 6.4 第四盏灯：runtime 编排 facade

先写红灯测试：

1. `CreateTask` 会读取 project defaults 并调用 runtime-policy facade
2. `CreateTask` 成功后会调用 current runtime facade
3. runtime facade 失败时 task 如何映射错误，需要明确规则
4. task 自己不直接理解 provider raw event

变绿目标：

1. task command 能编排 runtime
2. 但 task 仍不拥有 runtime source of truth

### 6.5 第五盏灯：task event query projection

先写红灯测试：

1. task raw-related input 能被投影为 task-facing event stream
2. projected sequence 与 cursor 规则稳定
3. task read model 不泄漏 raw provider envelope

变绿目标：

1. task-facing event query 固定下来
2. runtime raw model 与 task read model 分离

### 6.6 第六盏灯：notification boundary

先写红灯测试：

1. task state 变化会输出 task notification
2. project-scoped task list 变化会输出 project task notification
3. notification boundary 不包含 websocket event name
4. notification subscriber 不要求暴露 `Observable`

变绿目标：

1. interaction 可以消费 task notification
2. task 不再理解 channel-specific delivery
3. `task` 的 notification 机制可先用原生事件实现

### 6.7 第七盏灯：route contract

这一盏灯必须放后面。

先写红灯测试：

1. `POST /tasks`
2. `GET /tasks/:taskId`
3. `GET /projects/:projectId/tasks`
4. `GET /tasks/:taskId/events`

变绿目标：

1. route 只是接线
2. route 测试不重复证明 task 业务规则

## 7. 第一阶段实施范围

为了防止 TDD 计划重新膨胀，第一阶段只做低 runtime 耦合能力。

按顺序建议是：

1. `Task` aggregate
2. `GetTaskDetail`
3. `ListProjectTasks`
4. `ArchiveTask`
5. `DeleteTask`
6. `UpdateTaskTitle`
7. `TaskNotificationPublisher`
8. `TaskNotificationSubscriber`

暂时不进入第一阶段的内容：

1. `CreateTask`
2. task event projection 的完整落库重构
3. break / cancel / recover 这类 execution-heavy command

原因：

1. 先固定 `task` 自己的 aggregate / repository / notification 形状
2. 再接 runtime facade，风险更低
3. 可以避免一开始就把旧 runner 逻辑整块搬进来

## 8. 测试文件组织建议

推荐按分层组织：

```text
apps/service/src/modules/task/
  domain/
    __tests__/
      task.test.ts
  application/
    __tests__/
      get-task-detail.test.ts
      list-project-tasks.test.ts
      archive-task.test.ts
      update-task-title.test.ts
      create-task.test.ts
  facade/
    __tests__/
      current-runtime-facade.test.ts
      current-project-facade.test.ts
  infrastructure/
    __tests__/
      task.repository.test.ts
      task-event-projection.test.ts
  routes/
    __tests__/
      task.routes.test.ts
```

## 9. Mock / Fake 策略

推荐测试替身策略如下：

1. domain tests 不需要 mock
2. application tests 使用 in-memory task repository
3. facade tests 使用 explicit fake facade，不直接 mock 大对象 service
4. route tests 只 mock use case facade
5. notification tests 优先使用原生事件 fake / in-memory bus

不建议：

1. 在 task tests 里直接起真实 websocket
2. 在 task tests 里直接跑 provider runtime
3. 在 task tests 里直接把 interaction 合进来做端到端
4. 在 task 层测试里为了通知机制提前引入 RxJS pipeline 复杂度

## 10. 完成标准

当下面条件同时成立时，可以认为第一阶段 `task` TDD 已经完成：

1. `Task` 聚合规则有明确 domain tests
2. 基础 queries 与 commands 已迁成新 `modules/task`
3. task notification boundary 已可供 interaction 消费
4. route 只剩接线职责

## 11. 命名与迁移约束

TDD 推进时要同时遵守模块迁移约束：

1. 新测试、新实现都落在 `apps/service/src/modules/task`
2. 不再给 `apps/service/src/modules/tasks` 增量加逻辑
3. `apps/service/src/modules/tasks` 若仍存在，只允许作为过渡 re-export
4. 不把新的 task TDD 代码回填到任何旧实现目录

## 12. 一句话结论

`task` 的 TDD 顺序，必须从 task 聚合和 task-facing read model 开始，而不是从 runner / websocket / route 开始。

也就是说：

```text
first lock task business semantics, then orchestrate runtime through facades.
```
