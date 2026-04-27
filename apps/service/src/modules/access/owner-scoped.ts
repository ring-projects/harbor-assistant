import type { ProjectRepository } from "../project/application/project-repository"
import type { Project } from "../project/domain/project"
import type { OrchestrationRepository } from "../orchestration/application/orchestration-repository"
import type { ProjectTaskPort } from "../task/application/project-task-port"
import type { TaskRepository } from "../task/application/task-repository"
import type { TaskRecordStore } from "../task/application/task-record-store"

async function findOwnedProject(
  repository: Pick<ProjectRepository, "findById"> & {
    findByIdAndOwnerUserId?: ProjectRepository["findByIdAndOwnerUserId"]
  },
  projectId: string,
  ownerUserId: string,
): Promise<Project | null> {
  const project = repository.findByIdAndOwnerUserId
    ? await repository.findByIdAndOwnerUserId(projectId, ownerUserId)
    : await repository.findById(projectId)

  if (!project) {
    return null
  }

  if (project.ownerUserId !== null && project.ownerUserId !== ownerUserId) {
    return null
  }

  return project
}

export function createOwnerScopedProjectRepository(
  repository: ProjectRepository,
  ownerUserId: string,
): ProjectRepository {
  return {
    async findById(projectId) {
      return findOwnedProject(repository, projectId, ownerUserId)
    },
    async findByIdAndOwnerUserId(projectId, requestedOwnerUserId) {
      return findOwnedProject(repository, projectId, requestedOwnerUserId)
    },
    findByNormalizedPath(normalizedPath) {
      return repository.findByNormalizedPath(normalizedPath)
    },
    findBySlug(slug) {
      return repository.findBySlug(slug)
    },
    async list() {
      if (repository.listByOwnerUserId) {
        return repository.listByOwnerUserId(ownerUserId)
      }

      const projects = await repository.list()
      return projects.filter(
        (project) =>
          project.ownerUserId === null || project.ownerUserId === ownerUserId,
      )
    },
    async listByOwnerUserId(requestedOwnerUserId) {
      if (repository.listByOwnerUserId) {
        return repository.listByOwnerUserId(requestedOwnerUserId)
      }

      const projects = await repository.list()
      return projects.filter(
        (project) =>
          project.ownerUserId === null ||
          project.ownerUserId === requestedOwnerUserId,
      )
    },
    save(project) {
      return repository.save(project)
    },
    delete(projectId) {
      return repository.delete(projectId)
    },
  }
}

export function createOwnerScopedProjectTaskPort(args: {
  projectRepository: Pick<ProjectRepository, "findById"> & {
    findByIdAndOwnerUserId?: ProjectRepository["findByIdAndOwnerUserId"]
  }
  projectTaskPort: ProjectTaskPort
  ownerUserId: string
}): ProjectTaskPort {
  return {
    async getProjectForTask(projectId) {
      const project = await findOwnedProject(
        args.projectRepository,
        projectId,
        args.ownerUserId,
      )

      if (!project) {
        return null
      }

      return args.projectTaskPort.getProjectForTask(projectId)
    },
  }
}

export function createOwnerScopedTaskRepository(args: {
  repository: TaskRepository & Partial<TaskRecordStore>
  projectRepository: Pick<ProjectRepository, "findById"> & {
    findByIdAndOwnerUserId?: ProjectRepository["findByIdAndOwnerUserId"]
  }
  ownerUserId: string
}): TaskRepository & Partial<TaskRecordStore> {
  return {
    async findById(taskId) {
      const task = await args.repository.findById(taskId)
      if (!task) {
        return null
      }

      const project = await findOwnedProject(
        args.projectRepository,
        task.projectId,
        args.ownerUserId,
      )

      return project ? task : null
    },
    async listByProject(input) {
      const project = await findOwnedProject(
        args.projectRepository,
        input.projectId,
        args.ownerUserId,
      )

      if (!project) {
        return []
      }

      return args.repository.listByProject(input)
    },
    async listByOrchestration(input) {
      const tasks = await args.repository.listByOrchestration(input)
      const filtered: Awaited<
        ReturnType<TaskRepository["listByOrchestration"]>
      > = []

      for (const task of tasks) {
        const project = await findOwnedProject(
          args.projectRepository,
          task.projectId,
          args.ownerUserId,
        )
        if (project) {
          filtered.push(task)
        }
      }

      return filtered
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

export function createOwnerScopedOrchestrationRepository(args: {
  repository: OrchestrationRepository
  projectRepository: Pick<ProjectRepository, "findById"> & {
    findByIdAndOwnerUserId?: ProjectRepository["findByIdAndOwnerUserId"]
  }
  ownerUserId: string
}): OrchestrationRepository {
  return {
    async findById(orchestrationId) {
      const orchestration = await args.repository.findById(orchestrationId)
      if (!orchestration) {
        return null
      }

      const project = await findOwnedProject(
        args.projectRepository,
        orchestration.projectId,
        args.ownerUserId,
      )

      return project ? orchestration : null
    },
    async listByProject(input) {
      const project = await findOwnedProject(
        args.projectRepository,
        input.projectId,
        args.ownerUserId,
      )

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
