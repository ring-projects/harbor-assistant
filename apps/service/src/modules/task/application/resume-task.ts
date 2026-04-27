import type { AgentInputItem } from "../../../lib/agents"
import { normalizeNullableTaskEffort } from "../domain/task-effort"
import { assertTaskCanResume } from "../domain/task"
import { resolveAgentInput } from "../domain/task-input"
import { createTaskError } from "../errors"
import type { ProjectTaskPort } from "./project-task-port"
import { toTaskDetail, type TaskDetail } from "./task-read-models"
import type { TaskRepository } from "./task-repository"
import type { TaskRuntimePort } from "./task-runtime-port"
import { validateTaskRuntimeConfig } from "./validate-task-effort"

function normalizeNullableString(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function requireProjectRootPath(rootPath: string | null) {
  if (!rootPath) {
    throw createTaskError().invalidInput("project root path is not available")
  }

  return rootPath
}

export async function resumeTaskUseCase(
  args: {
    projectTaskPort: ProjectTaskPort
    repository: Pick<TaskRepository, "findById">
    runtimePort: TaskRuntimePort
  },
  input: {
    taskId: string
    prompt?: string | null
    items?: AgentInputItem[] | null
    model?: string | null
    effort?: string | null
  },
): Promise<TaskDetail> {
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
  const projectRootPath = requireProjectRootPath(project.rootPath)

  const requestedEffort = normalizeNullableTaskEffort(input.effort)
  if (input.effort !== undefined && input.effort !== null && !requestedEffort) {
    throw createTaskError().invalidEffort(`invalid effort "${input.effort}"`)
  }

  const hasModelOverride = Object.prototype.hasOwnProperty.call(input, "model")
  const hasEffortOverride = Object.prototype.hasOwnProperty.call(
    input,
    "effort",
  )

  const runtimeConfig = {
    ...(await validateTaskRuntimeConfig({
      executor: task.executor ?? "",
      model:
        hasModelOverride && input.model !== undefined
          ? normalizeNullableString(input.model)
          : task.model,
      effort:
        hasEffortOverride && input.effort !== undefined
          ? requestedEffort
          : task.effort,
    })),
    executionMode: task.executionMode,
  }

  try {
    await args.runtimePort.resumeTaskExecution({
      taskId: task.id,
      projectId: task.projectId,
      projectPath: projectRootPath,
      projectCodex: project.codex,
      input: agentInput,
      runtimeConfig,
    })
  } catch (error) {
    throw createTaskError().resumeFailed(
      error instanceof Error ? error.message : "task runtime failed to resume",
    )
  }

  const nextTask = await args.repository.findById(task.id)
  return toTaskDetail(nextTask ?? task)
}
