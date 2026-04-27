# 迁移总结：从 Executors 到 Agents Module

## 迁移完成 ✅

已成功将底层 AI agent 接入从 `executors` 模块迁移到新的 `agents` 模块。

## 主要变更

### 1. 新增文件

**agents 模块核心文件：**

- `modules/agents/types.ts` - 核心类型定义
- `modules/agents/agent.interface.ts` - IAgent 统一接口
- `modules/agents/agent.factory.ts` - Agent 工厂
- `modules/agents/constants.ts` - 常量定义
- `modules/agents/index.ts` - 模块导出
- `modules/agents/README.md` - 设计文档

**适配器：**

- `modules/agents/adapters/codex.adapter.ts` - Codex 适配器（已实现）
- `modules/agents/adapters/claude-code.adapter.ts` - Claude Code 适配器（预留）

**能力检测：**

- `modules/agents/capabilities/capability.service.ts` - 统一能力检测
- `modules/agents/capabilities/codex.capability.ts` - Codex 能力检测
- `modules/agents/capabilities/claude-code.capability.ts` - Claude Code 能力检测

**工具函数：**

- `modules/agents/utils/command.utils.ts` - 命令行工具

**Tasks 模块更新：**

- `modules/tasks/agent.gateway.ts` - 新的 agent 网关（替代 codex-sdk.gateway）

**其他：**

- `lib/prisma.ts` - Prisma 客户端辅助函数

### 2. 更新的文件

- `modules/tasks/task-runner.service.ts` - 使用新的 agent gateway
- `modules/tasks/task.service.ts` - 移除对 executors 的引用
- `modules/capability/capability.service.ts` - 使用新的 agents 能力检测
- `modules/codex-config/config.service.ts` - 使用 agents 模块的常量
- `routes/v1/capabilities.routes.ts` - 新增 `/agents/capabilities` API，保留旧 API 兼容

### 3. 删除的文件

- `modules/executors/` - 整个目录
  - `executors/adapters/codex.adapter.ts`
  - `executors/shared/command.ts`
  - `executors/types.ts`
- `modules/tasks/codex-sdk.gateway.ts` - 旧的 Codex SDK 网关
- `constants/executors.ts` - 旧的 executor 常量
- `constants/codex.ts` - 旧的 codex 常量

## 架构改进

### 统一接口设计

所有 AI agent 现在都实现 `IAgent` 接口：

```typescript
interface IAgent {
  getType(): string
  startSessionAndRun(options, prompt, signal): AsyncIterable<AgentEvent>
  resumeSessionAndRun(
    sessionId,
    options,
    prompt,
    signal,
  ): AsyncIterable<AgentEvent>
  getCapabilities(): Promise<AgentCapabilities>
}
```

### 事件驱动模型

使用统一的 `AgentEvent` 类型，支持：

- session.started / session.completed
- turn.started / turn.completed / turn.failed
- message (user/assistant/system)
- command.started / command.output / command.completed
- reasoning / todo_list / error

### 工厂模式

通过 `AgentFactory` 获取适配器：

```typescript
const agent = AgentFactory.getAgent("codex")
const events = agent.startSessionAndRun(options, prompt)
```

## API 变更

### 新增 API

- `GET /api/v1/agents/capabilities` - 获取所有 agent 能力信息

### 兼容性

- `GET /api/v1/executors/capabilities` - 保留并映射到新的 agents API

## 数据库变更

无需数据库迁移，现有数据结构保持不变。

## 后续扩展

添加新的 agent（如 Claude Code）只需：

1. 在 `types.ts` 中添加新的 `AgentType`
2. 在 `constants.ts` 中添加命令候选列表
3. 创建能力检测文件 `capabilities/xxx.capability.ts`
4. 创建适配器 `adapters/xxx.adapter.ts` 实现 `IAgent` 接口
5. 在 `agent.factory.ts` 中注册新的适配器

## 验证

✅ TypeScript 类型检查通过
✅ 所有旧文件已删除
✅ 新的 agents 模块结构完整
✅ API 兼容性保持
