import { createTaskError } from "../errors"
import type { TaskAgentGateway } from "../gateways"
import type { TaskRepository } from "../repositories"
import type { CodexTask } from "../types"
import type { TaskEventBus } from "./task-event-bus"

type RunningCodexTask = {
  controller: AbortController
  cancellationRequested: boolean
  cancellationReason: string | null
}

function nowIsoString() {
  return new Date().toISOString()
}

function isTerminalStatus(status: CodexTask["status"]) {
  return status === "completed" || status === "failed" || status === "cancelled"
}

export function createTaskRunnerService(args: {
  taskRepository: Pick<
    TaskRepository,
    | "getTaskById"
    | "updateTaskState"
    | "createTask"
  >
  taskAgentGateway: TaskAgentGateway
  taskEventBus: Pick<TaskEventBus, "publish">
}) {
  const { taskRepository, taskAgentGateway, taskEventBus } = args
  const runningCodexTasks = new Map<string, RunningCodexTask>()

  function getRunningTask(taskId: string) {
    return runningCodexTasks.get(taskId) ?? null
  }

  function clearRunningTask(taskId: string) {
    runningCodexTasks.delete(taskId)
  }

  async function finalizeTask(args: {
    taskId: string
    status: "completed" | "failed" | "cancelled"
    stdout?: string
    stderr?: string
    exitCode?: number | null
    error?: string | null
    failureCode?: string | null
  }) {
    clearRunningTask(args.taskId)

    const task = await taskRepository.updateTaskState({
      taskId: args.taskId,
      status: args.status,
      finishedAt: nowIsoString(),
      exitCode: args.exitCode ?? null,
      stdout: args.stdout,
      stderr: args.stderr,
      error: args.error ?? null,
    })

    taskEventBus.publish({
      type: "task_upsert",
      projectId: task.projectId,
      task,
    })

    taskEventBus.publish({
      type: "task_status",
      taskId: args.taskId,
      status: args.status,
    })

    taskEventBus.publish({
      type: "task_end",
      taskId: args.taskId,
      status: args.status,
      cursor: 0,
    })

    return task
  }

  async function loadTaskOrThrow(taskId: string) {
    const task = await taskRepository.getTaskById(taskId)
    if (!task) {
      throw createTaskError.taskNotFound(taskId)
    }

    return task
  }

  async function executeNewThreadTask(args: {
    taskId: string
    projectId: string
    projectPath: string
    prompt: string
    model: string | null
  }) {
    const runningTask = getRunningTask(args.taskId)

    try {
      const result = await taskAgentGateway.startSessionAndRun({
        taskId: args.taskId,
        projectId: args.projectId,
        projectPath: args.projectPath,
        prompt: args.prompt,
        model: args.model,
        signal: runningTask?.controller.signal,
      })

      await finalizeTask({
        taskId: args.taskId,
        status: "completed",
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: 0,
      })
    } catch (error) {
      const current = getRunningTask(args.taskId)
      if (current?.cancellationRequested) {
        await finalizeTask({
          taskId: args.taskId,
          status: "cancelled",
          stdout: "",
          stderr: "",
          error: current.cancellationReason ?? "Task cancelled by user request.",
          failureCode: "TASK_CANCELLED",
        })
        return
      }

      await finalizeTask({
        taskId: args.taskId,
        status: "failed",
        stdout: "",
        stderr: "",
        error: String(error),
        failureCode: "AGENT_RUN_FAILED",
      })
    }
  }

  async function executeResumedThreadTask(args: {
    taskId: string
    threadId: string
    projectId: string
    projectPath: string
    prompt: string
    model: string | null
  }) {
    const runningTask = getRunningTask(args.taskId)
    const existingTask = await loadTaskOrThrow(args.taskId)

    try {
      const result = await taskAgentGateway.resumeSessionAndRun({
        taskId: args.taskId,
        sessionId: args.threadId,
        projectId: args.projectId,
        projectPath: args.projectPath,
        prompt: args.prompt,
        model: args.model,
        signal: runningTask?.controller.signal,
      })

      await finalizeTask({
        taskId: args.taskId,
        status: "completed",
        stdout: `${existingTask.stdout}${result.stdout}`,
        stderr: `${existingTask.stderr}${result.stderr}`,
        exitCode: 0,
      })
    } catch (error) {
      const current = getRunningTask(args.taskId)
      if (current?.cancellationRequested) {
        await finalizeTask({
          taskId: args.taskId,
          status: "cancelled",
          stdout: "",
          stderr: "",
          error: current.cancellationReason ?? "Task cancelled by user request.",
          failureCode: "TASK_CANCELLED",
        })
        return
      }

      await finalizeTask({
        taskId: args.taskId,
        status: "failed",
        stdout: "",
        stderr: "",
        error: String(error),
        failureCode: "AGENT_RUN_FAILED",
      })
    }
  }

  async function createAndRunTask(input: {
    projectId: string
    projectPath: string
    prompt: string
    model: string | null
    parentTaskId?: string | null
  }): Promise<CodexTask> {
    const createdTask = await taskRepository.createTask({
      projectId: input.projectId,
      projectPath: input.projectPath,
      prompt: input.prompt,
      model: input.model,
      parentTaskId: input.parentTaskId ?? null,
    })

    const controller = new AbortController()
    runningCodexTasks.set(createdTask.id, {
      controller,
      cancellationRequested: false,
      cancellationReason: null,
    })

    const runningTask = await taskRepository.updateTaskState({
      taskId: createdTask.id,
      status: "running",
      startedAt: nowIsoString(),
      command: ["agent", "startSession"],
      error: null,
    })

    taskEventBus.publish({
      type: "task_upsert",
      projectId: runningTask.projectId,
      task: runningTask,
    })

    taskEventBus.publish({
      type: "task_status",
      taskId: createdTask.id,
      status: "running",
    })

    void executeNewThreadTask({
      taskId: createdTask.id,
      projectId: input.projectId,
      projectPath: input.projectPath,
      prompt: input.prompt,
      model: input.model,
    })

    return runningTask
  }

  async function followupTask(input: {
    taskId: string
    threadId: string
    projectId: string
    projectPath: string
    prompt: string
    model: string | null
  }): Promise<CodexTask> {
    const controller = new AbortController()
    runningCodexTasks.set(input.taskId, {
      controller,
      cancellationRequested: false,
      cancellationReason: null,
    })

    const runningTask = await taskRepository.updateTaskState({
      taskId: input.taskId,
      status: "running",
      startedAt: nowIsoString(),
      finishedAt: null,
      exitCode: null,
      command: ["agent", "resumeSession", input.threadId],
      error: null,
    })

    taskEventBus.publish({
      type: "task_upsert",
      projectId: runningTask.projectId,
      task: runningTask,
    })

    taskEventBus.publish({
      type: "task_status",
      taskId: input.taskId,
      status: "running",
    })

    void executeResumedThreadTask({
      taskId: input.taskId,
      threadId: input.threadId,
      projectId: input.projectId,
      projectPath: input.projectPath,
      prompt: input.prompt,
      model: input.model,
    })

    return runningTask
  }

  async function cancelTask(input: {
    taskId: string
    reason?: string
  }): Promise<CodexTask> {
    const taskId = input.taskId.trim()
    if (!taskId) {
      throw createTaskError.invalidTaskId("Task id cannot be empty.")
    }

    const existing = await taskRepository.getTaskById(taskId)
    if (!existing) {
      throw createTaskError.taskNotFound(taskId)
    }

    if (isTerminalStatus(existing.status)) {
      return existing
    }

    const reason = input.reason?.trim() || "Task cancelled by user request."
    const runningTask = getRunningTask(taskId)
    if (runningTask) {
      runningTask.cancellationRequested = true
      runningTask.cancellationReason = reason
      runningTask.controller.abort(reason)
    }

    return taskRepository.updateTaskState({
      taskId,
      status: "cancelled",
      finishedAt: nowIsoString(),
      error: reason,
    })
  }

  return {
    createAndRunTask,
    followupTask,
    cancelTask,
  }
}

export type TaskRunnerService = ReturnType<typeof createTaskRunnerService>
