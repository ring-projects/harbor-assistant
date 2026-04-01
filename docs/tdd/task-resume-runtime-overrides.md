# TDD: Task Resume Runtime Overrides

> [!WARNING]
> **状态：已过时（Outdated）**
> 当前系统主模型已调整为 `Orchestration -> N Tasks`。
> 这些文档仍可作为历史背景参考，但不应再作为最新设计依据。
> 请优先参考：`docs/orchestration-requirements-2026-03-31.md` 与 `docs/tdd/orchestration.md`。


## 1. 文档信息

- 文档名称：TDD: Task Resume Runtime Overrides
- 日期：2026-03-30
- 状态：Proposed
- 适用范围：
  - `apps/service/src/modules/task`
  - `apps/service/src/modules/task/infrastructure/runtime`
  - `apps/service/src/lib/agents`
  - `apps/web/src/modules/tasks`
- 关联文档：
  - [../task-resume-runtime-overrides-requirements-2026-03-30.md](../task-resume-runtime-overrides-requirements-2026-03-30.md)
  - [../task-effort-requirements-2026-03-29.md](../task-effort-requirements-2026-03-29.md)
  - [../task-structured-input-requirements-2026-03-28.md](../task-structured-input-requirements-2026-03-28.md)
  - [./task-effort.md](./task-effort.md)
  - [./task.md](./task.md)

## 2. 目标

本 TDD 文档定义 resume runtime overrides 的测试驱动实现顺序。

本轮测试目标不是“把所有 UI 一次改完”，而是把以下语义稳定锁住：

1. resume 可接收 `model` / `effort` override
2. resume 对 override 做 capability-aware 校验
3. 合法 override 会更新 execution snapshot 并传到底层 adapter
4. 非法 override 会在应用层失败
5. 前端 resume composer 会回显并提交当前 task 的 runtime snapshot

## 3. TDD 总原则

这轮改造必须继续遵守：

1. 先锁业务语义，再改 provider 调用
2. 先锁 service contract，再接前端交互
3. 先做失败测试，再补最小实现
4. 不用 UI 手点代替 contract 测试

推荐顺序：

1. contract / parsing tests
2. application tests
3. runtime port / driver tests
4. route tests
5. frontend API client tests
6. frontend composer tests

不建议的顺序：

1. 先改 session composer UI
2. 先把 dropdown 拼出来，再回头想 resume 语义
3. 先在 runtime facade 里偷读 execution record 并跳过应用层校验

## 4. 每一轮红绿灯怎么执行

### 4.1 红灯

先写一个失败测试，只锁一个明确语义：

1. 当前 task / execution snapshot 是什么
2. resume 输入是什么
3. capability catalog 返回什么
4. 期望最终 runtimeConfig / 错误是什么

### 4.2 绿灯

再补最小实现让测试通过：

1. 只实现当前测试要求的最小变更
2. 不提前开放 executor switch
3. 不提前引入 executionMode override

### 4.3 重构

测试变绿后，再做必要收敛：

1. 把 create / resume 共享的 runtime config 解析逻辑收敛成 helper
2. 把 override presence 语义收紧到明确函数边界
3. 去掉 route / use case / runtime facade 之间重复的 capability 校验

## 5. 测试分层

### 5.1 Web contract / parsing tests

测试对象：

1. `ResumeTaskInput`
2. task API client body serialization
3. frontend task contract parsing

这一层验证：

1. resume payload 可以携带 `model`
2. resume payload 可以携带 `effort`
3. 字段省略与显式 `null` 可以被区分
4. 旧 payload 依然合法

### 5.2 Application tests

测试对象：

1. `resumeTaskUseCase`
2. runtime config 解析 helper
3. capability-aware 校验 helper

这一层验证：

1. 请求省略 `model` / `effort` 时，沿用 persisted snapshot
2. 请求显式传 `model` / `effort` 时，覆盖 persisted snapshot
3. 请求显式传 `null` 时，清除对应 override
4. 非法 model 被拒绝
5. 非法 effort 被拒绝
6. 合法 override 会生成最终 `runtimeConfig`

### 5.3 Runtime port / driver tests

测试对象：

1. `TaskRuntimePort.resumeTaskExecution`
2. `current-task-runtime-port`
3. `task-execution-driver`

这一层验证：

1. runtime port resume 输入包含 `runtimeConfig`
2. facade 不再自行从 execution record 恢复旧 snapshot 覆盖应用层输入
3. execution driver resume 使用新 snapshot 调用 adapter
4. execution snapshot 在 accepted resume 后被更新

### 5.4 Adapter option mapping tests

测试对象：

1. Codex adapter options builder
2. Claude Code adapter options builder

这一层验证：

1. resume 时 Codex options 接收新的 `model`
2. resume 时 Codex options 接收新的 `effort`
3. resume 时 Claude query options 接收新的 `model`
4. resume 时 Claude query options 接收新的 `effort`
5. `null` / omitted 的语义不会被错误映射成任意字符串

### 5.5 Route tests

测试对象：

