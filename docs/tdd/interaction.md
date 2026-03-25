# Interaction TDD 红绿灯计划

## 1. 文档信息

- 文档名称：Interaction TDD 红绿灯计划
- 日期：2026-03-24
- 状态：Proposed
- 适用范围：
  - `interaction` context
  - `apps/service/src/modules/interaction`
- 关联文档：
  - [../interaction-context-design-2026-03-24.md](../interaction-context-design-2026-03-24.md)
  - [../backend-lite-ddd-design-2026-03-24.md](../backend-lite-ddd-design-2026-03-24.md)
  - [../project-context-design-2026-03-24.md](../project-context-design-2026-03-24.md)
  - [../git-project-boundary-design-2026-03-24.md](../git-project-boundary-design-2026-03-24.md)

## 2. 目标

这份文档只规划新的 `interaction` module 如何按 TDD 推进，不讨论 `task` 聚合内部实现，也不讨论最终多渠道扩展细节。

核心目标有四个：

1. 把 websocket 从 `task` 内部实现迁成独立 `interaction` context
2. 用测试先固定 topic、subscription、delivery contract 语义
3. 保持上游 `task / project / git` 不被 websocket payload 反向污染
4. 先完成最小 websocket 闭环，再考虑未来多渠道扩展

这里默认采用的设计前提是：

1. `interaction` 拥有 session / subscription / delivery
2. `interaction` 消费上游 query / notification ports
3. `task / project / git` 不反向依赖 `interaction`

## 3. TDD 总原则

新的 `interaction` module 必须坚持一条底线：

先定义 topic、订阅与投递语义测试，再写 transport adapter。

推荐顺序：

1. topic / payload mapper tests
2. application service tests
3. adapter integration tests
4. compatibility contract tests
5. HTTP 或 socket handshake tests（仅在需要时补）

不建议的顺序：

1. 先复制旧 `task-socket.gateway.ts` 再挪目录
2. 先把 socket.io 接线做通，再回头抽边界
3. 先为 websocket 写一堆 event name，再反推内部模型

原因很简单：

`interaction` 的核心复杂度不在 socket.io API，而在：

1. topic 语义
2. snapshot replay
3. live subscription lifecycle
4. channel-neutral delivery contract

## 4. 每一轮红绿灯怎么执行

后续每个 interaction use case 都按同一模板推进，不允许跳步。

### 4.1 红灯

先写一个失败测试，只表达一个明确语义：

1. 输入 topic 是什么
2. session 当前状态是什么
3. 上游 query / stream port 返回什么
4. 期望发出什么 delivery envelope 或错误

红灯阶段的要求：

1. 先失败，且失败原因清晰
2. 一次只锁一个行为
3. 不为了“顺手通过”而提前实现 transport 细节

### 4.2 绿灯

再补最小实现让测试通过：

1. 只写让当前失败测试变绿所需的最小代码
2. 不提前抽象多渠道框架
3. 不在这一轮顺手做权限、重连、持久化订阅

### 4.3 重构

测试变绿之后，再做必要重构：

1. 消除重复 topic 解析逻辑
2. 收紧错误分类
3. 收紧 delivery envelope 命名
4. 保持对外兼容 contract 不变

重构阶段不允许：

1. 扩展到上游 domain 内部
2. 让 `task / project / git` 返回 websocket payload
3. 为未来渠道提前做重型抽象

## 5. 测试分层

### 5.1 Topic / mapper tests

测试对象：

1. topic kind 解析
2. `project:{id}` / `task:{id}` / `task-events:{id}` / `project-git:{id}` 的合法性
3. cursor / limit 规范化
4. topic 到 delivery name 的映射
5. outbound error envelope 编码

这一层应该尽量纯函数化，不碰：

1. Fastify
2. Prisma
3. socket.io server 实例
4. 真实数据库

### 5.2 Application tests

测试对象：

1. `ConnectSession`
2. `DisconnectSession`
3. `SubscribeTopic`
4. `UnsubscribeTopic`
5. `ReplayTopicSnapshot`
6. `DeliverLiveEvent`

这一层验证：

1. session / subscription 生命周期
2. interaction 如何调用上游 query / stream port
3. 上游错误如何映射成 interaction error envelope
4. delivery contract 是否稳定

### 5.3 Adapter integration tests

测试对象：

1. websocket adapter
2. socket event 到 interaction command 的映射
3. interaction delivery envelope 到 socket event 的映射
4. disconnect 时自动清理订阅

这一层只验证：

1. transport 接线是否真的跑通
2. adapter 与 application service 的契约是否一致
3. 不重复证明上游业务语义

### 5.4 Compatibility contract tests

如果现阶段需要兼容旧前端 socket contract，这一层必须单独存在。

测试对象：

1. `task:ready`
2. `task-events:item`
3. `task:end`
4. `project:task_upsert`
5. `project:task_deleted`
6. `project:git_changed`
7. `subscription:error`

这层的目标不是证明设计优雅，而是：

1. 先保证旧客户端不被破坏
2. 再逐步把 owner 转到 `interaction`

### 5.5 HTTP / handshake tests（后置可选）

