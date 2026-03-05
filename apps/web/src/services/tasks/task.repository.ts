import { readFile } from "node:fs/promises"

import {
  Prisma,
  TaskEventType,
  TaskStatus as PrismaTaskStatus,
} from "@prisma/client"

import { prisma } from "@/lib/prisma"
import type {
  CodexTask,
  TaskEvent,
  TaskEventType as DomainTaskEventType,
  TaskErrorCode,
  TaskStatus,
  TaskStoreDocument,
} from "@/services/tasks/types"
import { getAppConfig } from "@/utils/yaml-config"

type TaskSummaryPayload = {
  stdout?: string
  stderr?: string
}

type TaskWithLatestRun = {
  id: string
  projectId: string
  projectPath: string
  prompt: string
  model: string | null
  status: PrismaTaskStatus
  createdAt: Date
  runs: Array<{
    status: PrismaTaskStatus
    startedAt: Date | null
    finishedAt: Date | null
    exitCode: number | null
    command: string | null
    failureMessage: string | null
    cancellationReason: string | null
    events: Array<{
      payload: string
    }>
  }>
}

function toPrismaTaskStatus(status: TaskStatus): PrismaTaskStatus {
  return status
}

function toDomainTaskStatus(status: PrismaTaskStatus): TaskStatus {
  return status
}

function toDomainTaskEventType(type: TaskEventType): DomainTaskEventType {
  return type
}

function normalizeLegacyStatus(value: unknown): TaskStatus {
  if (
    value === "queued" ||
    value === "running" ||
    value === "completed" ||
    value === "failed" ||
    value === "cancelled"
  ) {
    return value
  }

  return "failed"
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

function toIsoString(value: Date | null | undefined): string | null {
  if (!value) {
    return null
  }

  return value.toISOString()
}

function parseSummaryPayload(payload: string | null | undefined): TaskSummaryPayload {
  if (!payload) {
    return {}
  }

  try {
    const parsed = JSON.parse(payload)
    if (typeof parsed !== "object" || parsed === null) {
      return {}
    }

    return {
      stdout: typeof parsed.stdout === "string" ? parsed.stdout : undefined,
      stderr: typeof parsed.stderr === "string" ? parsed.stderr : undefined,
    }
  } catch {
    return {}
  }
}

function serializeCommand(command: string[] | undefined) {
  if (command === undefined) {
    return undefined
  }

  if (command.length === 0) {
    return null
  }

  return JSON.stringify(command)
}

function parseCommand(command: string | null): string[] {
  if (!command) {
    return []
  }

  try {
    const parsed = JSON.parse(command)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter((item): item is string => typeof item === "string")
  } catch {
    return []
  }
}

function toCodexTask(task: TaskWithLatestRun): CodexTask {
  const latestRun = task.runs[0]
  const summary = parseSummaryPayload(latestRun?.events[0]?.payload)

  return {
    id: task.id,
    projectId: task.projectId,
    projectPath: task.projectPath,
    prompt: task.prompt,
    model: task.model,
    status: latestRun
      ? toDomainTaskStatus(latestRun.status)
      : toDomainTaskStatus(task.status),
    createdAt: task.createdAt.toISOString(),
    startedAt: toIsoString(latestRun?.startedAt),
    finishedAt: toIsoString(latestRun?.finishedAt),
    exitCode: latestRun?.exitCode ?? null,
    command: parseCommand(latestRun?.command ?? null),
    stdout: summary.stdout ?? "",
    stderr: summary.stderr ?? "",
    error: latestRun?.failureMessage ?? latestRun?.cancellationReason ?? null,
  }
}

function normalizeLegacyTaskDocument(candidate: unknown): TaskStoreDocument {
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    !Array.isArray((candidate as { tasks?: unknown[] }).tasks)
  ) {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      tasks: [],
    }
  }

  const tasks = (candidate as { tasks: unknown[] }).tasks
  const normalizedTasks: CodexTask[] = []

  for (const item of tasks) {
    if (typeof item !== "object" || item === null) {
      continue
    }

    const record = item as Record<string, unknown>
    const id = typeof record.id === "string" ? record.id : null
    const projectId =
      typeof record.projectId === "string"
        ? record.projectId
        : typeof record.workspaceId === "string"
          ? record.workspaceId
          : null
    const projectPath =
      typeof record.projectPath === "string"
        ? record.projectPath
        : typeof record.workspacePath === "string"
          ? record.workspacePath
          : null
    const prompt = typeof record.prompt === "string" ? record.prompt : null
    const createdAt =
      typeof record.createdAt === "string" ? record.createdAt : null

    if (!id || !projectId || !projectPath || !prompt || !createdAt) {
      continue
    }

    normalizedTasks.push({
      id,
      projectId,
      projectPath,
      prompt,
      model: typeof record.model === "string" ? record.model : null,
      status: normalizeLegacyStatus(record.status),
      createdAt,
      startedAt: typeof record.startedAt === "string" ? record.startedAt : null,
      finishedAt:
        typeof record.finishedAt === "string" ? record.finishedAt : null,
      exitCode: typeof record.exitCode === "number" ? record.exitCode : null,
      command: Array.isArray(record.command)
        ? record.command.filter((value): value is string => typeof value === "string")
        : [],
      stdout: typeof record.stdout === "string" ? record.stdout : "",
      stderr: typeof record.stderr === "string" ? record.stderr : "",
      error: typeof record.error === "string" ? record.error : null,
    })
  }

  return {
    version:
      typeof (candidate as { version?: unknown }).version === "number"
        ? ((candidate as { version: number }).version ?? 1)
        : 1,
    updatedAt:
      typeof (candidate as { updatedAt?: unknown }).updatedAt === "string"
        ? ((candidate as { updatedAt: string }).updatedAt ?? new Date().toISOString())
        : new Date().toISOString(),
    tasks: normalizedTasks,
  }
}

