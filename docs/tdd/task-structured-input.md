# Task Structured Input TDD 红绿灯计划

> [!WARNING]
> **状态：已过时（Outdated）**
> 当前系统主模型已调整为 `Orchestration -> N Tasks`。
> 这些文档仍可作为历史背景参考，但不应再作为最新设计依据。
> 请优先参考：`docs/orchestration-requirements-2026-03-31.md` 与 `docs/tdd/orchestration.md`。


## 1. 文档信息

- 文档名称：Task Structured Input TDD 红绿灯计划
- 日期：2026-03-28
- 状态：Proposed
- 适用范围：
  - `apps/service/src/modules/task`
  - `apps/service/src/lib/agents`
  - `apps/web/src/modules/tasks`
- 关联文档：
  - [../task-structured-input-requirements-2026-03-28.md](../task-structured-input-requirements-2026-03-28.md)
  - [../task-api.md](../task-api.md)
  - [../task-event-storage-model.md](../task-event-storage-model.md)
  - [./task.md](./task.md)

## 2. 目标

这份文档只规划“task 结构化输入与本地图片接入”如何按 TDD 推进，不讨论更广的 runtime 演进。

核心目标只有五个：

1. 先用测试锁住输入 source-of-truth 语义
2. 再收敛 create / resume 的输入协议
3. 明确 Harbor 主动写入 user input event 的时机
4. 最后才接前端上传与 composer 行为
5. 保证旧文本链路继续可用

## 3. TDD 总原则

这次改造必须坚持一条底线：

先锁输入语义测试，再改 runtime 编排，再接前端上传。

推荐顺序：

1. domain / helper tests
2. application use case tests
3. runtime state / persistence tests
4. route tests
5. frontend api / hook tests
6. frontend interaction tests

不建议的顺序：

1. 先改 composer UI，再回头想 execution event 该存什么
2. 先把图片上传接通，再决定输入 source of truth
3. 先让 Codex 能吃图片，再回头补 create / resume 落库语义

原因很简单：

这次改造最容易返工的不是上传 API，而是以下三个判断：

1. 原始输入是谁的 source of truth
2. `Task.prompt` 还承担什么职责
3. 用户输入事件是同步业务步骤还是异步补写

## 4. 每一轮红绿灯怎么执行

后续每个输入相关改造都按同一模板推进，不允许跳步。

### 4.1 红灯

先写一个失败测试，只表达一个明确语义：

1. 输入是什么
2. 当前 task / execution state 是什么
3. 依赖 port 返回什么
4. 期望持久化什么 event / task summary / route response

### 4.2 绿灯

再补最小实现让测试通过：

1. 只写让当前测试变绿的最小代码
2. 不顺手提前改所有前端 state
3. 不顺手重做 event projection 体系

### 4.3 重构

测试变绿之后，再做必要重构：

1. 收紧输入归一化 helper
2. 消除 create / resume 重复逻辑
3. 收紧 route schema 与 runtime port 命名
4. 保持输入 source-of-truth 不变

## 5. 测试分层

### 5.1 Input helper tests

测试对象：

1. `AgentInput` 摘要提取
2. `prompt` 与 `items` 的兼容归一化
3. 仅图片输入的摘要生成

这一层不碰：

1. Prisma
2. Fastify
3. websocket
4. provider runtime

### 5.2 Application tests

测试对象：

1. `CreateTask`
2. `ResumeTask`

这一层验证：

1. create / resume 接收 `string | AgentInputItem[]`
2. `Task.prompt` 只保存 summary
3. user input event 会在 runtime 前被要求持久化
4. 启动失败时输入不丢失

### 5.3 Runtime persistence tests

测试对象：

1. execution user input event 写入
2. raw payload 是否保留原始输入
3. event sequence 与 source 是否正确

这一层验证：

1. Harbor 主动写入 input event
2. provider event 与 user input event 不混淆
3. `ExecutionEvent.rawPayload` 真正能充当 source of truth

### 5.4 Route tests

测试对象：

1. `POST /v1/tasks`
2. `POST /v1/tasks/:taskId/resume`
3. `POST /v1/projects/:projectId/task-input-images`

这一层只验证：

1. body schema 接受 `prompt` 与 `items`
2. 非法输入返回结构化错误
3. 上传 API 的 content validation 与返回路径 contract

### 5.5 Frontend API / hook tests

测试对象：

1. task api client
2. create / resume mutation hooks
3. queued / pending input hooks

这一层验证：

