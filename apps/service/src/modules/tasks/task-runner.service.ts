import {
  createTask,
  getTaskById,
  updateTaskRunState,
} from "./task.repository"
import { codexSdkGateway } from "./codex-sdk.gateway"
import type { CodexTask } from "./types"

type RunningCodexTask = {
  controller: AbortController
  cancellationRequested: boolean
  cancellationReason: string | null
}

const runningCodexTasks = new Map<string, RunningCodexTask>()

function nowIsoString() {
  return new Date().toISOString()
}

function isTerminalStatus(status: CodexTask["status"]) {
  return status === "completed" || status === "failed" || status === "cancelled"
}

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

  return updateTaskRunState({
    taskId: args.taskId,
    status: args.status,
    finishedAt: nowIsoString(),
    exitCode: args.exitCode ?? null,
    stdout: args.stdout,
    stderr: args.stderr,
    error: args.error ?? null,
    failureCode: args.failureCode ?? null,
  })
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
    const result = await codexSdkGateway.startThreadAndRun({
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
      failureCode: "CODEX_SDK_RUN_FAILED",
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

  try {
    const result = await codexSdkGateway.resumeThreadAndRun({
      taskId: args.taskId,
      threadId: args.threadId,
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
      failureCode: "CODEX_SDK_RUN_FAILED",
    })
  }
}

export async function createAndRunCodexTask(input: {
  projectId: string
  projectPath: string
  prompt: string
  model: string | null
  parentTaskId?: string | null
}): Promise<CodexTask> {
  const createdTask = await createTask({
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

  const runningTask = await updateTaskRunState({
    taskId: createdTask.id,
    status: "running",
    startedAt: nowIsoString(),
    command: ["@openai/codex-sdk", "startThreadAndRun"],
    error: null,
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

export async function followupCodexTask(input: {
  parentTaskId: string
  threadId: string
  projectId: string
  projectPath: string
  prompt: string
  model: string | null
}): Promise<CodexTask> {
  const createdTask = await createTask({
    projectId: input.projectId,
    projectPath: input.projectPath,
    prompt: input.prompt,
    model: input.model,
    threadId: input.threadId,
    parentTaskId: input.parentTaskId,
  })

  const controller = new AbortController()
  runningCodexTasks.set(createdTask.id, {
    controller,
    cancellationRequested: false,
    cancellationReason: null,
  })

  const runningTask = await updateTaskRunState({
    taskId: createdTask.id,
    status: "running",
    startedAt: nowIsoString(),
    command: ["@openai/codex-sdk", "resumeThreadAndRun", input.threadId],
    error: null,
  })

  void executeResumedThreadTask({
    taskId: createdTask.id,
    threadId: input.threadId,
    projectId: input.projectId,
    projectPath: input.projectPath,
    prompt: input.prompt,
    model: input.model,
  })

  return runningTask
}

export async function cancelCodexTask(input: {
  taskId: string
  reason?: string
}): Promise<CodexTask> {
  const taskId = input.taskId.trim()
  if (!taskId) {
    throw new Error("Task id cannot be empty.")
  }

  const existing = await getTaskById(taskId)
  if (!existing) {
    throw new Error(`Task not found: ${taskId}`)
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

  return updateTaskRunState({
    taskId,
    status: "cancelled",
    finishedAt: nowIsoString(),
    error: reason,
    failureCode: "TASK_CANCELLED",
  })
}