async function loadLegacyTaskDocument(): Promise<TaskStoreDocument> {
  const legacyFilePath = getAppConfig().task.dataFile

  try {
    const content = await readFile(legacyFilePath, "utf8")
    return normalizeLegacyTaskDocument(JSON.parse(content))
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "ENOENT"
    ) {
      return {
        version: 1,
        updatedAt: new Date().toISOString(),
        tasks: [],
      }
    }

    throw error
  }
}

let legacyImportPromise: Promise<void> | null = null
let legacyImportCompleted = false

async function ensureLegacyTasksImported() {
  if (legacyImportCompleted) {
    return
  }

  if (legacyImportPromise) {
    await legacyImportPromise
    return
  }

  legacyImportPromise = (async () => {
    const legacyDocument = await loadLegacyTaskDocument()
    if (legacyDocument.tasks.length === 0) {
      legacyImportCompleted = true
      return
    }

    for (const legacyTask of legacyDocument.tasks) {
      const existing = await prisma.task.findUnique({
        where: {
          legacyTaskId: legacyTask.id,
        },
        select: {
          id: true,
        },
      })

      if (existing) {
        continue
      }

      const status = toPrismaTaskStatus(legacyTask.status)
      const createdAt = toDate(legacyTask.createdAt) ?? new Date()
      const startedAt = toDate(legacyTask.startedAt)
      const finishedAt = toDate(legacyTask.finishedAt)

      const runEvents: Array<{
        sequence: number
        type: TaskEventType
        payload: string
      }> = []
      let sequence = 1

      runEvents.push({
        sequence,
        type: TaskEventType.state,
        payload: JSON.stringify({
          to: legacyTask.status,
          source: "legacy-import",
        }),
      })
      sequence += 1

      if (legacyTask.stdout || legacyTask.stderr) {
        runEvents.push({
          sequence,
          type: TaskEventType.summary,
          payload: JSON.stringify({
            stdout: legacyTask.stdout,
            stderr: legacyTask.stderr,
          }),
        })
        sequence += 1
      }

      if (legacyTask.error) {
        runEvents.push({
          sequence,
          type: TaskEventType.system,
          payload: legacyTask.error,
        })
      }

      await prisma.task.create({
        data: {
          legacyTaskId: legacyTask.id,
          projectId: legacyTask.projectId,
          projectPath: legacyTask.projectPath,
          prompt: legacyTask.prompt,
          executor: "codex",
          model: legacyTask.model,
          status,
          createdAt,
          runs: {
            create: {
              attempt: 1,
              status,
              startedAt,
              finishedAt,
              exitCode: legacyTask.exitCode,
              command: serializeCommand(legacyTask.command) ?? null,
              failureMessage: legacyTask.error,
              cancellationReason:
                legacyTask.status === "cancelled" ? legacyTask.error : null,
              createdAt,
              events: runEvents.length
                ? {
                    create: runEvents,
                  }
                : undefined,
            },
          },
        },
      })
    }

    legacyImportCompleted = true
  })()

  try {
    await legacyImportPromise
  } finally {
    legacyImportPromise = null
  }
}

