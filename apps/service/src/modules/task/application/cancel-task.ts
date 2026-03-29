import { assertTaskCanCancel, isTerminalTaskStatus } from "../domain/task"
import { createTaskError } from "../errors"
import { toTaskDetail, type TaskDetail } from "./task-read-models"
import type { TaskRepository } from "./task-repository"
import type { TaskRuntimePort } from "./task-runtime-port"

const DEFAULT_CANCEL_REASON = "User requested stop"

export async function cancelTaskUseCase(args: {
  repository: Pick<TaskRepository, "findById">
  runtimePort: TaskRuntimePort
}, input: {
  taskId: string
  reason?: string | null
}): Promise<TaskDetail> {
  const taskId = input.taskId.trim()
  const reason = input.reason?.trim() || DEFAULT_CANCEL_REASON

  if (!taskId) {
    throw createTaskError().invalidInput("taskId is required")
  }

  const task = await args.repository.findById(taskId)
  if (!task) {
    throw createTaskError().notFound()
  }

  assertTaskCanCancel(task)

  if (isTerminalTaskStatus(task.status)) {
    return toTaskDetail(task)
  }

  try {
    await args.runtimePort.cancelTaskExecution({
      taskId: task.id,
      reason,
    })
  } catch (error) {
    throw createTaskError().cancelFailed(
      error instanceof Error ? error.message : "task runtime failed to cancel",
    )
  }

  const nextTask = await args.repository.findById(task.id)
  return toTaskDetail(nextTask ?? task)
}
