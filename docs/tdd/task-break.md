# Task Break TDD Plan

## 1. 文档信息

- 文档名称：Task Break TDD Plan
- 日期：2026-03-29
- 状态：Proposed Canonical Design
- 适用范围：
  - `apps/service/src/modules/task`
  - `apps/service/src/lib/agents`
  - `apps/web/src/modules/tasks`
- 关联文档：
  - [../task-break-requirements-2026-03-29.md](../task-break-requirements-2026-03-29.md)
  - [../task-api.md](../task-api.md)
  - [../agent-event-projection-design-2026-03-25.md](../agent-event-projection-design-2026-03-25.md)
  - [../task-runtime-system-design-2026-03-23.md](../task-runtime-system-design-2026-03-23.md)
  - [./task.md](./task.md)

## 2. 目标

这份文档只规划“task break current turn”如何按 TDD 推进，不讨论更广泛的 retry、fork、multi-node orchestration 或 runtime aggregate 重做。

核心目标如下：

1. 先用测试锁住 task-facing cancel 语义
2. 再用测试锁住 runtime abort handle 的编排边界
3. 再用测试锁住 cancel / complete / fail 的 terminal race
4. 再补事件投影与前端最小接线测试
5. 保证 break 是一个稳定可恢复的能力，而不是仅仅“按钮能点”

## 3. TDD 总原则

这次 break 改造必须坚持一条底线：

先锁住任务状态机和取消编排测试，再改 runtime driver 与前端交互。

推荐顺序：

1. application cancel use case tests
2. runtime registry / facade tests
3. execution driver / state store tests
4. route tests
5. frontend api / hook tests
6. frontend interaction tests

不建议的顺序：

1. 先把 break 按钮接到前端，再回头想 service 怎么 abort
2. 先在 adapter 层试 abort，再回头定义 task terminal state 应该是什么
3. 先把 `POST /cancel` route 接出来，再回头处理 cancel / complete 竞争

原因很简单：

这次改造最容易返工的不是 HTTP wiring，而是以下三个判断：

1. 哪些 task 状态允许 cancel
2. 用户 break 最终应该落成什么 terminal 状态
3. cancel 与 complete/fail 并发时，谁有资格写最终状态

## 4. 每一轮红绿灯怎么执行

后续每个 break 相关改造都按同一模板推进，不允许跳步。

### 4.1 红灯

先写一个失败测试，只表达一个明确语义：

1. 输入 command 是什么
2. 当前 task / execution state 是什么
3. 依赖 port 或 registry 返回什么
4. 期望任务状态、事件或 HTTP 响应是什么

### 4.2 绿灯

再补最小实现让测试通过：

1. 只写让当前测试变绿所需的最小代码
2. 不顺手提前重写整个 runtime state machine
3. 不顺手修改所有前端交互状态

### 4.3 重构

测试变绿之后，再做必要重构：

1. 消除 start/resume/cancel 的重复编排逻辑
2. 收紧 terminal guard 的命名和责任边界
3. 统一 synthetic cancel event 的 helper 与 payload 结构
4. 保持 task-facing contract 不变

## 5. 测试分层

### 5.1 Application tests

测试对象：

1. `cancelTaskUseCase`

这一层验证：

1. `running` task 会调用 runtime port 的 cancel command
2. terminal task 再次 cancel 时按幂等返回当前 task
3. archived task 不能 cancel
4. task 不存在时返回结构化错误

这一层不验证：

1. `AbortController` 是否真的中断 provider
2. Prisma 是否正确更新
3. route schema 是否接线正确

### 5.2 Runtime registry / facade tests

测试对象：

1. current task runtime facade
2. in-flight execution registry

这一层验证：

1. start/resume 时会注册 active handle
2. cancel 时能按 `taskId` 找到 handle 并调用 abort
3. turn 结束后 handle 会被移除
4. 找不到 handle 时仍能走收敛策略，而不是静默失效

### 5.3 Execution driver / state store tests

测试对象：

1. execution driver
2. execution state store

这一层验证：

1. driver 会把 `AbortSignal` 传给 adapter
2. abort 触发后最终走 `markCancelled`，而不是 `markFailed`
3. `markCompleted` / `markFailed` / `markCancelled` 具备 compare-and-set 语义
4. cancel 与 complete/fail 并发时，只允许一个 terminal 写入成功

### 5.4 Event projection tests

测试对象：

1. cancel synthetic event helper
2. task event projection

这一层验证：

1. `harbor.cancel_requested` 被正确落库
2. `harbor.cancelled` 被正确落库
3. normalized `/events` 能表达 break 请求与取消结束
4. 前端不需要识别 provider-specific abort 文本

### 5.5 Route tests

测试对象：

1. `POST /v1/tasks/:taskId/cancel`

这一层只验证：

1. body schema 接受空对象与可选 `reason`
2. route 正确调用 `cancelTaskUseCase`
3. 不存在 task 返回 404
4. archived task 返回结构化业务错误
5. terminal task 再次 cancel 返回 200 + 当前 task

