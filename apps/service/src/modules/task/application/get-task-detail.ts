import { createTaskError } from "../errors"
import type { TaskRepository } from "./task-repository"
import { toTaskDetail, type TaskDetail } from "./task-read-models"

export async function getTaskDetailUseCase(
  repository: Pick<TaskRepository, "findById">,
  taskId: string,
): Promise<TaskDetail> {
  const task = await repository.findById(taskId)
  if (!task) {
    throw createTaskError().notFound()
  }

  return toTaskDetail(task)
}
