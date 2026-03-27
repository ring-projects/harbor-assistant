# Swarm Orchestration Capability Archive

## 1. 文档信息

- 文档名称：Swarm Orchestration Capability Archive
- 日期：2026-03-26
- 状态：Archived Product Idea / Foundation Planning
- 适用范围：
  - future multi-agent orchestration capability
  - `task` / future `orchestration` context 边界讨论
  - service capability design 与 agent skill strategy design
- 关联文档：
  - [../task-context-design-2026-03-25.md](../task-context-design-2026-03-25.md)
  - [../interaction-context-design-2026-03-24.md](../interaction-context-design-2026-03-24.md)
  - [../project-context-design-2026-03-24.md](../project-context-design-2026-03-24.md)
  - [../task-api.md](../task-api.md)
  - [../service-database-schema-design-2026-03-25.md](../service-database-schema-design-2026-03-25.md)

## 2. 背景

当前系统已经具备单 `task` 的创建、执行、事件流和 resume 能力。

现在希望支持一种更高级的工作流：

1. 用户发起一个复杂任务
2. 系统先通过一个 task 分析需求，产出需求文档
3. 系统再按计划开启 N 个 swarm sub task 并发执行
4. 所有 sub task 完成后，系统自动恢复上层汇总 task
5. 汇总 task 继续评估结果、补漏并输出综合结论

这个方向在产品层面成立，但它不应直接被建模为“task 自带父子树能力”。

## 3. 关键判断

### 3.1 这是一个能力组合问题，不是单点功能问题

这个需求不应该先被实现成一个巨大的 `swarmTask()`。

更合理的方向是：

1. `service` 暴露稳定、可组合、可审计的基础能力
2. `agent` 通过 skill 决定何时调用哪些能力
3. orchestration 来自能力编排，而不是来自一个过载的单体特性

一句话收敛：

```text
Service owns deterministic primitives.
Skill owns strategy, decomposition, and composition.
```

### 3.2 `task` 不应该被重新做脏

现阶段已经明确：

1. `task` 是原子工作单元
2. `resume` 继续的是同一个 execution
3. `task` 不拥有 hierarchy / lineage / orchestration relation

因此这个新需求不应通过以下方式落地：

1. 给 `Task` 增加 `parentTaskId`
2. 给 `Task` 增加 `subTasks[]`
3. 让 `task` 自己负责 fan-out / join / barrier / auto-resume policy

否则 `task` 会再次退化成“万能执行容器”。

### 3.3 “完整上下文”必须被重新定义

这里的“完整上下文”不应理解为：

1. 把父任务完整 transcript 原样复制给每个 sub task
2. 把所有历史事件、所有文件、所有提示词一股脑注入

更合理的定义是：

1. 为每个 sub task 生成完整但有边界的 `ContextBundle`
2. 它包含完成该子任务所需的全部关键信息
3. 它不是系统全部原始上下文的无约束复制

## 4. 目标原则

后续如果要推进 multi-agent / swarm，必须坚持以下原则：

1. 基础能力优先于大而全功能
2. 组合优先于内建巨型编排器
3. strategy 下沉到 skill，而不是堆在 service route
4. task 保持原子语义
5. orchestration 如有需要，单独建模
6. context 必须结构化，而不是隐式 prompt 拼接
7. 所有自动动作都必须可观测、可恢复、可审计

## 5. 推荐的职责分层

### 5.1 Service 应提供什么

`service` 只负责基础能力，不负责替 agent 做“智能决策”。

推荐由 `service` 提供的能力包括：

1. 创建 task
2. 查询 task / execution / event
3. resume 现有 task execution
4. 读写 artifact
5. 读写结构化文档
6. 声明 task 之间的依赖关系或等待条件
7. 发起一批 task
8. 观察一批 task 的完成状态
9. 在条件满足时触发某个 command

### 5.2 Skill 应负责什么

skill 更适合负责策略性判断：

1. 是否需要先做需求分析
2. 是否需要拆分成多个 sub task
3. sub task 的拆分粒度
4. 每个 sub task 需要哪些上下文
5. 是否需要并发
6. 哪些结果可以直接合并，哪些需要人工或上层 task 复核
7. 何时触发 resume 汇总任务

### 5.3 未来 orchestration 如需存在，应负责什么

如果后续确实需要单独建模 `orchestration` context，它应该负责：

1. 一次 orchestration run 的计划
2. fan-out / join / barrier
3. 自动恢复策略
4. orchestration-level state machine
5. orchestration-level audit record

它不应该替代：

1. `task` 的业务语义
2. `skill` 的策略判断
3. `runtime` 的执行能力

## 6. 为实现目标，首先需要补齐哪些基础能力

这里按“先有原子能力，再谈 swarm”来拆。

### 6.1 第一层：Artifact / Document 基础能力

如果没有稳定 artifact，所谓“需求分析 -> 子任务 -> 汇总”很容易退化成 prompt 传话。