### 5.6 Frontend API / hook tests

测试对象：

1. task api client
2. cancel mutation hook
3. session composer break action hook

这一层验证：

1. API client 会向 `/v1/tasks/:taskId/cancel` 发请求
2. running task 触发 break 时不会走 `resume`
3. cancel pending 时不会重复提交
4. cancel 成功后依然依赖 task detail / event stream 更新界面

### 5.7 Frontend interaction tests

测试对象：

1. task session composer
2. break button 行为

这一层验证：

1. `running` task 显示 break 入口
2. 点击 break 后按钮进入 pending/disabled 状态
3. task 进入 terminal 后，既有 queued prompt 逻辑仍然成立

## 6. 红绿灯开发节奏

### 6.1 第一盏灯：锁定 cancel 业务语义

先写红灯测试：

1. `running` task 允许 cancel
2. `completed` / `failed` / `cancelled` task cancel 时幂等返回
3. archived task cancel 会失败
4. 不存在 task cancel 返回 not found

变绿目标：

1. task-facing cancel command 语义稳定
2. application 层不直接碰 runtime adapter 细节

### 6.2 第二盏灯：锁定 runtime handle registry

先写红灯测试：

1. `startTaskExecution` 会注册 handle
2. `resumeTaskExecution` 会注册 handle
3. `cancelTaskExecution` 会找到对应 handle 并 abort
4. turn 结束后 handle 会被移除

变绿目标：

1. service 真正拥有可取消的 in-flight runtime handle
2. cancel 不再只是状态层的“假动作”

### 6.3 第三盏灯：锁定 abort → cancelled 编排

先写红灯测试：

1. driver 调用 adapter 时会传入 `AbortSignal`
2. abort 发生后，driver 走 `markCancelled`
3. abort 发生后，不会误写 `markFailed`
4. cancel 会保留 `sessionId`

变绿目标：

1. service 可以把用户 break 真正传到 provider runtime
2. 用户主动中断不再被误判为 runtime failure

### 6.4 第四盏灯：锁定 terminal race

先写红灯测试：

1. cancel 与 complete 并发时，只允许一个 terminal 写入成功
2. cancel 与 fail 并发时，只允许一个 terminal 写入成功
3. 已被 `cancelled` 的任务不会被后续 `completed` 覆盖
4. 已被 `completed` 的任务不会被后续 cancel 改写

变绿目标：

1. terminal transition 具备 compare-and-set 语义
2. 任务状态不再出现“用户点了 break 却最后显示 completed”的不确定现象

### 6.5 第五盏灯：锁定 cancel event 语义

先写红灯测试：

1. cancel 请求被接受时写入 `harbor.cancel_requested`
2. cancel 成功收敛时写入 `harbor.cancelled`
3. forced convergence without handle 也会留下清晰 reason
4. `/events` 投影后能稳定给前端读取

变绿目标：

1. break 行为在事件流中可解释、可审计
2. 前端和调试工具都不必猜测 provider abort 文本

### 6.6 第六盏灯：锁定 route 与前端接线

先写红灯测试：

1. `POST /v1/tasks/:taskId/cancel` route contract 正确
2. task api client 正确调用 cancel 接口
3. running task 的 composer 触发 break action，而不是 `resume`
4. break pending 时不会重复点击提交

变绿目标：

1. service 与 web 的 break 行为真正闭环
2. UI 不依赖本地假状态，而是依赖 task/event 的真实结果

## 7. 建议优先写的关键测试

如果时间有限，优先级建议如下：

1. `cancelTaskUseCase`：`running` / `terminal` / `archived` 三类状态判断
2. runtime facade：cancel 能找到并 abort active handle
3. execution state store：terminal compare-and-set
4. execution driver：abort 映射到 `cancelled`
5. route：`POST /tasks/:taskId/cancel`

这五组测试一旦稳定，break 功能的骨架就已经锁住了。

## 8. 不建议先写的测试

本轮不建议一开始就投入精力写以下测试：

1. provider SDK 自身 abort 语义的深层单元测试
2. 全量 websocket / SSE 端到端长链路测试
3. 大量视觉快照测试
4. 复杂多标签页并发交互测试

原因：

1. 这些测试成本高、反馈慢
2. 在 cancel 业务语义尚未锁定前，极容易跟着实现一起重写
3. 先把 application / runtime / state store 三层锁住，收益更高

## 9. 实施顺序建议

推荐按以下顺序推进代码与测试：

1. 先补 `cancelTaskUseCase` 测试与最小实现
2. 再补 runtime registry 测试与最小实现
3. 再补 driver signal 贯通与 abort mapping 测试
4. 再补 terminal guard 测试与状态层实现
5. 再补 cancel synthetic event / projection 测试
6. 最后补 route、API client、hook 和 UI 行为测试

这个顺序的目的只有一个：

先让“break 真能停下来且状态不会乱”变成稳定事实，再去做按钮和体验优化。
