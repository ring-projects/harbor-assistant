import type { AgentEvent } from "../../lib/agents"
import type {
  RuntimeExecutionMode,
  RuntimePolicy,
} from "./runtime-policy"

export type TaskStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"

export type TaskMessageRole = "user" | "assistant" | "system"
export type TaskTitleSource = "prompt" | "agent" | "user"

export type CodexTask = {
  id: string
  projectId: string
  projectPath: string
  prompt: string
  title: string
  titleSource: TaskTitleSource
  titleUpdatedAt: string | null
  executor: string
  executionMode: RuntimeExecutionMode | null
  runtimePolicy: RuntimePolicy | null
  model: string | null
  status: TaskStatus
  threadId: string | null
  parentTaskId: string | null
  archivedAt: string | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  exitCode: number | null
  command: string[]
  stdout: string
  stderr: string
  error: string | null
}

export type TaskAgentEventType = AgentEvent["type"]

export type TaskAgentEvent = {
  id: string
  taskId: string
  sequence: number
  eventType: TaskAgentEventType
  payload: Record<string, unknown>
  createdAt: string
}

export type TaskAgentEventStream = {
  taskId: string
  items: TaskAgentEvent[]
  nextSequence: number
}

export type TaskErrorCode =
  | "INVALID_TASK_ID"
  | "STORE_READ_ERROR"
  | "STORE_WRITE_ERROR"
  | "NOT_FOUND"
