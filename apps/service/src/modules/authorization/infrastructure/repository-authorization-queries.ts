import type {
  AuthorizationOrchestrationQuery,
  AuthorizationProjectQuery,
  AuthorizationTaskQuery,
  AuthorizationWorkspaceQuery,
} from "../application/authorization-queries"
import type { OrchestrationRepository } from "../../orchestration/application/orchestration-repository"
import type { ProjectRepository } from "../../project/application/project-repository"
import type { TaskRepository } from "../../task/application/task-repository"
import type { WorkspaceRepository } from "../../workspace/application/workspace-repository"

export function createRepositoryAuthorizationWorkspaceQuery(
  repository: Pick<WorkspaceRepository, "findById">,
): AuthorizationWorkspaceQuery {
  return {
    async getWorkspaceAccessContext(workspaceId, actorUserId) {
      const workspace = await repository.findById(workspaceId)
      if (!workspace) {
        return {
          workspaceId,
          exists: false,
          membership: null,
        }
      }

      const membership =
        workspace.memberships.find(
          (candidate) => candidate.userId === actorUserId,
        ) ?? null

      return {
        workspaceId: workspace.id,
        exists: true,
        membership: membership
          ? {
              role: membership.role,
              status: membership.status,
            }
          : null,
      }
    },
  }
}

export function createRepositoryAuthorizationProjectQuery(
  repository: Pick<ProjectRepository, "findById">,
): AuthorizationProjectQuery {
  return {
    async getProjectAuthorizationContext(projectId) {
      const project = await repository.findById(projectId)
      if (!project) {
        return null
      }

      return {
        projectId: project.id,
        ownerUserId: project.ownerUserId,
        workspaceId: project.workspaceId ?? null,
        status: project.status,
        sourceType: project.source.type,
        hasWorkspaceRoot: Boolean(project.rootPath && project.normalizedPath),
      }
    },
  }
}

export function createRepositoryAuthorizationTaskQuery(
  repository: Pick<TaskRepository, "findById">,
): AuthorizationTaskQuery {
  return {
    async getTaskAuthorizationContext(taskId) {
      const task = await repository.findById(taskId)
      if (!task) {
        return null
      }

      return {
        taskId: task.id,
        projectId: task.projectId,
        orchestrationId: task.orchestrationId,
      }
    },
  }
}

export function createRepositoryAuthorizationOrchestrationQuery(
  repository: Pick<OrchestrationRepository, "findById">,
): AuthorizationOrchestrationQuery {
  return {
    async getOrchestrationAuthorizationContext(orchestrationId) {
      const orchestration = await repository.findById(orchestrationId)
      if (!orchestration) {
        return null
      }

      return {
        orchestrationId: orchestration.id,
        projectId: orchestration.projectId,
      }
    },
  }
}
