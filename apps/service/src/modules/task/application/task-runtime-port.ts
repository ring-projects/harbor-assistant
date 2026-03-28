import type { AgentInput } from "../../../lib/agents"

export type TaskRuntimeConfig = {
  executor: string
  model: string | null
  executionMode: string | null
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
  }): Promise<void>
}
