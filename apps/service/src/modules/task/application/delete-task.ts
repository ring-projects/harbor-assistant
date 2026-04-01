import { assertTaskCanDelete } from "../domain/task"
import { createTaskError } from "../errors"
import type { TaskNotificationPublisher } from "./task-notification"
import type { DeleteTaskResult } from "./task-read-models"
import type { TaskRepository } from "./task-repository"

export async function deleteTaskUseCase(
  repository: Pick<TaskRepository, "findById" | "delete">,
  notificationPublisher: TaskNotificationPublisher,
  taskId: string,
): Promise<DeleteTaskResult> {
  const current = await repository.findById(taskId)
  if (!current) {
    throw createTaskError().notFound()
  }

  assertTaskCanDelete(current)

  await repository.delete(current.id)
  await notificationPublisher.publish({
    type: "task_deleted",
    projectId: current.projectId,
    taskId: current.id,
  })

  return {
    taskId: current.id,
    projectId: current.projectId,
    orchestrationId: current.orchestrationId,
  }
}
