export type TaskStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"

export type TaskMessageRole = "user" | "assistant" | "system"

export type TaskTimelineItemKind =
  | "message"
  | "status"
  | "stdout"
  | "stderr"
  | "summary"
  | "error"
  | "system"

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

export type TaskTimelineItem = {
  id: string
  taskId: string
  sequence: number
  kind: TaskTimelineItemKind
  role: TaskMessageRole | null
  status: TaskStatus | null
  source: string | null
  content: string | null
  payload: string | null
  createdAt: string
}

export type TaskTimeline = {
  taskId: string
  items: TaskTimelineItem[]
  nextSequence: number
}

export type TaskErrorCode =
  | "INVALID_TASK_ID"
  | "STORE_READ_ERROR"
  | "STORE_WRITE_ERROR"
  | "NOT_FOUND"
