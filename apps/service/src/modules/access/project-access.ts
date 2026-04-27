import type { OrchestrationRepository } from "../orchestration/application/orchestration-repository"
import type { ProjectRepository } from "../project/application/project-repository"
import type { Project } from "../project/domain/project"
import type { ProjectTaskPort } from "../task/application/project-task-port"
import type { TaskRecordStore } from "../task/application/task-record-store"
import type { TaskRepository } from "../task/application/task-repository"
import { canUserAccessWorkspace, type WorkspaceRepository } from "../workspace"

async function canAccessProject(
  project: Project | null,
  workspaceRepository: WorkspaceRepository,
  userId: string,
): Promise<boolean> {
  if (!project) {
    return false
  }

  if (project.workspaceId) {
    const workspace = await workspaceRepository.findById(project.workspaceId)
    if (!workspace) {
      return false
    }

    return canUserAccessWorkspace(workspace, userId)
  }

  return project.ownerUserId === null || project.ownerUserId === userId
}

async function findAccessibleProject(args: {
  projectRepository: Pick<ProjectRepository, "findById">
  workspaceRepository: WorkspaceRepository
  projectId: string
  userId: string
}): Promise<Project | null> {
  const project = await args.projectRepository.findById(args.projectId)
  return (await canAccessProject(
    project,
    args.workspaceRepository,
    args.userId,
  ))
    ? project
    : null
}

export function createAccessibleProjectRepository(
  projectRepository: ProjectRepository,
  workspaceRepository: WorkspaceRepository,
  userId: string,
): ProjectRepository {
  return {
    async findById(projectId) {
      return findAccessibleProject({
        projectRepository,
        workspaceRepository,
        projectId,
        userId,
      })
    },
    async findByIdAndOwnerUserId(projectId, requestedOwnerUserId) {
      return findAccessibleProject({
        projectRepository,
        workspaceRepository,
        projectId,
        userId: requestedOwnerUserId,
      })
    },
    findByNormalizedPath(normalizedPath) {
      return projectRepository.findByNormalizedPath(normalizedPath)
    },
    findBySlug(slug) {
      return projectRepository.findBySlug(slug)
    },
    async list() {
      const projects = await projectRepository.list()
      const allowed: Project[] = []

      for (const project of projects) {
        if (await canAccessProject(project, workspaceRepository, userId)) {
          allowed.push(project)
        }
      }

      return allowed
    },
    async listByOwnerUserId(requestedOwnerUserId) {
      const projects = await projectRepository.list()
      const allowed: Project[] = []

      for (const project of projects) {
        if (
          await canAccessProject(
            project,
            workspaceRepository,
            requestedOwnerUserId,
          )
        ) {
          allowed.push(project)
        }
      }

      return allowed
    },
    save(project) {
      return projectRepository.save(project)
    },
    delete(projectId) {
      return projectRepository.delete(projectId)
    },
  }
}

export function createAccessibleProjectTaskPort(args: {
  projectRepository: Pick<ProjectRepository, "findById">
  workspaceRepository: WorkspaceRepository
  projectTaskPort: ProjectTaskPort
  userId: string
}): ProjectTaskPort {
  return {
    async getProjectForTask(projectId) {
      const project = await findAccessibleProject({
        projectRepository: args.projectRepository,
        workspaceRepository: args.workspaceRepository,
        projectId,
        userId: args.userId,
      })

      if (!project) {
        return null
      }

      return args.projectTaskPort.getProjectForTask(projectId)
    },
  }
}

export function createAccessibleTaskRepository(args: {
  repository: TaskRepository & Partial<TaskRecordStore>
  projectRepository: Pick<ProjectRepository, "findById">
  workspaceRepository: WorkspaceRepository
  userId: string
}): TaskRepository & Partial<TaskRecordStore> {
  return {
    async findById(taskId) {
      const task = await args.repository.findById(taskId)
      if (!task) {
        return null
      }

      const project = await findAccessibleProject({
        projectRepository: args.projectRepository,
        workspaceRepository: args.workspaceRepository,
        projectId: task.projectId,
        userId: args.userId,
      })

      return project ? task : null
    },
    async listByProject(input) {
      const project = await findAccessibleProject({
        projectRepository: args.projectRepository,
        workspaceRepository: args.workspaceRepository,
        projectId: input.projectId,
        userId: args.userId,
      })

      if (!project) {
        return []
      }

      return args.repository.listByProject(input)
    },
    async listByOrchestration(input) {
      const tasks = await args.repository.listByOrchestration(input)
      const allowed = []

      for (const task of tasks) {
        const project = await findAccessibleProject({
          projectRepository: args.projectRepository,
          workspaceRepository: args.workspaceRepository,
          projectId: task.projectId,
          userId: args.userId,
        })
        if (project) {
          allowed.push(task)
        }
      }

      return allowed
    },
    save(task) {
      return args.repository.save(task)
    },
    delete(taskId) {
      return args.repository.delete(taskId)
    },
    create(input) {
      if (!args.repository.create) {
        throw new Error("Task record store does not support create.")
      }

      return args.repository.create(input)
    },
  }
}

export function createAccessibleOrchestrationRepository(args: {
  repository: OrchestrationRepository
  projectRepository: Pick<ProjectRepository, "findById">
  workspaceRepository: WorkspaceRepository
  userId: string
}): OrchestrationRepository {
  return {
    async findById(orchestrationId) {
      const orchestration = await args.repository.findById(orchestrationId)
      if (!orchestration) {
        return null
      }

      const project = await findAccessibleProject({
        projectRepository: args.projectRepository,
        workspaceRepository: args.workspaceRepository,
        projectId: orchestration.projectId,
        userId: args.userId,
      })

      return project ? orchestration : null
    },
    async listByProject(input) {
      const project = await findAccessibleProject({
        projectRepository: args.projectRepository,
        workspaceRepository: args.workspaceRepository,
        projectId: input.projectId,
        userId: args.userId,
      })

      if (!project) {
        return []
      }

      return args.repository.listByProject(input)
    },
    save(orchestration) {
      return args.repository.save(orchestration)
    },
    async findScheduleByOrchestrationId(orchestrationId) {
      const orchestration = await this.findById(orchestrationId)
      if (!orchestration) {
        return null
      }

      return args.repository.findScheduleByOrchestrationId(orchestrationId)
    },
    saveSchedule(schedule) {
      return args.repository.saveSchedule(schedule)
    },
    listDueSchedules(input) {
      return args.repository.listDueSchedules(input)
    },
  }
}
