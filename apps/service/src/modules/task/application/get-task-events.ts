import { createTaskError } from "../errors"
import { isTerminalTaskStatus } from "../domain/task"
import type { TaskEventProjection } from "./task-event-projection"
import type { TaskRepository } from "./task-repository"
import { toTaskDetail, type TaskDetail, type TaskEventStream } from "./task-read-models"

export async function getTaskEventsUseCase(
  repository: Pick<TaskRepository, "findById">,
  projection: TaskEventProjection,
  input: {
    taskId: string
    afterSequence?: number
    limit?: number
  },
): Promise<{
  task: TaskDetail
  events: TaskEventStream
  isTerminal: boolean
}> {
  const task = await repository.findById(input.taskId)
  if (!task) {
    throw createTaskError().notFound()
  }

  const events = await projection.getTaskEvents(input)
  return {
    task: toTaskDetail(task),
    events,
    isTerminal: isTerminalTaskStatus(task.status),
  }
}
