# Task Output Schema TDD 红绿灯计划

> [!WARNING]
> **状态：已过时（Outdated）**
> 当前系统主模型已调整为 `Orchestration -> N Tasks`。
> 这些文档仍可作为历史背景参考，但不应再作为最新设计依据。
> 请优先参考：`docs/orchestration-requirements-2026-03-31.md` 与 `docs/tdd/orchestration.md`。


## 1. 文档信息

- 文档名称：Task Output Schema TDD 红绿灯计划
- 日期：2026-03-31
- 状态：Reference
- 适用范围：
  - `apps/service/src/modules/task`
  - `apps/service/src/lib/agents`
  - `apps/web/src/modules/tasks/api`
- 关联文档：
  - [../task-output-schema-requirements-2026-03-31.md](../task-output-schema-requirements-2026-03-31.md)
  - [../task-api.md](../task-api.md)
  - [../task-structured-input-requirements-2026-03-28.md](../task-structured-input-requirements-2026-03-28.md)
  - [../task-explicit-runtime-config-requirements-2026-03-30.md](../task-explicit-runtime-config-requirements-2026-03-30.md)
  - [./task.md](./task.md)
  - [./task-structured-input.md](./task-structured-input.md)

## 2. 目标

这份 TDD 文档只规划“task create / resume 支持可选 `outputSchema` 并透传到 Codex turn 执行”如何按红灯 / 绿灯推进。

核心目标：

1. 先锁 HTTP 与 application contract
2. 再锁 turn-level options 的边界建模
3. 再让 Codex adapter 真正透传 `outputSchema`
4. 最后补持久化与前端 API client 回归

## 3. 测试推进原则

1. 先验证“不传时完全不变”，再验证“传入时正确生效”
2. 先锁 service 后端 contract，再补 web API client
3. 先把 `outputSchema` 建模为 turn-level option，再接到底层 adapter
4. 不把 `outputSchema` 塞回 `TaskRuntimeConfig`
5. 第一阶段不验证 Harbor 内部解析 assistant JSON，只验证 schema 被传递与记录

## 4. 红绿灯顺序总览

1. 第一盏灯：create / resume route 接受可选 `outputSchema`
2. 第二盏灯：application / runtime port 引入 turn-level options
3. 第三盏灯：unsupported executor 明确拒绝 `outputSchema`
4. 第四盏灯：Codex adapter 透传 `outputSchema` 到 `runStreamed`
5. 第五盏灯：synthetic user input event 持久化 `outputSchema`
6. 第六盏灯：web API client 能发送 `outputSchema`

## 5. 后端测试计划

### 5.1 第一盏灯：route schema 接受可选 `outputSchema`

#### 红灯

新增 / 调整 route tests，断言：

1. `POST /v1/tasks` 不传 `outputSchema` 仍然成功
2. `POST /v1/tasks` 传入 object 类型 `outputSchema` 时成功进入 use case
3. `POST /v1/tasks` 传入 array 类型 `outputSchema` 时返回 4xx
4. `POST /v1/tasks` 传入 `null` 类型 `outputSchema` 时返回 4xx
5. `POST /v1/tasks/:taskId/resume` 具备同样行为

#### 绿灯

修改：

1. `apps/service/src/modules/task/schemas/task.schema.ts`
2. `apps/service/src/modules/task/routes/task.routes.test.ts`

直到 create / resume route contract 稳定支持可选 `outputSchema`。

### 5.2 第二盏灯：application / runtime port 引入 turn-level options

#### 红灯

新增 / 调整 application / integration tests，断言：

1. create task 时 `runtimeConfig` 与 `turnOptions` 被清晰分开传递
2. resume task 时 `runtimeConfig` 与 `turnOptions` 被清晰分开传递
3. `outputSchema` 不进入 `TaskRuntimeConfig`
4. 未传 `outputSchema` 时 `turnOptions.outputSchema === undefined`

#### 绿灯

修改：

1. `apps/service/src/modules/task/application/create-task.ts`
2. `apps/service/src/modules/task/application/resume-task.ts`
3. `apps/service/src/modules/task/application/task-runtime-port.ts`
4. `apps/service/src/modules/task/facade/current-task-runtime-port.integration.test.ts`
5. `apps/service/src/lib/agents/types.ts`

直到代码层明确形成 thread-level config 与 turn-level options 的边界。

### 5.3 第三盏灯：unsupported executor 明确拒绝 `outputSchema`

#### 红灯

新增 / 调整 tests，断言：