1. `POST /v1/tasks/:taskId/resume`

这一层验证：

1. route schema 接受 `model`
2. route schema 接受 `effort`
3. route schema 拒绝非法 `executor`
4. response contract 保持兼容

### 5.6 Frontend composer tests

测试对象：

1. resume composer pane
2. resume hook
3. capability-driven selectors

这一层验证：

1. composer 初始值来自 task detail snapshot，而不是 create defaults
2. model selector 可修改
3. effort selector 受 model 约束
4. submit 时 resume payload 包含当前选择的 `model` / `effort`
5. 非法组合不会提交

## 6. 红绿灯开发节奏

### 6.1 第一盏灯：锁定 resume contract 扩展

先写红灯测试：

1. `ResumeTaskInput` 支持 `model?: string | null`
2. `ResumeTaskInput` 支持 `effort?: TaskEffort | null`
3. 旧客户端只传 `prompt` / `items` 仍然通过
4. route body 传 `executor` 时失败

变绿目标：

1. resume contract 扩展完成
2. 向后兼容保持稳定

### 6.2 第二盏灯：锁定 runtime config 解析语义

先写红灯测试：

1. persisted snapshot 为 `model=a, effort=medium`，请求省略字段时结果仍为 `a / medium`
2. 请求传 `model=b` 时结果为 `b / medium`
3. 请求传 `effort=high` 时结果为 `a / high`
4. 请求传 `model=null, effort=null` 时结果为 `null / null`

变绿目标：

1. 省略 vs 显式清空语义稳定
2. create / resume 共享 helper 的方向明确

### 6.3 第三盏灯：锁定 capability-aware 校验

先写红灯测试：

1. 当前 executor 下不存在指定 model 时 resume 被拒绝
2. 指定 model 不支持指定 effort 时 resume 被拒绝
3. 当前 snapshot 为 `model=null` 且请求只传 `effort` 时，基于 provider default model 做校验
4. capability catalog 不可用时 resume 被拒绝

变绿目标：

1. 非法 override 不会进入 runtime
2. 校验语义与 create 保持一致

### 6.4 第四盏灯：锁定 runtime port 与 execution snapshot 更新

先写红灯测试：

1. `resumeTaskUseCase` 会把最终 `runtimeConfig` 传给 `runtimePort.resumeTaskExecution`
2. accepted resume 后 execution snapshot 更新为新的 `model` / `effort`
3. 只修改 `effort` 不会误改 `model`
4. 只修改 `model` 不会误改 `effort`

变绿目标：

1. 应用层不再把 resume runtime config 丢失
2. execution snapshot 与 task read model 能跟上最新配置

### 6.5 第五盏灯：锁定 adapter option mapping

先写红灯测试：

1. Codex resume 传 `model=gpt-5` 时，thread options 收到 `model=gpt-5`
2. Codex resume 传 `effort=high` 时，thread options 收到 `modelReasoningEffort=high`
3. Claude resume 传 `model=claude-sonnet` 时，query options 收到同名 model
4. Claude resume 传 `effort=xhigh` 时，query options 收到 `max`

变绿目标：

1. 底层 provider 真正消费 override
2. provider-specific mapping 语义明确

### 6.6 第六盏灯：锁定 route 与 API client

先写红灯测试：

1. frontend `resumeTask()` 会序列化 `model`
2. frontend `resumeTask()` 会序列化 `effort`
3. service route 可以接收并传递这两个字段
4. route 返回错误时 frontend 能得到结构化错误

变绿目标：

1. 前后端 contract 打通
2. UI 接线前的 API 边界稳定

### 6.7 第七盏灯：锁定 resume composer 行为

先写红灯测试：

1. composer 打开时读取 task detail 当前 `model` / `effort`
2. 切换 model 后 effort options 会重新约束
3. 切换 effort 后 submit payload 会带上新的 effort
4. 点击 resume 时 payload 包含新的 runtime override

变绿目标：

1. 用户能在 UI 上显式控制 resume runtime config
2. UI 初始值来源正确，不受 create defaults 污染

## 7. 建议测试清单

### 7.1 Service application

建议新增或扩展的测试主题：

1. `resume-task.use-case.test.ts`
2. `validate-task-effort-selection.test.ts`
3. resume runtime config resolver tests

### 7.2 Runtime

建议新增或扩展的测试主题：

1. `current-task-runtime-port` integration tests
2. `task-execution-driver` tests
3. Codex / Claude adapter option mapping tests

### 7.3 Frontend

建议新增或扩展的测试主题：

1. `task-api-client.test.ts`
2. resume composer pane tests
3. capability selector behavior tests

## 8. 完成定义

以下条件全部满足时，本轮 TDD 可以视为完成：

1. resume contract、应用层、runtime、adapter、前端 UI 五层都有明确失败测试
2. 所有合法路径测试通过
3. 所有非法 override 路径测试通过
4. 没有通过“偷偷复用旧 snapshot”掩盖 runtime override 丢失问题
5. 旧客户端 resume 行为保持兼容