优先补齐：

1. `artifact` 读写能力
2. 结构化需求文档存储能力
3. task 与 artifact 的显式关联
4. artifact 版本或更新时间信息
5. 可被后续 task 引用的 artifact identity

第一类典型 artifact：

1. requirements doc
2. implementation plan
3. review summary
4. sub task output summary

### 6.2 第二层：ContextBundle 能力

这是 swarm 能否可控的核心。

建议把 `ContextBundle` 设计成显式能力，而不是 route 内部临时拼 prompt：

1. 从 task / project / artifact 组装上下文
2. 支持共享上下文与局部上下文分离
3. 支持按任务目标裁剪上下文
4. 支持引用已有 artifact，而不是复制全部正文
5. 支持记录 bundle 的来源，便于审计

如果这层不先做，后面的 sub task 会非常混乱。

### 6.3 第三层：Batch Task / Spawn 基础能力

swarm 至少需要稳定的批量 task 启动能力。

推荐的基础能力：

1. 一次创建多个 task
2. 每个 task 可带独立 prompt / context bundle / metadata
3. 每个 task 可指向相同或不同 project
4. 批量创建结果具备稳定 ID
5. 批量失败时有明确的部分失败语义

这里仍然只是能力，不等于已经有完整 orchestration。

### 6.4 第四层：Barrier / Wait 条件能力

如果不能表达“等哪些任务结束”，就无法做自动 resume。

建议补齐：

1. 等待一组 task 到 terminal
2. 支持 all-complete barrier
3. 支持 any-failed / timeout / partial-complete 判断
4. 支持 barrier 达成后触发后续动作

这层非常像 orchestration，但应该先以基础条件能力存在。

### 6.5 第五层：Resume Trigger 能力

目前已有手动 `resume` 基础语义，但 swarm 需要“条件触发的 resume”。

建议进一步抽象出：

1. `resume task execution` 基础 command
2. `resume trigger policy` 条件能力
3. `resume` 前注入新的补充 prompt / summary artifact
4. 明确 resume 仍然是同一个 execution

换句话说：

系统需要的是“可以自动调用既有 resume 能力”，而不是另造一套 swarm 专用 resume 语义。

### 6.6 第六层：Notification / Subscription 能力

如果 orchestration 或 skill 需要观察任务完成情况，就需要稳定订阅能力。

建议保证：

1. task 状态变化可订阅
2. execution 关键事件可订阅
3. barrier evaluator 可消费这些事件
4. delivery 与 command 继续分离

这里依然不要求 websocket 成为 command bus。

### 6.7 第七层：Skill Invocation Boundary

既然你希望未来扩展能力主要依赖 skill 组合，那么 service 需要明确“skill 可调用什么能力”。

也就是说，需要一个稳定的 capability surface，例如：

1. create task
2. read task
3. list tasks
4. create artifact
5. read artifact
6. create context bundle
7. spawn task batch
8. wait barrier
9. resume task

skill 不应该直接依赖某个内部 repository 或临时 route 拼装逻辑。

## 7. 推荐的最小推进顺序

如果目标是尽快让 swarm 方向可落地，我建议顺序如下：

1. 先做 artifact / structured document 能力
2. 再做 `ContextBundle` 能力
3. 再做 batch task spawn 能力
4. 再做 barrier / wait 条件能力
5. 再做 auto-resume trigger 能力
6. 最后才考虑是否需要独立 `orchestration` context

这个顺序的好处是：

1. 每一步都可单独复用
2. 每一步都能被 skill 直接调用
3. 即使最后不做完整 orchestration 引擎，这些能力也都不会浪费

## 8. 当前不建议立即做的事情

为避免重走 MVP 大杂烩老路，当前不建议马上做：

1. task tree 持久化模型
2. `Task.parentTaskId`
3. 重型 workflow DSL
4. 一次性把 swarm planner / scheduler / artifact / barrier 全部塞进一个模块
5. 让 websocket 承担 orchestration command

这些设计不是永远不需要，而是现在做会过早固化错误抽象。

## 9. 建议的下一步设计主题

如果继续推进，建议优先新增以下设计文档：

1. `artifact` context design
2. `context-bundle` capability design
3. `task batch spawn` capability design
4. `task barrier / wait condition` capability design
5. `skill capability surface` design

## 10. 最终收敛

这个 swarm 方向值得做，但正确切入点不是：

1. 先发明一个超级 orchestration 功能
2. 再让所有 agent 都绑死在这个功能上

正确切入点应该是：

1. 先建设可组合的基础能力
2. 再让 skill 基于这些能力进行自主决策与组合
3. 最后视复杂度决定是否抽出独立 orchestration context

一句话总结：

```text
无限扩展性更依赖稳定 primitive 的组合，
而不是依赖一个越来越复杂的中心化“高级功能”。
```
