import {
  Prisma,
  type PrismaClient,
  TaskMessageRole as PrismaTaskMessageRole,
  TaskStatus as PrismaTaskStatus,
  TaskTimelineItemKind as PrismaTaskTimelineItemKind,
} from "@prisma/client"

import { createTaskError, TaskError } from "../errors"
import type {
  CodexTask,
  TaskMessageRole,
  TaskStatus,
  TaskTimeline,
  TaskTimelineItem,
  TaskTimelineItemKind,
} from "../types"

export type TaskDbClient = PrismaClient

export type ListTasksByProjectInput = {
  projectId: string
  limit?: number
}

export type CreateTaskInput = {
  projectId: string
  projectPath: string
  prompt: string
  model: string | null
  threadId?: string | null
  parentTaskId?: string | null
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

export type ListTaskTimelineInput = {
  taskId: string
  afterSequence?: number
  limit?: number
}

export type AppendTimelineItemInput = {
  taskId: string
  kind: TaskTimelineItemKind
  role?: TaskMessageRole | null
  status?: TaskStatus | null
  source?: string | null
  content?: string | null
  payload?: string | null
  createdAt?: string | null
}

function toPrismaTaskStatus(status: TaskStatus): PrismaTaskStatus {
  return status
}

function toPrismaTaskMessageRole(
  role: TaskMessageRole | null | undefined,
): PrismaTaskMessageRole | null {
  return role ?? null
}

function toPrismaTaskTimelineItemKind(
  kind: TaskTimelineItemKind,
): PrismaTaskTimelineItemKind {
  return kind
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

function parseCommand(command: string | null): string[] {
  if (!command) {
    return []
  }

  try {
    const parsed = JSON.parse(command)
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : []
  } catch {
    return []
  }
}

function toCodexTask(task: {
  id: string
  projectId: string
  projectPath: string
  prompt: string
  executor: string
  model: string | null
  status: PrismaTaskStatus
  threadId: string | null
  parentTaskId: string | null
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
    executor: task.executor,
    model: task.model,
    status: toDomainTaskStatus(task.status),
    threadId: task.threadId,
    parentTaskId: task.parentTaskId,
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

function toTaskTimelineItem(item: {
  id: string
  taskId: string
  sequence: number
  kind: PrismaTaskTimelineItemKind
  role: PrismaTaskMessageRole | null
  status: PrismaTaskStatus | null
  source: string | null
  content: string | null
  payload: string | null
  createdAt: Date
}): TaskTimelineItem {
  return {
    id: item.id,
    taskId: item.taskId,
    sequence: item.sequence,
    kind: item.kind,
    role: item.role,
    status: item.status ? toDomainTaskStatus(item.status) : null,
    source: item.source,
    content: item.content,
    payload: item.payload,
    createdAt: item.createdAt.toISOString(),
  }
}

async function nextTaskTimelineSequence(args: {
  taskId: string
  tx: Prisma.TransactionClient
}) {
  const aggregate = await args.tx.taskTimelineItem.aggregate({
    where: {
      taskId: args.taskId,
    },
    _max: {
      sequence: true,
    },
  })

  return (aggregate._max.sequence ?? 0) + 1
}

async function appendTimelineItemInTransaction(args: {
  tx: Prisma.TransactionClient
  input: AppendTimelineItemInput
}) {
  const sequence = await nextTaskTimelineSequence({
    taskId: args.input.taskId,
    tx: args.tx,
  })

  const item = await args.tx.taskTimelineItem.create({
    data: {
      taskId: args.input.taskId,
      sequence,
      kind: toPrismaTaskTimelineItemKind(args.input.kind),
      role: toPrismaTaskMessageRole(args.input.role),
      status: args.input.status ? toPrismaTaskStatus(args.input.status) : null,
      source: args.input.source ?? null,
      content: args.input.content ?? null,
      payload: args.input.payload ?? null,
      createdAt: toDate(args.input.createdAt) ?? undefined,
    },
  })

  return toTaskTimelineItem(item)
}

export function createTaskRepository(prisma: TaskDbClient) {
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
    if (!projectId || !prompt) {
      throw createTaskError.storeWriteError(
        "create task",
        new Error("projectId and prompt are required."),
      )
    }

    try {
      return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const task = await tx.task.create({
          data: {
            projectId,
            projectPath: input.projectPath,
            prompt,
            model: input.model,
            executor: "codex",
            status: PrismaTaskStatus.queued,
            threadId: input.threadId ?? null,
            parentTaskId: input.parentTaskId ?? null,
          },
        })

        await appendTimelineItemInTransaction({
          tx,
          input: {
            taskId: task.id,
            kind: "status",
            status: "queued",
            source: "task.lifecycle",
            content: "Task queued.",
            payload: JSON.stringify({
              from: null,
              to: "queued",
            }),
          },
        })

        return toCodexTask(task)
      })
    } catch (error) {
      throw createTaskError.storeWriteError("create task", error)
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

        if (task.status !== nextStatus) {
          await appendTimelineItemInTransaction({
            tx,
            input: {
              taskId,
              kind: "status",
              status: input.status,
              source: "task.lifecycle",
              content: `Task status changed: ${task.status} -> ${input.status}.`,
              payload: JSON.stringify({
                from: task.status,
                to: input.status,
              }),
            },
          })
        }

        return toCodexTask(updatedTask)
      })
    } catch (error) {
      if (error instanceof TaskError) {
        throw error
      }

      throw createTaskError.storeWriteError("update task state", error)
    }
  }

  async function appendTimelineItem(
    input: AppendTimelineItemInput,
  ): Promise<TaskTimelineItem> {
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

        return appendTimelineItemInTransaction({
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

      throw createTaskError.storeWriteError("append timeline item", error)
    }
  }

  async function listTaskTimeline(
    args: ListTaskTimelineInput,
  ): Promise<TaskTimeline> {
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

      const items = await prisma.taskTimelineItem.findMany({
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
        items: items.map((item) => toTaskTimelineItem(item)),
        nextSequence,
      }
    } catch (error) {
      if (error instanceof TaskError) {
        throw error
      }

      throw createTaskError.storeReadError("list task timeline", error)
    }
  }

  return {
    listTasksByProject,
    getTaskById,
    createTask,
    setTaskThreadId,
    hasActiveTaskInThread,
    updateTaskState,
    appendTimelineItem,
    listTaskTimeline,
  }
}

export type TaskRepository = ReturnType<typeof createTaskRepository>
