import type { ProjectRepository } from "../../modules/project/application/project-repository"
import type { ProjectTaskPort } from "../../modules/task/application/project-task-port"
import type { WorkspaceRepository } from "../../modules/workspace/application/workspace-repository"

const EMPTY_CODEX_SETTINGS = {
  baseUrl: null,
  apiKey: null,
} as const

export function createProjectTaskPort(args: {
  projectRepository: Pick<ProjectRepository, "findById">
  workspaceRepository: Pick<WorkspaceRepository, "findById">
}): ProjectTaskPort {
  return {
    async getProjectForTask(projectId) {
      const project = await args.projectRepository.findById(projectId)
      if (!project) {
        return null
      }
      const workspace = project.workspaceId
        ? await args.workspaceRepository.findById(project.workspaceId)
        : null

      return {
        projectId: project.id,
        rootPath: project.rootPath,
        codex: workspace?.settings.codex ?? EMPTY_CODEX_SETTINGS,
      }
    },
  }
}
