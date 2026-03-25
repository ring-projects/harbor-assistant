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
    prompt: string
    runtimeConfig: TaskRuntimeConfig
  }): Promise<void>
}
