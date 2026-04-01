import type { TaskRepository } from "./task-repository"
import { toTaskListItem, type TaskListItem } from "./task-read-models"

export async function listOrchestrationTasksUseCase(
  repository: Pick<TaskRepository, "listByOrchestration">,
  input: {
    orchestrationId: string
    includeArchived?: boolean
    limit?: number
  },
): Promise<TaskListItem[]> {
  const tasks = await repository.listByOrchestration(input)
  return tasks.map(toTaskListItem)
}
