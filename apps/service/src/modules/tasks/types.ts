import type { AgentEvent } from "../../lib/agents"

export type TaskStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"

export type TaskMessageRole = "user" | "assistant" | "system"

export type CodexTask = {
  id: string
  projectId: string
  projectPath: string
  prompt: string
  executor: string
  model: string | null
  status: TaskStatus
  threadId: string | null
  parentTaskId: string | null
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
