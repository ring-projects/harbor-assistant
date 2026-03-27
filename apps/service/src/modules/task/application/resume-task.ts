import { assertTaskCanResume } from "../domain/task"
import { createTaskError } from "../errors"
import type { ProjectTaskPort } from "./project-task-port"
import { toTaskDetail, type TaskDetail } from "./task-read-models"
import type { TaskRepository } from "./task-repository"
import type { TaskRuntimePort } from "./task-runtime-port"

export async function resumeTaskUseCase(args: {
  projectTaskPort: ProjectTaskPort
  repository: Pick<TaskRepository, "findById">
  runtimePort: TaskRuntimePort
}, input: {
  taskId: string
  prompt: string
}): Promise<TaskDetail> {
  const taskId = input.taskId.trim()
  const prompt = input.prompt.trim()

  if (!taskId) {
    throw createTaskError().invalidInput("taskId is required")
  }

  if (!prompt) {
    throw createTaskError().invalidInput("prompt is required")
  }

  const task = await args.repository.findById(taskId)
  if (!task) {
    throw createTaskError().notFound()
  }

  assertTaskCanResume(task)

  const project = await args.projectTaskPort.getProjectForTask(task.projectId)
  if (!project) {
    throw createTaskError().projectNotFound()
  }

  try {
    await args.runtimePort.resumeTaskExecution({
      taskId: task.id,
      projectId: task.projectId,
      projectPath: project.rootPath,
      prompt,
    })
  } catch (error) {
    throw createTaskError().resumeFailed(
      error instanceof Error ? error.message : "task runtime failed to resume",
    )
  }

  const nextTask = await args.repository.findById(task.id)
  return toTaskDetail(nextTask ?? task)
}