1. 当 `executor = "codex"` 且带 `outputSchema` 时，create / resume 不因能力检查失败
2. 当 `executor = "claude-code"` 且带 `outputSchema` 时，create 直接失败
3. 当 `executor = "claude-code"` 且带 `outputSchema` 时，resume 直接失败
4. 当 `executor = "claude-code"` 且未带 `outputSchema` 时，原有行为不变

#### 绿灯

修改：

1. `apps/service/src/modules/task/application/create-task.ts`
2. `apps/service/src/modules/task/application/resume-task.ts`
3. `apps/service/src/modules/task/application/task.use-cases.test.ts`
4. 必要时补充 executor capability helper

直到 unsupported executor 不再静默忽略该字段。

### 5.4 第四盏灯：Codex adapter 透传 `outputSchema`

#### 红灯

新增 / 调整 Codex runtime tests，断言：

1. 未传 `outputSchema` 时，`thread.runStreamed()` 仍只带 `signal`
2. 传入 `outputSchema` 时，`thread.runStreamed()` 第二参数包含该 schema
3. resume path 传入 `outputSchema` 时同样透传
4. `buildCodexThreadOptions()` 不承担 `outputSchema` 映射职责

#### 绿灯

修改：

1. `apps/service/src/lib/agents/adapters/codex/runtime.ts`
2. `apps/service/src/lib/agents/adapters/codex/runtime.test.ts`
3. 如有必要，补充 `apps/service/src/lib/agents/adapters/codex/options.ts` 测试

直到 `outputSchema` 真正进入 SDK 的 turn options，而不是停留在 Harbor 上层。

### 5.5 第五盏灯：synthetic user input event 记录 `outputSchema`

#### 红灯

新增 / 调整 tests，断言：

1. create 写入的 synthetic user input event 包含 `outputSchema`
2. resume 写入的 synthetic user input event 包含 `outputSchema`
3. 未传 `outputSchema` 时，event payload 中不出现该字段
4. 结构化输入与图片输入场景下，`input / attachments / outputSchema` 可同时存在

#### 绿灯

修改：

1. `apps/service/src/modules/task/facade/current-task-runtime-port.ts`
2. `apps/service/src/modules/task/infrastructure/runtime/normalize-agent-events.ts`
3. `apps/service/src/modules/task/infrastructure/runtime/normalize-agent-events.test.ts`
4. `apps/service/src/modules/task/facade/current-task-runtime-port.integration.test.ts`

直到 Harbor event log 能完整表达“这轮用户要求了怎样的输出结构”。

## 6. 前端测试计划

### 6.1 第六盏灯：web API client 发送 `outputSchema`

#### 红灯

新增 / 调整前端 API client tests，断言：

1. create task 输入带 `outputSchema` 时，请求 body 正确发送该字段
2. create task 未带 `outputSchema` 时，请求 body 不强行补默认值
3. resume task 输入带 `outputSchema` 时，请求 body 正确发送该字段
4. resume task 未带 `outputSchema` 时，请求 body 保持兼容

#### 绿灯

修改：

1. `apps/web/src/modules/tasks/api/task-api-client.ts`
2. `apps/web/src/modules/tasks/api/task-api-client.test.ts`

直到前端 API client 能无损透传 `outputSchema`。

## 7. 回归检查

在所有灯都变绿后，回归检查如下：

1. 老的 create / resume 请求在不传 `outputSchema` 时仍可执行
2. 结构化输入、图片输入与 `outputSchema` 可以共存
3. `Task.prompt` 仍只保存 summary，不混入 schema 文本
4. `TaskRuntimeConfig` 结构未被污染为 turn-level 配置容器
5. Codex 正常启动，且不会因为 `outputSchema` 缺失而改变旧行为
6. 非 Codex executor 收到 `outputSchema` 时明确失败而不是静默降级

## 8. 实施顺序建议

推荐按下面顺序提交改动：

1. route schema / route tests
2. application contract / runtime port / use case tests
3. unsupported executor validation
4. Codex adapter runtime tests 与实现
5. synthetic user input event tests 与实现
6. web API client tests 与实现

这样可以保证每一层的红灯都围绕一个单一语义展开，不会把“contract 设计”与“adapter 实现细节”混在同一轮修改里。

## 9. 完成定义

当以下条件同时成立时，可以认为这轮 `outputSchema` TDD 第一阶段完成：

1. 后端 create / resume contract 已稳定支持可选 `outputSchema`
2. `outputSchema` 已以 turn-level option 进入 runtime 边界
3. Codex adapter 已真实透传该字段
4. synthetic user input event 已记录该字段
5. 前端 API client 已能透传该字段
6. 旧请求路径与现有 structured input 能力均未回归
