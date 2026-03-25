import { archiveTask } from "../domain/task"
import { createTaskError } from "../errors"
import type { TaskNotificationPublisher } from "./task-notification"
import { toTaskDetail, toTaskListItem, type TaskDetail } from "./task-read-models"
import type { TaskRepository } from "./task-repository"

export async function archiveTaskUseCase(
  repository: Pick<TaskRepository, "findById" | "save">,
  notificationPublisher: TaskNotificationPublisher,
  taskId: string,
): Promise<TaskDetail> {
  const current = await repository.findById(taskId)
  if (!current) {
    throw createTaskError().notFound()
  }

  const next = archiveTask(current)
  await repository.save(next)
  await notificationPublisher.publish({
    type: "task_upserted",
    projectId: next.projectId,
    task: toTaskListItem(next),
  })

  return toTaskDetail(next)
}
