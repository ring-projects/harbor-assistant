import type { TaskRuntimeConfig } from "../../task/application/task-runtime-port"
import type { Task } from "../../task/domain/task"
import type { Orchestration } from "../domain/orchestration"

export type CreateBootstrapRecordInput = {
  orchestration: Orchestration
  task: Task
  projectPath: string
  runtimeConfig: TaskRuntimeConfig
}

export interface OrchestrationBootstrapStore {
  create(input: CreateBootstrapRecordInput): Promise<void>
}
