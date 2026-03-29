# Task Effort TDD 红绿灯计划

## 1. 文档信息

- 文档名称：Task Effort TDD 红绿灯计划
- 日期：2026-03-29
- 状态：Proposed
- 适用范围：
  - `apps/service/src/modules/task`
  - `apps/service/src/lib/agents`
  - `apps/service/prisma`
  - `apps/web/src/modules/tasks`
- 关联文档：
  - [../task-effort-requirements-2026-03-29.md](../task-effort-requirements-2026-03-29.md)
  - [../task-api.md](../task-api.md)
  - [../frd-task-frontend.md](../frd-task-frontend.md)
  - [./task.md](./task.md)

## 2. 目标

这份文档只规划“task create effort 接入”如何按 TDD 推进，不讨论 project settings preset 或 provider catalog 自动同步。

核心目标只有五个：

1. 先用测试锁住 effort 的统一语义与校验规则
2. 再收敛 create → persist → runtime 的透传链路
3. 明确 resume 复用 persisted effort，而不是重新猜测
4. 最后才接前端 create payload 与选择器行为
5. 保证旧 create 调用在不传 effort 时继续可用

## 3. TDD 总原则

这次改造必须坚持一条底线：

先锁 effort 语义测试，再改 persistence 与 runtime，再接前端交互。

推荐顺序：

1. helper / capability tests
2. application use case tests
3. persistence / repository tests
4. runtime option mapping tests
5. route tests
6. frontend api / interaction tests

不建议的顺序：

1. 先加 UI 下拉框，再回头决定后端接受什么 effort 枚举
2. 先把 effort 写进前端 state，再回头想 resume 应该复用谁
3. 先在 adapter 里塞默认值，再回头补 create route 校验

原因很简单：

这次改造最容易返工的不是下拉 UI，而是以下三个判断：

1. effort 的 source of truth 到底在哪里
2. create 非法组合到底是拒绝还是降级
3. resume 到底是继承还是覆盖 create 时的运行配置

## 4. 每一轮红绿灯怎么执行

后续每个 effort 相关改造都按同一模板推进，不允许跳步。

### 4.1 红灯

先写一个失败测试，只表达一个明确语义：

1. 输入的 executor / model / effort 是什么
2. 当前 task / execution state 是什么
3. capability catalog 返回什么
4. 期望 create / persist / runtime 收到什么结果或错误

### 4.2 绿灯

再补最小实现让测试通过：

1. 只写让当前测试变绿的最小代码
2. 不顺手提前修改 project settings
3. 不顺手改造全部 task 列表 UI

### 4.3 重构

测试变绿之后，再做必要重构：

1. 收紧 effort helper 与命名
2. 消除 create / resume runtime config 拼装的重复逻辑
3. 收紧 route schema 与 read model contract
4. 保持 create → persist → runtime 语义不变

## 5. 测试分层

### 5.1 Effort helper / capability tests

测试对象：

1. effort 字符串归一化
2. `null` / `undefined` 的兼容语义
3. model `efforts` 支持列表校验
4. provider default model 解析策略

这一层不碰：

1. Prisma
2. Fastify
3. websocket
4. provider runtime 真正执行

### 5.2 Application tests

测试对象：

1. `CreateTask`
2. `ResumeTask`

这一层验证：

1. create 接收可选 `effort`
2. create 非法 `effort` 会返回结构化错误
3. runtimeConfig 会携带最终 effort snapshot
4. resume 会复用 persisted effort

### 5.3 Persistence / repository tests

测试对象：

1. execution effort snapshot 持久化
2. task read model effort 投影
3. interaction record effort 投影

这一层验证：

1. create 后 execution 真实保存 `executorEffort`
2. 读取 task detail / list 时能回显 `effort`
3. 未指定 `effort` 时返回 `null`

### 5.4 Runtime option mapping tests

测试对象：

1. runtime policy / options builder
2. Codex adapter option mapping
3. Claude Code adapter option mapping

这一层验证：

1. create 的 effort 真的进入 `AgentRuntimeOptions`
2. Codex runtime 收到 Harbor effort 原值
3. Claude Code runtime 收到 provider 对应 effort
4. resume 使用 persisted effort 而不是丢失该字段

### 5.5 Route tests

测试对象：

1. `POST /v1/tasks`
2. `GET /v1/tasks/:taskId`
3. `GET /v1/projects/:projectId/tasks`

这一层只验证：

