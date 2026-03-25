# Interaction Context Design

## 1. 文档信息

- 文档名称：Interaction Context Design
- 日期：2026-03-24
- 状态：Proposed Canonical Design
- 适用范围：
  - `apps/service/src/modules/interaction`
  - future websocket gateway / subscription delivery
  - future slack / telegram / webhook channel adapter
  - `task` / `project` / `git` 对外通知被投递到用户交互端的边界
- 关联文档：
  - [backend-lite-ddd-design-2026-03-24.md](./backend-lite-ddd-design-2026-03-24.md)
  - [project-context-design-2026-03-24.md](./project-context-design-2026-03-24.md)
  - [git-project-boundary-design-2026-03-24.md](./git-project-boundary-design-2026-03-24.md)
  - [task-api.md](./task-api.md)
  - [service-error-handling-guide.md](./service-error-handling-guide.md)

## 2. 文档目标

这份文档只解决 `interaction` supporting context，不试图重新定义 `task`、`project` 或 `runtime` 本身。

它要回答的问题只有六个：

1. `interaction` 到底负责什么
2. 为什么 websocket 不能继续长在 `task` 模块里
3. `interaction` 和 `task / project / git` 之间怎样分边界
4. `interaction` 应向外暴露哪些 commands / queries / delivery ports
5. 第一阶段应该先做哪些最小能力，哪些先不要做
6. 从当前旧 socket 实现迁到新边界时，应该如何渐进迁移

这里默认一个前提：

已移除的旧 websocket gateway 只能作为现状样本，不作为目标设计依据。目标设计以主文档中的 bounded context 与 dependency direction 为准。

## 3. 设计前提

根据主文档，本设计采用以下判断作为前提：

1. `interaction` 是 supporting context，不是 core domain
2. websocket 是一种 channel adapter，不是业务 aggregate
3. `interaction` 消费 `task / project / git` 的变化，但不拥有它们的业务真相
4. `interaction` 自己拥有 connection、subscription、cursor、delivery contract
5. `task` 提供 task-side read model 与 notification boundary，但不提供 websocket payload
6. `project` 提供 project identity 与 project-scoped query / notification，但不拥有 socket session
7. `git` 提供 path-based 或 facade-based notification，不关心房间、订阅与推送协议

一句话收敛：

```text
Interaction owns channel delivery and subscription semantics.
Task, Project, and Git only provide business-facing read models or notifications.
```

## 4. 当前问题

当前旧实现的主要问题，不是“能不能推送消息”，而是边界混杂。

### 4.1 socket 代码放在 `tasks/realtime`

当前讨论的旧 gateway 已移除，本文只保留它的边界问题作为反例。

这个位置天然会给出一个错误信号：

1. 好像 websocket 是 `task` 的内部能力
2. 好像 task 有责任拥有连接、房间、订阅、游标
3. 好像以后 project realtime、git realtime 也应该继续塞进 `task`

这三个判断都不对。

### 4.2 一个 gateway 同时混入了多类责任

当前旧文件里同时处理：

1. websocket 连接管理
2. project task list 初始回放
3. task detail 初始回放
4. task events cursor replay
5. task stream 订阅
6. project git watcher 订阅
7. socket event name 与 payload 编码

这意味着一个文件同时在做：

1. interaction session 管理
2. topic subscription 管理
3. 上游查询编排
4. 渠道投递 contract 编码

这不利于长期扩展。

### 4.3 delivery contract 反向污染业务表达

当 `task` 模块直接输出：

1. `project:task_upsert`
2. `task-events:item`
3. `task:end`

这种 websocket event name 时，会出现一个问题：

渠道协议开始反向定义业务模型。

正确方向应该是：

1. `task` 提供 task read model / task event stream
2. `interaction` 决定 websocket 下要编码成什么 payload
3. 后续换成 slack / telegram / webhook 时，业务模型不需要重写

### 4.4 未来渠道扩展会复制逻辑

如果 socket 继续留在 `task` 或 `project` 中长期生长，那么后续扩展时会自然出现：

1. `tasks/realtime/slack-*`
2. `project/realtime/webhook-*`
3. `git/realtime/telegram-*`

这会让交互渠道边界长期发散。

## 5. `interaction` context 的职责边界

### 5.1 它负责什么

`interaction` context 负责以下交互真相：

1. connection / session lifecycle
2. topic subscription lifecycle
3. channel-neutral outbound delivery contract
4. websocket event naming 与 payload 编码
5. initial replay 与 live push 的编排
6. cursor / ack / reconnect policy
7. inbound interaction normalization

第一阶段可以只实现其中最必要的前四项，但 owner 必须从一开始就明确。

