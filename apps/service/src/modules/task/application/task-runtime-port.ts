import type { AgentInput } from "../../../lib/agents"
import type { TaskEffort } from "../domain/task-effort"

export type TaskRuntimeConfig = {
  executor: string
  model: string | null
  executionMode: string | null
  effort: TaskEffort | null
}

export interface TaskRuntimePort {
  startTaskExecution(input: {
    taskId: string
    projectId: string
    projectPath: string
    input: AgentInput
    runtimeConfig: TaskRuntimeConfig
  }): Promise<void>
  resumeTaskExecution(input: {
    taskId: string
    projectId: string
    projectPath: string
    input: AgentInput
    runtimeConfig: TaskRuntimeConfig
  }): Promise<void>
  cancelTaskExecution(input: {
    taskId: string
    reason?: string | null
  }): Promise<void>
}