1. body schema 接受 `effort`
2. 非法 effort 返回结构化错误
3. 成功响应包含 `effort`
4. 读接口能回显 `effort`

### 5.6 Frontend API / interaction tests

测试对象：

1. task api client
2. create dialog
3. task display / task contract parser

这一层验证：

1. create payload 能发送 `effort`
2. capabilities 返回的 `models[].efforts` 能驱动选择器
3. detail / list 返回的 `effort` 能被前端 contract 正确解析

## 6. 红绿灯开发节奏

### 6.1 第一盏灯：锁定 effort 统一语义

先写红灯测试：

1. `effort` 缺省时被归一化为 `null`
2. 合法 Harbor effort 会被保留
3. 非法字符串会被拒绝
4. `none` 不被 create API 接受

变绿目标：

1. create effort 语义稳定
2. “未指定”和“非法值”被明确区分

### 6.2 第二盏灯：锁定 capability-aware 校验

先写红灯测试：

1. model 支持 `medium` 时 create 可通过
2. model 不支持 `xhigh` 时 create 被拒绝
3. executor / model 无法可靠解析时 create 被拒绝
4. 不传 effort 时不会触发无意义拒绝

变绿目标：

1. create 不再接受任意字符串 effort
2. 不支持的 effort 组合不会 silently degrade

### 6.3 第三盏灯：create 持久化 runtime snapshot

先写红灯测试：

1. create 指定 `effort` 时 `TaskRuntimeConfig` 包含该值
2. taskRecordStore.create 收到带 `effort` 的 runtimeConfig
3. 新建 execution 行会写入 `executorEffort`
4. task detail 返回相同 `effort`

变绿目标：

1. create → persistence snapshot 链路稳定
2. effort 不会只存在于内存中

### 6.4 第四盏灯：runtime 真正收到 effort

先写红灯测试：

1. create 传入 `high` 时 Codex runtime options 收到 `high`
2. create 传入 `xhigh` 时 Claude options 收到 `max`
3. 未指定 effort 时 runtime options 不伪造默认值
4. runtime start failure 不会擦掉已持久化的 effort snapshot

变绿目标：

1. runtime boundary 真正消费 persisted effort
2. adapter mapping 与 task contract 明确解耦

### 6.5 第五盏灯：resume 复用 persisted effort

先写红灯测试：

1. execution 中已有 `executorEffort=medium` 时，resume runtimeConfig 带 `medium`
2. resume route body 不接受新的 `effort`
3. resume 不会把 persisted effort 覆盖为 `null`
4. resume 在 detail 投影里继续显示原 effort

变绿目标：

1. 同一 task 的 effort snapshot 稳定
2. resume 不会悄悄改变 create 语义

### 6.6 第六盏灯：HTTP contract 与前端 create payload

先写红灯测试：

1. `POST /v1/tasks` 接受 `effort`
2. `POST /v1/tasks` 返回的 task 包含 `effort`
3. task api client 会把 `effort` 序列化到 body
4. frontend task contract 可以解析 `effort`

变绿目标：

1. 前后端 contract 对齐
2. 旧 create 调用保持兼容

### 6.7 第七盏灯：create dialog 选择行为

先写红灯测试：

1. 切换 model 后 effort 选项按 capability 列表更新
2. 已选 effort 不再受支持时会被清空或重置
3. 未选择 effort 时提交 payload 不强填默认值
4. 已选 effort 时 create mutation 收到相同值

变绿目标：

1. UI 选择与 capability contract 一致
2. effort 不会在前端状态切换中失真

## 7. 首批必须落地的测试清单

后端首批必须补的测试：

1. create with supported effort -> runtimeConfig + persistence snapshot
2. create with unsupported effort -> structured validation error
3. task detail / list include effort projection
4. runtime options builder forwards effort to Codex
5. runtime options builder maps effort for Claude Code
6. resume reuses persisted effort

前端首批必须补的测试：

1. task api client sends `effort`
2. task contract parser reads `effort`
3. create dialog filters effort options by selected model
4. create dialog clears invalid stale effort after model switch

## 8. 完成标准

当以下测试全部存在并稳定通过时，这次 effort 接入的 TDD 第一阶段才算完成：

1. effort 统一语义已被测试锁定
2. capability-aware 校验已被测试锁定
3. create → persistence → runtime 透传已被测试锁定
4. resume 复用 persisted effort 已被测试锁定
5. 前后端 contract 已被测试锁定
