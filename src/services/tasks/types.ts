export type TaskStatus = "queued" | "running" | "completed" | "failed"

export type CodexTask = {
  id: string
  projectId: string
  projectPath: string
  prompt: string
  model: string | null
  status: TaskStatus
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  exitCode: number | null
  command: string[]
  stdout: string
  stderr: string
  error: string | null
}

export type TaskStoreDocument = {
  version: number
  updatedAt: string
  tasks: CodexTask[]
}

export type TaskErrorCode =
  | "INVALID_TASK_ID"
  | "STORE_READ_ERROR"
  | "STORE_WRITE_ERROR"
  | "NOT_FOUND"