### 5.2 它不负责什么

`interaction` context 不负责：

1. `Task` 生命周期
2. `Project` 生命周期
3. git repository 语义
4. runtime raw event source of truth
5. task read model source of truth
6. project root path 的业务含义

尤其要避免两种退化：

1. 把 `interaction` 做成“什么都能调的 gateway 大杂烩”
2. 让 `task / project / git` 为了 websocket 反向输出渠道专属 payload

## 6. 核心概念设计

第一版不建议引入重型 aggregate，但建议至少明确三个内部概念。

### 6.1 `InteractionSession`

表示一个交互连接或外部会话端点。

第一版可以是 websocket connection，对外可见字段建议控制在：

```ts
InteractionSession {
  id: string
  channel: "websocket"
  connectedAt: string
  userId: string | null
  metadata: Record<string, string | number | boolean | null>
}
```

它的目的不是承载业务状态，而是：

1. 让连接生命周期有明确 owner
2. 让日志、追踪、限流与审计有落点
3. 为未来扩展多渠道保留统一表达

### 6.2 `Subscription`

表示某个 session 对某个 topic 的订阅关系。

第一版建议先支持三类 topic：

1. `project:{projectId}`
2. `task:{taskId}`
3. `task-events:{taskId}`

如果需要 project git realtime，建议表达成：

1. `project-git:{projectId}`

要点是：

1. topic naming 属于 `interaction`
2. topic owner 可以来自 `task / project / git`
3. topic naming 不是上游 domain model 的一部分

### 6.3 `InteractionMessage`

表示面向渠道投递的 channel-neutral outbound contract。

推荐形式：

```ts
InteractionMessage =
  | {
      topic: string
      type: "snapshot"
      payload: unknown
    }
  | {
      topic: string
      type: "event"
      payload: unknown
    }
  | {
      topic: string
      type: "error"
      payload: {
        code: string
        message: string
      }
    }
```

然后 websocket adapter 再把它编码成：

1. socket event name
2. socket payload

这样做的意义是：

1. 避免上游直接知道 websocket event name
2. 后续新增渠道时，不需要重写业务侧通知语义
3. 可以先做 channel-neutral 内部模型，再做 channel-specific adapter

## 7. 与其他上下文的边界

### 7.1 `interaction` 与 `task`

`task` 负责：

1. task detail / list / event stream read model
2. task business lifecycle
3. task business error

`interaction` 负责：

1. 订阅 task topic
2. 调用 task query / stream port 做 snapshot replay
3. 把 task read model 编码成 websocket 消息

依赖方向应该是：

```text
interaction -> task query / notification boundary
```

而不是：

```text
task -> interaction
```

### 7.2 `interaction` 与 `project`

`project` 负责：

1. `projectId` 业务身份
2. project-scoped query
3. future project-side notification

`interaction` 可以消费这些信息，但不能反向要求 `project` 输出 websocket payload。

### 7.3 `interaction` 与 `git`

`git` 负责：

1. path-based wrapper 语义
2. repository state query
3. future watcher / change notification port

`interaction` 负责：

1. 把 git 变化订阅映射成交互 topic
2. 决定如何向 websocket 客户端广播

这里要特别强调：

`project-git:{projectId}` 这种订阅语义属于 facade / interaction 视角，不属于 `git` module 本体。

### 7.4 `interaction` 与 `runtime`

`runtime` 如果未来提供 session-side internal event stream，`interaction` 也可以消费。

但原则不变：

1. `runtime` 输出内部语义
2. `interaction` 负责渠道投递
3. `runtime` 不拥有 websocket contract

## 8. 输入边界设计

### 8.1 `interaction` 不直接拥有业务仓储

新的 `interaction` module 不应该直接依赖：

1. Prisma repository 细节
2. `TaskRepository`
3. `ProjectRepository`
4. `GitRepository`

它应依赖更外显的 ports：

1. snapshot query ports
2. stream / notification subscribe ports
3. channel adapter ports

推荐方向：

```ts
type TaskInteractionQuery = {
  getTaskSnapshot(taskId: string): Promise<...>
  getTaskEventsSnapshot(input: { taskId: string; afterSequence: number; limit: number }): Promise<...>
  listProjectTasks(projectId: string, limit: number): Promise<...>
}

type TaskInteractionStream = {
  selectTask(taskId: string): Observable<...>
  selectProject(projectId: string): Observable<...>
}

type ProjectGitInteractionStream = {
  subscribe(projectId: string, onChange: (event: ...) => void): Promise<() => Promise<void> | void>
}
```

### 8.2 `interaction` 的输入不是 websocket event name