只有在以下条件成立时才建议补：

1. socket 握手参数需要稳定校验
2. 认证信息进入连接层的逻辑需要单独约束
3. Fastify 插件与 websocket adapter 有独立接线价值

这一层不是第一阶段核心范围。

## 6. 红绿灯开发节奏

这里的“红绿灯”是指每一阶段都要遵守：

1. 先写失败测试
2. 再补最小实现让测试变绿
3. 最后做必要重构，不扩边界

### 6.1 第一盏灯：topic 与参数纯逻辑

先写红灯测试：

1. 合法 topic 能被解析为结构化订阅对象
2. 缺失 id 会返回 `INTERACTION_INVALID_TOPIC`
3. 非法 cursor 会返回 `INTERACTION_INVALID_CURSOR`
4. topic kind 能稳定映射到内部 topic name
5. socket event name 不直接出现在上游 port contract 中

变绿目标：

1. helper / topic policy 纯函数通过
2. 不引入真实 websocket adapter

### 6.2 第二盏灯：snapshot replay

先写红灯测试：

1. 订阅 `project` topic 时会先拉取 project task snapshot
2. 订阅 `task` topic 时会先拉取 task detail snapshot
3. 订阅 `task-events` topic 时会按 cursor 回放 events
4. 订阅 `project-git` topic 时若无 snapshot，可只返回 ready
5. 上游 query 失败时返回结构化 `subscription:error`

变绿目标：

1. interaction 只依赖 query port
2. replay 逻辑与 websocket adapter 分离
3. delivery envelope 稳定

### 6.3 第三盏灯：live subscription

先写红灯测试：

1. 订阅 `project` topic 后会建立 live stream
2. 重复订阅同一 topic 不重复挂第二个上游订阅
3. `unsubscribe` 后会释放上游订阅
4. `disconnect` 后会清理全部 session 订阅
5. live event 会被映射为稳定 delivery envelope

变绿目标：

1. session registry 稳定
2. subscription registry 稳定
3. 上游 stream 生命周期由 interaction 接管

### 6.4 第四盏灯：compatibility adapter

先写红灯测试：

1. 旧 `subscribe:project` 能映射到内部 `SubscribeTopic(project)`
2. 旧 `subscribe:task-events` 能映射 cursor / limit
3. 内部 delivery envelope 能编码为现有 socket event name
4. `subscription:error` 在旧 contract 下保持兼容

变绿目标：

1. 旧客户端 contract 不变
2. 旧 event name 不再直接出现在上游业务模块里

### 6.5 第五盏灯：真实 websocket adapter 集成

先写红灯测试：

1. 真实 socket.io client 能完成连接与订阅
2. snapshot 会按预期顺序发送
3. live event 到达后会被推送
4. disconnect 后不再继续投递

变绿目标：

1. websocket adapter 真正可用
2. 传输层接线与应用层边界保持分离

### 6.6 第六盏灯：上游 facade 协作

如果 `interaction` 需要消费新的 project-scoped facade，这一盏灯再补。

先写红灯测试：

1. `interaction` 通过 facade 消费 `project -> git` 的 project-scoped 通知
2. `PROJECT_NOT_FOUND` 与 `GIT_REPOSITORY_NOT_FOUND` 不被混淆
3. `interaction` 不直接依赖 repository 细节

变绿目标：

1. 上游边界清晰
2. interaction 只做编排与投递

## 7. 测试文件组织建议

推荐按分层组织：

```text
apps/service/src/modules/interaction/
  domain/
    __tests__/
      subscription-topic.test.ts
      delivery-envelope.test.ts
  application/
    __tests__/
      subscribe-topic.test.ts
      unsubscribe-topic.test.ts
      replay-topic-snapshot.test.ts
  infrastructure/
    websocket/
      __tests__/
        socket-io-adapter.test.ts
        socket-contract-compatibility.test.ts
```

如果第一版仍需要兼容旧实现，也建议把 compatibility tests 独立命名，不要混进业务语义测试。

## 8. Mock / Fake 策略

推荐测试替身策略如下：

1. topic parser 使用纯函数测试，不需要 mock
2. application tests 使用 fake query port / fake stream port
3. websocket adapter tests 使用最小 fake session emitter
4. compatibility tests 只验证 event mapping，不接真实业务仓储

不建议：

1. 在 interaction tests 里直接接 Prisma
2. 在 interaction tests 里直接跑真实 git
3. 为了测试 websocket 去重建整个 `task` 业务流

## 9. 完成标准

当下面条件同时成立时，可以认为第一阶段 `interaction` TDD 已经完成：

1. topic / cursor / delivery mapper 纯逻辑测试通过
2. snapshot replay tests 通过
3. live subscription lifecycle tests 通过
4. websocket compatibility adapter tests 通过
5. 旧 `task-socket.gateway` 的核心逻辑已经迁到 `interaction`
6. `task / project / git` 不再直接拥有 websocket payload contract

## 10. 一句话结论

`interaction` 的 TDD 顺序，必须从 topic 与 subscription 语义开始，而不是从 socket.io API 开始。

也就是说：

```text
first lock interaction semantics, then wire websocket transport.
```
