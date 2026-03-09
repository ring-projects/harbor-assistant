# Agents Library

Infrastructure layer for AI agent integration. Provides a unified interface for integrating different AI coding agents (Codex, Claude Code, etc.).

## Architecture

### Core Concepts

- **IAgent Interface**: Unified interface that all agent adapters must implement
- **Adapter Pattern**: Each AI agent has its own adapter that converts its SDK to the unified interface
- **Event Stream**: Uses `AsyncIterable<AgentEvent>` to provide a unified event stream model
- **Capability Detection**: Independent capability service to detect installed agents and available models

### Directory Structure

```
lib/agents/
├── types.ts                    # Core type definitions
├── interface.ts                # Unified agent interface
├── factory.ts                  # Agent factory
├── constants.ts                # Constants
├── index.ts                    # Module exports
├── adapters/                   # Agent adapters
│   ├── codex.ts               # Codex adapter
│   └── claude-code.ts         # Claude Code adapter
├── capabilities/               # Capability detection
│   ├── index.ts               # Unified capability service
│   ├── codex.ts               # Codex capability detection
│   └── claude-code.ts         # Claude Code capability detection
└── utils/                      # Utility functions
    └── command.ts             # Command-line utilities
```

## Usage Examples

### 1. Detect Available Agents

```typescript
import { inspectAllAgentCapabilities } from '@/lib/agents'

const capabilities = await inspectAllAgentCapabilities()
console.log('Available agents:', capabilities.availableAgents)
console.log('Codex installed:', capabilities.agents.codex.installed)
console.log('Codex models:', capabilities.agents.codex.models)
```

### 2. Use Agent Factory to Get Adapter

```typescript
import { AgentFactory } from '@/lib/agents'

// Get Codex adapter
const agent = AgentFactory.getAgent('codex')

// Start new session and run task
const events = agent.startSessionAndRun(
  {
    workingDirectory: '/path/to/project',
    model: 'gpt-4',
    sandboxMode: 'workspace-write',
  },
  'Fix the bug in auth.ts',
)

// Handle event stream
for await (const event of events) {
  switch (event.type) {
    case 'session.started':
      console.log('Session started:', event.sessionId)
      break
    case 'message':
      console.log(`${event.role}: ${event.content}`)
      break
    case 'command.output':
      console.log('Output:', event.output)
      break
    case 'error':
      console.error('Error:', event.message)
      break
  }
}
```

### 3. Resume Existing Session

```typescript
const agent = AgentFactory.getAgent('codex')

const events = agent.resumeSessionAndRun(
  'session-id-123',
  {
    workingDirectory: '/path/to/project',
    model: 'gpt-4',
  },
  'Continue with the previous task',
)

for await (const event of events) {
  // Handle events
}
```

## Event Types

All agent adapters emit unified `AgentEvent` types:

- `session.started` - Session started
- `turn.started` - Turn started
- `message` - Message (user/assistant/system)
- `command.started` - Command execution started
- `command.output` - Command output
- `command.completed` - Command execution completed
- `reasoning` - Reasoning process
- `todo_list` - TODO list
- `error` - Error
- `turn.completed` - Turn completed
- `turn.failed` - Turn failed
- `session.completed` - Session completed

## Adding New Agents

To add a new agent (e.g., Claude Code):

1. Add new `AgentType` in `types.ts`
2. Add command candidates in `constants.ts`
3. Create capability detection file `capabilities/xxx.ts`
4. Create adapter `adapters/xxx.ts` implementing `IAgent` interface
5. Register new adapter in `factory.ts`

## Integration with Modules

Business modules should use agents through the factory:

```typescript
import { AgentFactory } from '@/lib/agents'

// In task runner
const agent = AgentFactory.getAgent('codex')
const events = agent.startSessionAndRun(options, prompt, signal)

// Handle events and persist to database
for await (const event of events) {
  await persistEvent(taskId, event)
}
```

## Advantages

1. **Decoupling**: Business modules don't directly depend on specific AI SDKs
2. **Extensibility**: Adding new agents only requires new adapters
3. **Unified**: All agents use the same interface and event model
4. **Testable**: Easy to mock IAgent interface
5. **Type-safe**: Complete TypeScript type definitions
