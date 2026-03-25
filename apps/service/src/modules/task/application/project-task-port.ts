export type ProjectTaskContext = {
  projectId: string
  rootPath: string
  settings: {
    defaultExecutor: string | null
    defaultModel: string | null
    defaultExecutionMode: string | null
  }
}

export interface ProjectTaskPort {
  getProjectForTask(projectId: string): Promise<ProjectTaskContext | null>
}
