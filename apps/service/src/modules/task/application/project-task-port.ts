export type ProjectTaskContext = {
  projectId: string
  rootPath: string | null
}

export interface ProjectTaskPort {
  getProjectForTask(projectId: string): Promise<ProjectTaskContext | null>
}
