import type { ProjectGitInteractionLifecycle } from "../../modules/interaction/application/ports"
import { requireProjectWorkspace } from "../../modules/project/domain/project"
import { getProjectUseCase } from "../../modules/project/application/get-project"
import type { ProjectRepository } from "../../modules/project/application/project-repository"
import { toProjectAppError } from "../../modules/project/project-app-error"
import type { GitPathWatcher } from "../../modules/git/application/git-path-watcher"

export function createProjectGitInteractionLifecycle(args: {
  projectRepository: Pick<ProjectRepository, "findById">
  gitPathWatcher: GitPathWatcher
}): ProjectGitInteractionLifecycle {
  return {
    async subscribe(projectId, listener) {
      try {
        const project = await getProjectUseCase(args.projectRepository, projectId)
        const workspace = requireProjectWorkspace(project)
        return await args.gitPathWatcher.subscribe(workspace.rootPath, (event) => {
          listener({
            projectId: project.id,
            changedAt: event.changedAt,
          })
        })
      } catch (error) {
        throw toProjectAppError(error)
      }
    },
    async close() {
      await args.gitPathWatcher.close?.()
    },
  }
}
