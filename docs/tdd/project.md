# Project TDD Plan

## 1. 文档信息

- 文档名称：Project TDD Plan
- 日期：2026-03-24
- 状态：Proposed
- 适用范围：
  - `project` context
  - `apps/service/src/modules/project`
- 关联文档：
  - [../project-context-design-2026-03-24.md](../project-context-design-2026-03-24.md)
  - [../backend-lite-ddd-design-2026-03-24.md](../backend-lite-ddd-design-2026-03-24.md)
  - [../task-runtime-system-design-2026-03-23.md](../task-runtime-system-design-2026-03-23.md)

## 2. 目标

这份文档不讨论最终实现细节，而是规划 `project` 上下文如何按 TDD 推进。

核心目标只有三个：

1. 先把 `Project` 聚合的业务规则写成测试
2. 再把 `project` use case 写成 application-level tests
3. 最后再落持久化、HTTP 和集成测试

这里默认采用的设计前提是：

1. `Project` 是 aggregate root
2. `ProjectSettings` 是 `Project` 的 owned record
3. `runtime-policy` 是应用层 capability，不是独立业务域

## 3. TDD 总原则

`project` 上下文的测试顺序必须从“业务真相”往外扩。

推荐顺序：

1. domain tests
2. application/use-case tests
3. repository tests
4. HTTP route tests
5. cross-context integration tests

不建议的顺序：

1. 先做 Prisma schema
2. 先做 route
3. 先做页面，再反推业务规则

原因很简单：

`project` 的核心复杂度不在 CRUD，而在聚合边界、不变量和 settings ownership。

## 4. 测试分层

### 4.1 Domain tests

测试对象：

1. `Project`
2. `ProjectSettings`
3. project-level invariants

这层只验证业务规则，不碰：

1. Prisma
2. Fastify
3. 文件系统真实 IO
4. skill bridge 真实副作用

### 4.2 Application tests

测试对象：

1. `CreateProject`
2. `RenameProject`
3. `RelocateProjectRoot`
4. `ArchiveProject`
5. `RestoreProject`
6. `UpdateProjectSettings`

这层验证：

1. use case 编排
2. repository 调用约束
3. supporting ports 调用时机
4. 错误映射和返回对象

### 4.3 Repository tests

测试对象：

1. `ProjectRepository`
2. 持久化映射
3. 唯一约束与事务边界

这层只验证：

1. DB mapping 是否正确
2. `Project` 与 `ProjectSettings` 是否同事务保存
3. optimistic concurrency 或 version 字段是否生效

### 4.4 HTTP tests

测试对象：

1. `/projects`
2. `/projects/:id`
3. `/projects/:id/settings`

这层只验证：

1. schema validation
2. status code
3. response contract
4. route 到 application service 的接线

### 4.5 Integration tests

测试对象：

1. `project` 与 `runtime-policy` 的协作
2. `project` 与 skill bridge / memory initializer 的协作
3. `project` 与 future task creation policy 的协作

这层不追求覆盖全部分支，只覆盖关键边界。

## 5. 第一阶段先写哪些测试

第一阶段不要急着覆盖所有接口，先锁住聚合规则。

建议先写下面这些 domain tests。

### 5.1 Project identity

1. 创建项目时必须有合法 name
2. 创建项目时必须有合法 normalized path
3. `slug` 必须可稳定生成
4. 同一个聚合创建后必须自带默认 settings

### 5.2 Lifecycle

1. `active -> archived` 合法
2. `archived -> active` 合法
3. `missing -> active` 是否允许，必须写清业务规则后再实现
4. terminal-like lifecycle 变化是否需要记录时间戳

### 5.3 Settings ownership

1. settings 不能脱离 project 单独存在
2. 更新 settings 不能破坏 project 聚合不变量
3. `maxConcurrentTasks` 必须大于 0
4. retention 字段为空或正整数
5. `defaultModel` 与 `defaultExecutor` 的组合必须合法

## 6. 第二阶段写 application tests

在 domain tests 稳定后，再写 use-case tests。

建议按下面顺序推进。

### 6.1 `CreateProject`

先写测试表达以下行为：

1. 创建成功后返回完整 `Project`
2. 自动附带默认 `ProjectSettings`
3. 若 path 冲突，返回领域错误
4. 若 supporting side effect 失败，主交易是否回滚，需要先定规则

