export type TaskStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"

export type TaskEventType = "state" | "stdout" | "stderr" | "system" | "summary"

export type TaskMessageRole = "user" | "assistant" | "system"

export type CodexTask = {
  id: string
  projectId: string
  projectPath: string
  prompt: string
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

export type TaskEvent = {
  id: string
  taskId: string
  runId: string
  sequence: number
  type: TaskEventType
  payload: string
  createdAt: string
}

export type TaskConversationMessage = {
  id: string
  taskId: string
  role: TaskMessageRole
  content: string
  timestamp: string | null
  source: string
}

export type TaskConversation = {
  taskId: string
  threadId: string | null
  rolloutPath: string | null
  messages: TaskConversationMessage[]
  truncated: boolean
}

export type TaskErrorCode =
  | "INVALID_TASK_ID"
  | "STORE_READ_ERROR"
  | "STORE_WRITE_ERROR"
  | "NOT_FOUND"
