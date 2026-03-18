import {
  Prisma,
  type PrismaClient,
  TaskStatus as PrismaTaskStatus,
} from "@prisma/client"

import { createTaskError, TaskError } from "../errors"
import type {
  TaskAgentEvent,
  TaskAgentEventStream,
  TaskAgentEventType,
  CodexTask,
  TaskStatus,
  TaskTitleSource,
} from "../types"
import type {
  RuntimeExecutionMode,
  RuntimePolicy,
} from "../runtime-policy"
import {
  parseRuntimePolicy,
  serializeRuntimePolicy,
} from "../runtime-policy"

export type TaskDbClient = PrismaClient

export type ListTasksByProjectInput = {
  projectId: string
  limit?: number
  includeArchived?: boolean
}

export type ListTasksByStatusesInput = {
  statuses: TaskStatus[]
  limit?: number
}

export type CreateTaskInput = {
  projectId: string
  projectPath: string
  prompt: string
  executor: string
  executionMode?: RuntimeExecutionMode | null
  runtimePolicy?: RuntimePolicy | null
  model: string | null
  threadId?: string | null
  parentTaskId?: string | null
}

export type UpdateTaskTitleInput = {
  taskId: string
  title: string
  titleSource: TaskTitleSource
}

export type ArchiveTaskInput = {
  taskId: string
}

export type DeleteTaskInput = {
  taskId: string
}

export type UpdateTaskStateInput = {
  taskId: string
  status: TaskStatus
  startedAt?: string | null
  finishedAt?: string | null
  exitCode?: number | null
  command?: string[]
  stdout?: string
  stderr?: string
  error?: string | null
}

export type SetTaskThreadIdInput = {
  taskId: string
  threadId: string
}

export type ListTaskAgentEventsInput = {
  taskId: string
  afterSequence?: number
  limit?: number
}

export type AppendTaskAgentEventInput = {
  taskId: string
  eventType: TaskAgentEventType
  payload: Record<string, unknown>
  createdAt?: string | null
}

function toPrismaTaskStatus(status: TaskStatus): PrismaTaskStatus {
  return status
}

function toDomainTaskStatus(status: PrismaTaskStatus): TaskStatus {
  return status
}

function toIsoString(value: Date | null | undefined): string | null {
  if (!value) {
    return null
  }

  return value.toISOString()
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

function serializeCommand(command: string[] | undefined) {
  if (!command || command.length === 0) {
    return null
  }

  return JSON.stringify(command)
}

function deriveTaskTitle(prompt: string) {
  const firstLine = prompt
    .split(/\r?\n/)
    .find((line) => line.trim().length > 0)
    ?.trim() ?? prompt.trim()

  if (!firstLine) {
    return "Untitled task"
  }

  return firstLine.length > 96 ? `${firstLine.slice(0, 96)}...` : firstLine
}

function parseCommand(command: string | null): string[] {
  const parsed = safeParseJson(command)
  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === "string")
    : []
}

function parseJsonObject(value: string): Record<string, unknown> {
  const parsed = safeParseJson(value)
  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>
  }

  return {}
}