### 6.2 `UpdateProjectSettings`

先写测试表达以下行为：

1. 基于现有 project 读取并更新 settings
2. 非法 settings 不进入 repository
3. settings 更新后返回新的聚合视图或 settings read model
4. side effect 只在成功提交后触发

### 6.3 `ArchiveProject` / `RestoreProject`

先写测试表达以下行为：

1. 已归档项目不能重复归档
2. 恢复时必须满足业务前置条件
3. 归档项目后 future task creation policy 应如何处理

### 6.4 `RelocateProjectRoot`

先写测试表达以下行为：

1. path 变更必须经过 canonicalization
2. path 冲突直接失败
3. path 变化后，project-scoped resources 如何重绑定

## 7. 第三阶段写 repository tests

这一阶段才进入真实持久化。

建议覆盖：

1. `Project` 和 `ProjectSettings` 的保存与读取
2. `normalizedPath` 唯一约束
3. `slug` 唯一约束
4. settings update 的事务一致性
5. version 或更新时间戳的写入行为

注意：

repository tests 不应该重新证明所有 domain rules。

如果某个规则已经被 domain tests 覆盖，这里只验证持久化没有破坏它。

## 8. 第四阶段写 route tests

当 application service 稳定后，再写 API 测试。

建议顺序：

1. `POST /projects`
2. `PATCH /projects/:id`
3. `GET /projects/:id`
4. `GET /projects/:id/settings`
5. `PATCH /projects/:id/settings`

重点覆盖：

1. 请求体校验
2. 领域错误到 HTTP 错误的映射
3. response shape 是否稳定

## 9. 测试文件组织建议

推荐按分层组织，而不是按技术组件堆一起。

示例：

```text
apps/service/src/modules/project/
  domain/
    __tests__/
      project.test.ts
      project-settings.test.ts
  application/
    __tests__/
      create-project.test.ts
      update-project-settings.test.ts
      archive-project.test.ts
  repositories/
    __tests__/
      project.repository.test.ts
  routes/
    __tests__/
      project.routes.test.ts
```

如果当前仓库还没完成目录重构，也建议至少在测试命名上保持这种意图。

## 10. Mock / Fake 策略

TDD 阶段优先使用 fake，而不是大面积 mock implementation。

建议：

1. domain tests 不用 mock
2. application tests 用 in-memory `ProjectRepository`
3. side effect ports 用 spy/fake
4. repository tests 才接真实 Prisma / test DB

特别注意：

不要在 application tests 里 mock 掉所有行为，否则你测试到的只是调用顺序，不是业务用例。

## 11. 建议开发步骤

推荐按下面顺序推进实际开发。

1. 定义 `Project` 和 `ProjectSettings` 的领域类型与命令入口
2. 先写 `Project` domain tests
3. 让 domain tests 通过
4. 定义 `ProjectRepository` 的最小接口
5. 写 `CreateProject` application tests
6. 写 `UpdateProjectSettings` application tests
7. 写 `ArchiveProject` / `RestoreProject` application tests
8. 落 in-memory repository，使 application tests 通过
9. 再落 Prisma repository tests
10. 最后接 route tests 和前端契约

这条顺序的关键是：

先固定行为，再固定存储，再固定接口。

## 12. 第一批验收标准

如果第一轮 TDD 做完，至少应该满足：

1. `Project` 聚合的核心不变量已有测试
2. `UpdateProjectSettings` 不再被视为独立业务根操作
3. `project` use case 测试不依赖真实数据库
4. repository tests 只负责证明映射与事务
5. route tests 只负责证明 HTTP contract

## 13. 非目标

这份 TDD 规划当前不覆盖：

1. task context
2. runtime provider adapter
3. websocket / interaction
4. 前端组件测试细节

这些部分后续应分别写自己的 TDD 计划，不与 `project` 混在一份文档中。

## 14. 最终结论

`project` 上下文最适合用 TDD 的原因，不是因为它叫 DDD，而是因为它已经可以被收敛成：

1. 清晰的聚合
2. 清晰的不变量
3. 清晰的 use case
4. 清晰的持久化边界

开发顺序必须坚持：

```text
Project rules first
-> project use cases
-> persistence mapping
-> HTTP contract
-> cross-context integration
```

只要这个顺序不乱，`project` 模块就更容易从 MVP 的松散实现，走到一个可测试、可演进、可维护的稳健设计。
