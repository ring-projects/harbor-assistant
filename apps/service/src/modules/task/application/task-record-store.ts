import type { Task } from "../domain/task"
import type { TaskRuntimeConfig } from "./task-runtime-port"

export type CreateTaskRecordInput = {
  task: Task
  projectPath: string
  runtimeConfig: TaskRuntimeConfig
}

export interface TaskRecordStore {
  create(input: CreateTaskRecordInput): Promise<void>
}