function safeParseJson(value: string | null): unknown {
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function toCodexTask(task: {
  id: string
  projectId: string
  projectPath: string
  prompt: string
  title: string
  titleSource: TaskTitleSource
  titleUpdatedAt: Date | null
  executor: string
  executionMode: string | null
  runtimePolicy: string | null
  model: string | null
  status: PrismaTaskStatus
  threadId: string | null
  parentTaskId: string | null
  archivedAt: Date | null
  createdAt: Date
  startedAt: Date | null
  finishedAt: Date | null
  exitCode: number | null
  command: string | null
  stdout: string
  stderr: string
  error: string | null
}): CodexTask {
  return {
    id: task.id,
    projectId: task.projectId,
    projectPath: task.projectPath,
    prompt: task.prompt,
    title: task.title,
    titleSource: task.titleSource,
    titleUpdatedAt: toIsoString(task.titleUpdatedAt),
    executor: task.executor,
    executionMode: (task.executionMode as RuntimeExecutionMode | null) ?? null,
    runtimePolicy: parseRuntimePolicy(task.runtimePolicy),
    model: task.model,
    status: toDomainTaskStatus(task.status),
    threadId: task.threadId,
    parentTaskId: task.parentTaskId,
    archivedAt: toIsoString(task.archivedAt),
    createdAt: task.createdAt.toISOString(),
    startedAt: toIsoString(task.startedAt),
    finishedAt: toIsoString(task.finishedAt),
    exitCode: task.exitCode,
    command: parseCommand(task.command),
    stdout: task.stdout,
    stderr: task.stderr,
    error: task.error,
  }
}

function toTaskAgentEvent(event: {
  id: string
  taskId: string
  sequence: number
  eventType: string
  payload: string
  createdAt: Date
}): TaskAgentEvent {
  return {
    id: event.id,
    taskId: event.taskId,
    sequence: event.sequence,
    eventType: event.eventType as TaskAgentEventType,
    payload: parseJsonObject(event.payload),
    createdAt: event.createdAt.toISOString(),
  }
}

async function nextTaskAgentEventSequence(args: {
  taskId: string
  tx: Prisma.TransactionClient
}) {
  const aggregate = await args.tx.taskAgentEvent.aggregate({
    where: {
      taskId: args.taskId,
    },
    _max: {
      sequence: true,
    },
  })

  return (aggregate._max.sequence ?? 0) + 1
}

async function appendTaskAgentEventInTransaction(args: {
  tx: Prisma.TransactionClient
  input: AppendTaskAgentEventInput
}) {
  const sequence = await nextTaskAgentEventSequence({
    taskId: args.input.taskId,
    tx: args.tx,
  })

  const event = await args.tx.taskAgentEvent.create({
    data: {
      taskId: args.input.taskId,
      sequence,
      eventType: args.input.eventType,
      payload: JSON.stringify(args.input.payload),
      createdAt: toDate(args.input.createdAt) ?? undefined,
    },
  })

  return toTaskAgentEvent(event)
}

export function createTaskRepository(prisma: TaskDbClient) {
  async function listTasksByStatuses(
    args: ListTasksByStatusesInput,
  ): Promise<CodexTask[]> {
    const statuses = args.statuses
      .map((status) => status.trim())
      .filter((status): status is TaskStatus => Boolean(status))

    if (statuses.length === 0) {
      return []
    }

    try {
      const take =
        typeof args.limit === "number" && Number.isFinite(args.limit)
          ? Math.max(1, Math.trunc(args.limit))
          : 500

      const tasks = await prisma.task.findMany({
        where: {
          status: {
            in: statuses.map((status) => toPrismaTaskStatus(status)),
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        take,
      })

      return tasks.map((task) => toCodexTask(task))
    } catch (error) {
      throw createTaskError.storeReadError("list tasks by statuses", error)
    }
  }

  async function listTasksByProject(
    args: ListTasksByProjectInput,
  ): Promise<CodexTask[]> {
    const projectId = args.projectId.trim()
    if (!projectId) {
      return []
    }

    try {
      const take =
        typeof args.limit === "number" && Number.isFinite(args.limit)
          ? Math.max(1, Math.trunc(args.limit))
          : 200

      const tasks = await prisma.task.findMany({
        where: {
          projectId,
          ...(args.includeArchived ? {} : { archivedAt: null }),
        },
        orderBy: {
          createdAt: "desc",
        },
        take,
      })

      return tasks.map((task) => toCodexTask(task))
    } catch (error) {
      throw createTaskError.storeReadError("list tasks by project", error)
    }
  }

  async function getTaskById(taskId: string): Promise<CodexTask | null> {
    const normalizedTaskId = taskId.trim()
    if (!normalizedTaskId) {
      return null
    }

    try {
      const task = await prisma.task.findUnique({
        where: {
          id: normalizedTaskId,
        },
      })

      return task ? toCodexTask(task) : null
    } catch (error) {
      throw createTaskError.storeReadError("get task by id", error)
    }
  }

  async function createTask(input: CreateTaskInput): Promise<CodexTask> {
    const projectId = input.projectId.trim()
    const prompt = input.prompt.trim()
    const executor = input.executor.trim()
    if (!projectId || !prompt || !executor) {
      throw createTaskError.storeWriteError(
        "create task",
        new Error("projectId, prompt, and executor are required."),
      )
    }

    try {
      return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const task = await tx.task.create({
          data: {
            projectId,
            projectPath: input.projectPath,
            prompt,
            title: deriveTaskTitle(prompt),
            titleSource: "prompt",
            titleUpdatedAt: new Date(),
            model: input.model,
            executor,
            executionMode: input.executionMode ?? null,
            runtimePolicy: serializeRuntimePolicy(input.runtimePolicy),
            status: PrismaTaskStatus.queued,
            threadId: input.threadId ?? null,
            parentTaskId: input.parentTaskId ?? null,
          },
        })

        return toCodexTask(task)
      })
    } catch (error) {
      throw createTaskError.storeWriteError("create task", error)
    }
  }

  async function updateTaskTitle(input: UpdateTaskTitleInput): Promise<CodexTask> {
    const taskId = input.taskId.trim()
    const title = input.title.trim()
    if (!taskId || !title) {
      throw createTaskError.storeWriteError(
        "update task title",
        new Error("taskId and title are required."),
      )
    }

    try {
      const existingTask = await prisma.task.findUnique({
        where: {
          id: taskId,
        },
      })

      if (!existingTask) {
        throw createTaskError.taskNotFound(taskId)
      }

      const task = await prisma.task.update({
        where: {
          id: taskId,
        },
        data: {
          title,
          titleSource: input.titleSource,
          titleUpdatedAt: new Date(),
        },
      })

      return toCodexTask(task)
    } catch (error) {
      if (error instanceof TaskError) {
        throw error
      }

      throw createTaskError.storeWriteError("update task title", error)
    }
  }

  async function archiveTask(input: ArchiveTaskInput): Promise<CodexTask> {
    const taskId = input.taskId.trim()
    if (!taskId) {
      throw createTaskError.storeWriteError(
        "archive task",
        new Error("taskId is required."),
      )
    }

    try {
      const existingTask = await prisma.task.findUnique({
        where: {
          id: taskId,
        },
      })

      if (!existingTask) {
        throw createTaskError.taskNotFound(taskId)
      }

      if (existingTask.archivedAt) {
        return toCodexTask(existingTask)
      }

      const task = await prisma.task.update({
        where: {
          id: taskId,
        },
        data: {
          archivedAt: new Date(),
        },
      })

      return toCodexTask(task)
    } catch (error) {
      if (error instanceof TaskError) {
        throw error
      }

      throw createTaskError.storeWriteError("archive task", error)
    }
  }

  async function deleteTask(input: DeleteTaskInput): Promise<{
    taskId: string
    projectId: string
  }> {
    const taskId = input.taskId.trim()
    if (!taskId) {
      throw createTaskError.storeWriteError(
        "delete task",
        new Error("taskId is required."),
      )
    }

    try {
      const existingTask = await prisma.task.findUnique({
        where: {
          id: taskId,
        },
        select: {
          id: true,
          projectId: true,
        },
      })

      if (!existingTask) {
        throw createTaskError.taskNotFound(taskId)
      }

      await prisma.task.delete({
        where: {
          id: taskId,
        },
      })

      return {
        taskId: existingTask.id,
        projectId: existingTask.projectId,
      }
    } catch (error) {
      if (error instanceof TaskError) {
        throw error
      }

      throw createTaskError.storeWriteError("delete task", error)
    }
  }

  async function setTaskThreadId(input: SetTaskThreadIdInput) {
    const taskId = input.taskId.trim()
    const threadId = input.threadId.trim()
    if (!taskId || !threadId) {
      throw createTaskError.storeWriteError(
        "set task thread id",
        new Error("taskId and threadId are required."),
      )
    }

    try {
      await prisma.task.update({
        where: {
          id: taskId,
        },
        data: {
          threadId,
        },
      })
    } catch (error) {
      throw createTaskError.storeWriteError("set task thread id", error)
    }
  }

  async function hasActiveTaskInThread(args: {
    threadId: string
    excludeTaskId?: string
  }) {
    const threadId = args.threadId.trim()
    if (!threadId) {
      return false
    }

    try {
      const activeTask = await prisma.task.findFirst({
        where: {
          threadId,
          status: {
            in: [PrismaTaskStatus.queued, PrismaTaskStatus.running],
          },
          ...(args.excludeTaskId
            ? {
                id: {
                  not: args.excludeTaskId,
                },
              }
            : {}),
        },
        select: {
          id: true,
        },
      })

      return Boolean(activeTask)
    } catch (error) {
      throw createTaskError.storeReadError("check active task in thread", error)
    }
  }

  async function updateTaskState(
    input: UpdateTaskStateInput,
  ): Promise<CodexTask> {
    const taskId = input.taskId.trim()
    if (!taskId) {
      throw createTaskError.invalidTaskId("Task id cannot be empty.")
    }

    try {
      return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const task = await tx.task.findUnique({
          where: {
            id: taskId,
          },
        })

        if (!task) {
          throw createTaskError.taskNotFound(taskId)
        }

        const nextStatus = toPrismaTaskStatus(input.status)
        const command =
          input.command === undefined ? undefined : serializeCommand(input.command)

        const updatedTask = await tx.task.update({
          where: {
            id: taskId,
          },
          data: {
            status: nextStatus,
            startedAt:
              input.startedAt !== undefined ? toDate(input.startedAt) : undefined,
            finishedAt:
              input.finishedAt !== undefined ? toDate(input.finishedAt) : undefined,
            exitCode: input.exitCode !== undefined ? input.exitCode : undefined,
            command,
            stdout: input.stdout !== undefined ? input.stdout : undefined,
            stderr: input.stderr !== undefined ? input.stderr : undefined,
            error: input.error !== undefined ? input.error : undefined,
          },
        })

        return toCodexTask(updatedTask)
      })
    } catch (error) {
      if (error instanceof TaskError) {
        throw error
      }

      throw createTaskError.storeWriteError("update task state", error)
    }
  }

  async function appendTaskAgentEvent(
    input: AppendTaskAgentEventInput,
  ): Promise<TaskAgentEvent> {
    const taskId = input.taskId.trim()
    if (!taskId) {
      throw createTaskError.invalidTaskId("Task id cannot be empty.")
    }

    try {
      return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const task = await tx.task.findUnique({
          where: {
            id: taskId,
          },
          select: {
            id: true,
          },
        })

        if (!task) {
          throw createTaskError.taskNotFound(taskId)
        }

        return appendTaskAgentEventInTransaction({
          tx,
          input: {
            ...input,
            taskId,
          },
        })
      })
    } catch (error) {
      if (error instanceof TaskError) {
        throw error
      }

      throw createTaskError.storeWriteError("append task agent event", error)
    }
  }

  async function listTaskAgentEvents(
    args: ListTaskAgentEventsInput,
  ): Promise<TaskAgentEventStream> {
    const taskId = args.taskId.trim()
    if (!taskId) {
      throw createTaskError.invalidTaskId("Task id cannot be empty.")
    }

    try {
      const normalizedLimit =
        typeof args.limit === "number" && Number.isFinite(args.limit)
          ? Math.max(1, Math.trunc(args.limit))
          : 200
      const afterSequence =
        typeof args.afterSequence === "number" && Number.isFinite(args.afterSequence)
          ? Math.max(0, Math.trunc(args.afterSequence))
          : 0

      const items = await prisma.taskAgentEvent.findMany({
        where: {
          taskId,
          sequence: {
            gt: afterSequence,
          },
        },
        orderBy: {
          sequence: "asc",
        },
        take: normalizedLimit,
      })

      const nextSequence = items.reduce(
        (maxSequence, item) => Math.max(maxSequence, item.sequence),
        afterSequence,
      )

      return {
        taskId,
        items: items.map((item) => toTaskAgentEvent(item)),
        nextSequence,
      }
    } catch (error) {
      if (error instanceof TaskError) {
        throw error
      }

      throw createTaskError.storeReadError("list task agent events", error)
    }
  }

  return {
    listTasksByStatuses,
    listTasksByProject,
    getTaskById,
    createTask,
    updateTaskTitle,
    archiveTask,
    deleteTask,
    setTaskThreadId,
    hasActiveTaskInThread,
    updateTaskState,
    appendTaskAgentEvent,
    listTaskAgentEvents,
  }
}

export type TaskRepository = ReturnType<typeof createTaskRepository>