1. create / resume payload 能发 `AgentInput`
2. 上传图片后会生成 `local_image`
3. pending / queued 输入不再只依赖字符串

### 5.6 Frontend interaction tests

测试对象：

1. create dialog
2. session composer
3. conversation blocks mapper

这一层验证：

1. 粘贴图片与拖拽图片触发上传
2. 用户输入事件能展示文本与附件
3. running task 的 queued input 在带图片时仍能自动续跑

## 6. 红绿灯开发节奏

### 6.1 第一盏灯：锁定输入 source of truth

先写红灯测试：

1. `CreateTask` 传入 `string` 时会生成 summary
2. `CreateTask` 传入 `AgentInputItem[]` 时会生成 summary
3. `ResumeTask` 不修改 `Task.prompt`
4. 原始输入不能从 `Task.prompt` 恢复

变绿目标：

1. `Task.prompt` 被正式降级为 summary
2. 原始输入与 summary 语义分离

### 6.2 第二盏灯：Harbor 主动写入 user input event

先写红灯测试：

1. create 在启动 runtime 前会写入 user input event
2. resume 在恢复 execution 前会写入 user input event
3. user input event 的 `rawPayload.input` 等于原始 `AgentInput`
4. input event 的 `source` 是 Harbor，而不是 provider

变绿目标：

1. 输入落库不再依赖后台异步补写
2. execution event 真正成为输入 source of truth

### 6.3 第三盏灯：runtime 透传真实输入

先写红灯测试：

1. create 传入 `string` 时 runtime 收到 `string`
2. create 传入 `AgentInputItem[]` 时 runtime 收到数组
3. resume 传入结构化图片输入时 Codex runtime 原样收到 `local_image`
4. `Task.prompt` 不参与 runtime 输入重建

变绿目标：

1. runtime boundary 只消费真实输入
2. summary 与真实输入解耦

### 6.4 第四盏灯：HTTP contract 兼容扩展

先写红灯测试：

1. `POST /v1/tasks` 仍接受 `prompt`
2. `POST /v1/tasks` 接受 `items`
3. `POST /v1/tasks/:taskId/resume` 仍接受 `prompt`
4. `POST /v1/tasks/:taskId/resume` 接受 `items`
5. 空 `prompt` 与空 `items` 会被拒绝

变绿目标：

1. route schema 稳定
2. 旧客户端继续可用
3. 新结构化客户端成为 first-class input path

### 6.5 第五盏灯：图片上传 API

先写红灯测试：

1. 合法图片能写入 `.harbor/task-input-images`
2. 返回路径是 project-root-relative path
3. 非法 media type 会被拒绝
4. 超出大小上限会被拒绝

变绿目标：

1. 上传 API 稳定
2. `local_image.path` contract 稳定

### 6.6 第六盏灯：前端 pending / queued 输入

先写红灯测试：

1. running task 上可排队文本 + 图片输入
2. queued input 在当前 turn 完成后会自动续跑
3. 自动续跑时仍发送相同输入
4. create dialog 与 session composer 的输入能力一致

变绿目标：

1. 前端不再把“下一次输入”限定为纯文本
2. 图片输入不会在 queued / pending 过程中丢失

### 6.7 第七盏灯：conversation 展示

先写红灯测试：

1. `event.payload.input` 为 `string` 时展示文本
2. `event.payload.input` 为数组时展示 text 内容
3. 数组中的 `local_image` 会显示为附件条目
4. 旧 `message.content` 事件仍能继续显示

变绿目标：

1. 新旧事件展示兼容
2. 用户输入在 UI 中真正可见、可验证

## 7. 首批必须落地的测试清单

后端首批必须补的测试：

1. create text input -> summary + persisted input event
2. create structured input -> summary + persisted input event
3. create image-only input -> image summary + persisted input event
4. resume structured input -> persisted input event + unchanged task summary
5. runtime start failure -> input event still exists
6. Codex runtime receives `local_image`

前端首批必须补的测试：

1. task api client can send `items`
2. upload image returns `local_image.path`
3. session resume hook preserves queued structured input
4. create dialog preserves uploaded images before submit
5. conversation mapper renders user attachments

## 8. 完成标准

当以下测试全部存在并稳定通过时，这次输入协议改造的 TDD 第一阶段才算完成：

1. 输入 source-of-truth 语义已被测试锁定
2. Harbor 主动写入 input event 已被测试锁定
3. runtime 透传真实输入已被测试锁定
4. route 兼容 contract 已被测试锁定
5. 前端图片输入行为已被测试锁定
