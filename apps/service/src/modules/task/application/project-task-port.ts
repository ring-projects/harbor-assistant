export type ProjectTaskContext = {
  projectId: string
  rootPath: string
}

export interface ProjectTaskPort {
  getProjectForTask(projectId: string): Promise<ProjectTaskContext | null>
}
