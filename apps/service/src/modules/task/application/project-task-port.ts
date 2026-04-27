import type { WorkspaceCodexSettings } from "../../workspace/domain/workspace"

export type ProjectTaskContext = {
  projectId: string
  rootPath: string | null
  codex: WorkspaceCodexSettings
}

export interface ProjectTaskPort {
  getProjectForTask(projectId: string): Promise<ProjectTaskContext | null>
}
