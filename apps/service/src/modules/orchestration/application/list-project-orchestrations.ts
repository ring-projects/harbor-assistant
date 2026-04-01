import type { TaskRepository } from "../../task/application/task-repository"
import type { ProjectRepository } from "../../project/application/project-repository"
import { createProjectError } from "../../project/errors"
import type { OrchestrationRepository } from "./orchestration-repository"
import { buildOrchestrationListItem } from "./shared"

export async function listProjectOrchestrationsUseCase(
  args: {
    repository: Pick<OrchestrationRepository, "listByProject">
    projectRepository: Pick<ProjectRepository, "findById">
    taskRepository: Pick<TaskRepository, "listByProject">
  },
  projectId: string,
) {
  const normalizedProjectId = projectId.trim()
  if (!normalizedProjectId) {
    throw createProjectError().invalidInput("projectId is required")
  }

  const project = await args.projectRepository.findById(normalizedProjectId)
  if (!project) {
    throw createProjectError().notFound()
  }

  const [orchestrations, tasks] = await Promise.all([
    args.repository.listByProject(normalizedProjectId),
    args.taskRepository.listByProject({
      projectId: normalizedProjectId,
      includeArchived: true,
    }),
  ])

  const tasksByOrchestration = new Map<string, typeof tasks>()
  for (const task of tasks) {
    const items = tasksByOrchestration.get(task.orchestrationId) ?? []
    items.push(task)
    tasksByOrchestration.set(task.orchestrationId, items)
  }

  return orchestrations.map((orchestration) =>
    buildOrchestrationListItem(
      orchestration,
      tasksByOrchestration.get(orchestration.id) ?? [],
    ),
  )
}
