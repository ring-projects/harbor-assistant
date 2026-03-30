import type { ProjectRepository } from "../../modules/project/application/project-repository"
import type { ProjectTaskPort } from "../../modules/task/application/project-task-port"

export function createProjectTaskPort(args: {
  projectRepository: Pick<ProjectRepository, "findById">
}): ProjectTaskPort {
  return {
    async getProjectForTask(projectId) {
      const project = await args.projectRepository.findById(projectId)
      if (!project) {
        return null
      }

      return {
        projectId: project.id,
        rootPath: project.rootPath,
      }
    },
  }
}
