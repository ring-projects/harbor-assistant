import type { AgentInputItem } from "../../../lib/agents"
import { assertTaskCanResume } from "../domain/task"
import { resolveAgentInput } from "../domain/task-input"
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
  prompt?: string | null
  items?: AgentInputItem[] | null
}): Promise<TaskDetail> {
  const taskId = input.taskId.trim()
  const agentInput = resolveAgentInput(input)

  if (!taskId) {
    throw createTaskError().invalidInput("taskId is required")
  }

  if (!agentInput) {
    throw createTaskError().invalidInput("task input is required")
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
      input: agentInput,
    })
  } catch (error) {
    throw createTaskError().resumeFailed(
      error instanceof Error ? error.message : "task runtime failed to resume",
    )
  }

  const nextTask = await args.repository.findById(task.id)
  return toTaskDetail(nextTask ?? task)
}
