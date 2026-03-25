import type { TaskRepository } from "./task-repository"
import { toTaskListItem, type TaskListItem } from "./task-read-models"

export async function listProjectTasksUseCase(
  repository: Pick<TaskRepository, "listByProject">,
  input: {
    projectId: string
    includeArchived?: boolean
    limit?: number
  },
): Promise<TaskListItem[]> {
  const tasks = await repository.listByProject(input)
  return tasks.map(toTaskListItem)
}