async function nextTaskEventSequence(args: {
  runId: string
  tx: Prisma.TransactionClient
}) {
  const row = await args.tx.taskEvent.findFirst({
    where: {
      runId: args.runId,
    },
    select: {
      sequence: true,
    },
    orderBy: {
      sequence: "desc",
    },
  })

  return (row?.sequence ?? 0) + 1
}

async function ensureLegacyTasksImportedOrThrow(code: TaskErrorCode) {
  try {
    await ensureLegacyTasksImported()
  } catch (error) {
    throw new TaskRepositoryError(
      code,
      `Failed to import legacy task store: ${String(error)}`,
    )
  }
}

function withLatestRunQuery() {
  return {
    runs: {
      orderBy: {
        attempt: "desc" as const,
      },
      take: 1,
      include: {
        events: {
          where: {
            type: TaskEventType.summary,
          },
          orderBy: {
            sequence: "desc" as const,
          },
          take: 1,
        },
      },
    },
  }
}

export class TaskRepositoryError extends Error {
  code: TaskErrorCode

  constructor(code: TaskErrorCode, message: string) {
    super(message)
    this.name = "TaskRepositoryError"
    this.code = code
  }
}

export async function listTasksByProject(args: {
  projectId: string
  limit?: number
}): Promise<CodexTask[]> {
  const projectId = args.projectId.trim()
  if (!projectId) {
    return []
  }

  try {
    await ensureLegacyTasksImportedOrThrow("STORE_READ_ERROR")

    const tasks = await prisma.task.findMany({
      where: {
        projectId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take:
        typeof args.limit === "number" && Number.isFinite(args.limit)
          ? Math.max(1, Math.trunc(args.limit))
          : undefined,
      include: withLatestRunQuery(),
    })

    return tasks.map((task) => toCodexTask(task))
  } catch (error) {
    throw new TaskRepositoryError(
      "STORE_READ_ERROR",
      `Failed to read task store: ${String(error)}`,
    )
  }
}

export async function getTaskById(taskId: string): Promise<CodexTask | null> {
  const trimmedTaskId = taskId.trim()
  if (!trimmedTaskId) {
    return null
  }

  try {
    await ensureLegacyTasksImportedOrThrow("STORE_READ_ERROR")

    const task = await prisma.task.findUnique({
      where: {
        id: trimmedTaskId,
      },
      include: withLatestRunQuery(),
    })

    if (!task) {
      return null
    }

    return toCodexTask(task)
  } catch (error) {
    throw new TaskRepositoryError(
      "STORE_READ_ERROR",
      `Failed to read task store: ${String(error)}`,
    )
  }
}

export async function createTask(input: {
  projectId: string
  projectPath: string
  prompt: string
  model: string | null
}): Promise<CodexTask> {
  const projectId = input.projectId.trim()
  const prompt = input.prompt.trim()
  if (!projectId || !prompt) {
    throw new TaskRepositoryError(
      "STORE_WRITE_ERROR",
      "projectId and prompt are required.",
    )
  }

  try {
    await ensureLegacyTasksImportedOrThrow("STORE_WRITE_ERROR")

    const task = await prisma.task.create({
      data: {
        projectId,
        projectPath: input.projectPath,
        prompt,
        model: input.model,
        executor: "codex",
        status: PrismaTaskStatus.queued,
        runs: {
          create: {
            attempt: 1,
            status: PrismaTaskStatus.queued,
          },
        },
      },
      include: withLatestRunQuery(),
    })

    return toCodexTask(task)
  } catch (error) {
    throw new TaskRepositoryError(
      "STORE_WRITE_ERROR",
      `Failed to write task store: ${String(error)}`,
    )
  }
}

export async function updateTaskRunState(input: {
  taskId: string
  status: TaskStatus
  startedAt?: string | null
  finishedAt?: string | null
  exitCode?: number | null
  command?: string[]
  stdout?: string
  stderr?: string
  error?: string | null
}): Promise<CodexTask> {
  const taskId = input.taskId.trim()
  if (!taskId) {
    throw new TaskRepositoryError("INVALID_TASK_ID", "Task id cannot be empty.")
  }

  try {
    await ensureLegacyTasksImportedOrThrow("STORE_WRITE_ERROR")

    return await prisma.$transaction(async (tx) => {
      const task = await tx.task.findUnique({
        where: {
          id: taskId,
        },
        include: {
          runs: {
            orderBy: {
              attempt: "desc",
            },
            take: 1,
          },
        },
      })

      if (!task) {
        throw new TaskRepositoryError("NOT_FOUND", `Task not found: ${taskId}`)
      }

      const run = task.runs[0]
      if (!run) {
        throw new TaskRepositoryError("NOT_FOUND", `Task run not found: ${taskId}`)
      }

      const nextStatus = toPrismaTaskStatus(input.status)
      const command = serializeCommand(input.command)
      const failureMessage = input.error === undefined ? undefined : input.error

      await tx.task.update({
        where: {
          id: taskId,
        },
        data: {
          status: nextStatus,
        },
      })

      await tx.taskRun.update({
        where: {
          id: run.id,
        },
        data: {
          status: nextStatus,
          startedAt:
            input.startedAt !== undefined ? toDate(input.startedAt) : undefined,
          finishedAt:
            input.finishedAt !== undefined ? toDate(input.finishedAt) : undefined,
          exitCode: input.exitCode !== undefined ? input.exitCode : undefined,
          command,
          failureMessage,
          cancellationReason:
            input.status === "cancelled" && input.error !== undefined
              ? input.error
              : undefined,
        },
      })

      let eventSequence = await nextTaskEventSequence({
        runId: run.id,
        tx,
      })

      if (run.status !== nextStatus) {
        await tx.taskEvent.create({
          data: {
            runId: run.id,
            sequence: eventSequence,
            type: TaskEventType.state,
            payload: JSON.stringify({
              from: run.status,
              to: nextStatus,
            }),
          },
        })

        eventSequence += 1
      }

      if (input.stdout !== undefined || input.stderr !== undefined) {
        await tx.taskEvent.create({
          data: {
            runId: run.id,
            sequence: eventSequence,
            type: TaskEventType.summary,
            payload: JSON.stringify({
              stdout: input.stdout ?? "",
              stderr: input.stderr ?? "",
            }),
          },
        })
      }

      const updatedTask = await tx.task.findUnique({
        where: {
          id: taskId,
        },
        include: withLatestRunQuery(),
      })

      if (!updatedTask) {
        throw new TaskRepositoryError("NOT_FOUND", `Task not found: ${taskId}`)
      }

      return toCodexTask(updatedTask)
    })
  } catch (error) {
    if (error instanceof TaskRepositoryError) {
      throw error
    }

    throw new TaskRepositoryError(
      "STORE_WRITE_ERROR",
      `Failed to write task store: ${String(error)}`,
    )
  }
}

export async function listTaskEvents(args: {
  taskId: string
  afterSequence?: number
  limit?: number
}): Promise<TaskEvent[]> {
  const taskId = args.taskId.trim()
  if (!taskId) {
    throw new TaskRepositoryError("INVALID_TASK_ID", "Task id cannot be empty.")
  }

  try {
    await ensureLegacyTasksImportedOrThrow("STORE_READ_ERROR")

    const latestRun = await prisma.taskRun.findFirst({
      where: {
        taskId,
      },
      orderBy: {
        attempt: "desc",
      },
      select: {
        id: true,
      },
    })

    if (!latestRun) {
      throw new TaskRepositoryError("NOT_FOUND", `Task run not found: ${taskId}`)
    }

    const normalizedLimit =
      typeof args.limit === "number" && Number.isFinite(args.limit)
        ? Math.max(1, Math.trunc(args.limit))
        : 200
    const afterSequence =
      typeof args.afterSequence === "number" && Number.isFinite(args.afterSequence)
        ? Math.max(0, Math.trunc(args.afterSequence))
        : 0

    const events = await prisma.taskEvent.findMany({
      where: {
        runId: latestRun.id,
        sequence: {
          gt: afterSequence,
        },
      },
      orderBy: {
        sequence: "asc",
      },
      take: normalizedLimit,
    })

    return events.map((event) => ({
      id: event.id,
      taskId,
      runId: event.runId,
      sequence: event.sequence,
      type: toDomainTaskEventType(event.type),
      payload: event.payload,
      createdAt: event.createdAt.toISOString(),
    }))
  } catch (error) {
    if (error instanceof TaskRepositoryError) {
      throw error
    }

    throw new TaskRepositoryError(
      "STORE_READ_ERROR",
      `Failed to read task events: ${String(error)}`,
    )
  }
}
