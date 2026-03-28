import { createTaskError } from "../errors"
import { updateTaskTitle } from "../domain/task"
import type { TaskNotificationPublisher } from "./task-notification"
import {
  attachTaskRuntime,
  toTaskDetail,
  toTaskListItem,
  type TaskDetail,
} from "./task-read-models"
import type { TaskRepository } from "./task-repository"

export async function updateTaskTitleUseCase(
  repository: Pick<TaskRepository, "findById" | "save">,
  notificationPublisher: TaskNotificationPublisher,
  input: {
    taskId: string
    title: string
  },
): Promise<TaskDetail> {
  const current = await repository.findById(input.taskId)
  if (!current) {
    throw createTaskError().notFound()
  }

  const next = updateTaskTitle(current, input.title)
  const nextRecord = attachTaskRuntime(next, current)
  await repository.save(next)
  await notificationPublisher.publish({
    type: "task_upserted",
    projectId: next.projectId,
    task: toTaskListItem(nextRecord),
  })

  return toTaskDetail(nextRecord)
}
