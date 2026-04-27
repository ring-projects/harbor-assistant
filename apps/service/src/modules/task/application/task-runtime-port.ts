import type { AgentInput } from "../../../lib/agents"
import type { TaskEffort } from "../domain/task-effort"
import type { WorkspaceCodexSettings } from "../../workspace/domain/workspace"

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
    projectCodex?: WorkspaceCodexSettings
    input: AgentInput
    runtimeConfig: TaskRuntimeConfig
  }): Promise<void>
  resumeTaskExecution(input: {
    taskId: string
    projectId: string
    projectPath: string
    projectCodex?: WorkspaceCodexSettings
    input: AgentInput
    runtimeConfig: TaskRuntimeConfig
  }): Promise<void>
  cancelTaskExecution(input: {
    taskId: string
    reason?: string | null
  }): Promise<void>
}
