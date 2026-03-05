import type { CodexTask, TaskEvent } from "@/services/tasks/types"

export type TaskApiError = {
  code: string
  message: string
}

export type TaskApiResult = {
  ok: boolean
  task?: CodexTask
  tasks?: CodexTask[]
  events?: TaskEvent[]
  error?: TaskApiError
}