`interaction` 内部应先接受结构化订阅请求，例如：

```ts
SubscribeToTopic {
  sessionId: string
  topic: {
    kind: "project" | "task" | "task-events" | "project-git"
    id: string
    cursor?: number
    limit?: number
  }
}
```

然后再由 websocket adapter 把：

1. `subscribe:project`
2. `subscribe:task`
3. `unsubscribe:task-events`

映射为内部 command。

这样做的价值是：

1. transport protocol 和内部订阅模型分离
2. 后续换成长连接 HTTP / SSE / Slack command 时仍能复用
3. route / gateway 不再直接拼业务逻辑

## 9. 输出边界设计

### 9.1 先定义 channel-neutral delivery

第一版推荐先在 `interaction` 内部明确一个中性 contract：

```ts
type DeliveryEnvelope = {
  topic: string
  name: string
  payload: unknown
}
```

比如：

1. `{ topic: "task:123", name: "ready", payload: ... }`
2. `{ topic: "task-events:123", name: "item", payload: ... }`
3. `{ topic: "project:123", name: "task_deleted", payload: ... }`

然后 websocket adapter 再把它映射成：

1. `task:ready`
2. `task-events:item`
3. `project:task_deleted`

### 9.2 错误输出也属于 `interaction`

例如：

1. invalid topic id
2. invalid cursor
3. subscription create failed
4. upstream snapshot read failed

这些错误虽然可能源于上游模块，但它们对客户端的最终呈现方式，属于 `interaction` 的职责。

## 10. 能力面设计

### 10.1 第一版建议先做的能力

第一版建议只做最小 websocket 迁移闭环：

1. `ConnectSession`
2. `DisconnectSession`
3. `SubscribeTopic`
4. `UnsubscribeTopic`
5. `ReplayTopicSnapshot`
6. `DeliverLiveEvent`

这六项已经足够把当前旧 `task-socket.gateway` 拆开。

### 10.2 第一版先不要做的能力

第一版不建议立即做：

1. durable subscription persistence
2. 多节点 fan-out
3. ack / retry 保证投递
4. 渠道级权限系统
5. Slack / Telegram 真集成
6. websocket 之外的复杂 inbound command routing

先把边界转正，比先把功能做重更重要。

## 11. 错误边界

推荐错误分层如下。

### 11.1 `interaction` 自己负责抛

1. `INTERACTION_INVALID_TOPIC`
2. `INTERACTION_INVALID_CURSOR`
3. `INTERACTION_SUBSCRIPTION_NOT_FOUND`
4. `INTERACTION_DELIVERY_FAILED`
5. `INTERACTION_CHANNEL_NOT_SUPPORTED`

### 11.2 上游模块负责抛

1. `PROJECT_NOT_FOUND`
2. `TASK_NOT_FOUND`
3. `GIT_REPOSITORY_NOT_FOUND`
4. future runtime-side errors

### 11.3 `interaction` 负责最终对客户端编码

也就是说：

1. 上游保留自己的错误语义
2. `interaction` 不吞掉上游错误
3. 但客户端看到的错误 envelope 由 `interaction` 统一组织

## 12. 推荐模块结构

建议目录意图先明确为：

```text
apps/service/src/modules/interaction/
  application/
    commands/
    queries/
    ports/
  domain/
    interaction-session.ts
    subscription-topic.ts
    interaction-message.ts
  infrastructure/
    websocket/
      socket-io-session-adapter.ts
      socket-io-topic-mapper.ts
  routes/
  schemas/
```

如果第一阶段不想把类和实体做重，也可以是函数式目录，但边界意图不应改变。

## 13. 渐进迁移建议

### 13.1 Phase 1

先补文档与测试计划，锁定：

1. websocket owner 是 `interaction`
2. topic / subscription / delivery contract 归 `interaction`
3. `task / project / git` 只暴露 query / notification boundary

### 13.2 Phase 2

创建 `apps/service/src/modules/interaction` skeleton：

1. topic parser
2. session registry
3. subscription registry
4. delivery mapper

### 13.3 Phase 3

把旧 `task-socket.gateway` 中的逻辑拆为：

1. websocket transport adapter
2. interaction application service
3. upstream query / stream facade

### 13.4 Phase 4

保留旧 socket event contract，先做到：

1. 行为兼容
2. 代码边界转正
3. 不再在 `task` 中继续增加 realtime 逻辑

## 14. 一句话结论

`socket` 可以是面向 `task` 的基础交互支撑能力，但它不是 `task` 的子域。

长期正确表达应该是：

```text
socket/websocket belongs to interaction.
task/project/git only expose business-facing query and notification boundaries.
```
