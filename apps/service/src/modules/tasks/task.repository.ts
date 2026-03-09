import {
  Prisma,
  TaskEventType as PrismaTaskEventType,
  TaskMessageRole as PrismaTaskMessageRole,
  TaskStatus as PrismaTaskStatus,
} from "@prisma/client"

import { getPrismaClient } from "../../lib/prisma"
import type {
  CodexTask,
  TaskConversation,
  TaskConversationMessage,
  TaskErrorCode,
  TaskEvent,
  TaskEventType,
  TaskMessageRole,
  TaskStatus,
} from "./types"

type TaskSummaryPayload = {
  stdout?: string
  stderr?: string
}

type TaskWithLatestRun = Prisma.TaskGetPayload<{
  include: {
    runs: {
      orderBy: {
        attempt: "desc"
      }
      take: 1
      include: {
        events: {
          where: {
            type: "summary"
          }
          orderBy: {
            sequence: "desc"
          }
          take: 1
        }
      }
    }
  }
}>

function toPrismaTaskStatus(status: TaskStatus): PrismaTaskStatus {
  return status
}

function toPrismaTaskEventType(type: TaskEventType): PrismaTaskEventType {
  return type
}

function toPrismaTaskMessageRole(role: TaskMessageRole): PrismaTaskMessageRole {
  return role
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

function parseSummaryPayload(payload: string | null | undefined): TaskSummaryPayload {
  if (!payload) {
    return {}
  }

  try {
    const parsed = JSON.parse(payload) as Record<string, unknown>
    return {
      stdout: typeof parsed.stdout === "string" ? parsed.stdout : undefined,
      stderr: typeof parsed.stderr === "string" ? parsed.stderr : undefined,
    }
  } catch {
    return {}
  }
}

function withLatestRunQuery() {
  return {
    runs: {
      orderBy: {
        attempt: "desc",
      },
      take: 1,
      include: {
        events: {
          where: {
            type: PrismaTaskEventType.summary,
          },
          orderBy: {
            sequence: "desc",
          },
          take: 1,
        },
      },
    },
  } satisfies Prisma.TaskInclude
}

function toCodexTask(task: TaskWithLatestRun): CodexTask {
  const run = task.runs[0]
  const summary = parseSummaryPayload(run?.events[0]?.payload)

  return {
    id: task.id,
    projectId: task.projectId,
    projectPath: task.projectPath,
    prompt: task.prompt,
    model: task.model,
    status: toDomainTaskStatus(task.status),
    threadId: task.threadId,
    parentTaskId: task.parentTaskId,
    createdAt: task.createdAt.toISOString(),
    startedAt: toIsoString(run?.startedAt),
    finishedAt: toIsoString(run?.finishedAt),
    exitCode: run?.exitCode ?? null,
    command: parseCommand(run?.command ?? null),
    stdout: summary.stdout ?? "",
    stderr: summary.stderr ?? "",
    error: run?.failureMessage ?? run?.cancellationReason ?? null,
  }
}

async function nextTaskEventSequence(args: {
  runId: string
  tx: Prisma.TransactionClient
}) {
  const aggregate = await args.tx.taskEvent.aggregate({
    where: {
      runId: args.runId,
    },
    _max: {
      sequence: true,
    },
  })

  return (aggregate._max.sequence ?? 0) + 1
}

async function nextThreadMessageSequence(args: {
  threadId: string
  tx: Prisma.TransactionClient
}) {
  const aggregate = await args.tx.taskMessage.aggregate({
    where: {
      threadId: args.threadId,
    },
    _max: {
      sequence: true,
    },
  })

  return (aggregate._max.sequence ?? 0) + 1
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
    const take =
      typeof args.limit === "number" && Number.isFinite(args.limit)
        ? Math.max(1, Math.trunc(args.limit))
        : 200

    const tasks = await getPrismaClient().task.findMany({
      where: {
        projectId,
      },
      include: withLatestRunQuery(),
      orderBy: {
        createdAt: "desc",
      },
      take,
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
  const normalizedTaskId = taskId.trim()
  if (!normalizedTaskId) {
    return null
  }

  try {
    const task = await getPrismaClient().task.findUnique({
      where: {
        id: normalizedTaskId,
      },
      include: withLatestRunQuery(),
    })

    return task ? toCodexTask(task) : null
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
  threadId?: string | null
  parentTaskId?: string | null
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
    const task = await getPrismaClient().task.create({
      data: {
        projectId,
        projectPath: input.projectPath,
        prompt,
        model: input.model,
        executor: "codex",
        status: PrismaTaskStatus.queued,
        threadId: input.threadId ?? null,
        parentTaskId: input.parentTaskId ?? null,
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

export async function attachThreadToTask(input: {
  taskId: string
  threadId: string
  projectId: string
  projectPath: string
  model: string | null
}) {
  const taskId = input.taskId.trim()
  const threadId = input.threadId.trim()
  if (!taskId || !threadId) {
    throw new TaskRepositoryError(
      "STORE_WRITE_ERROR",
      "taskId and threadId are required.",
    )
  }

  try {
    await getPrismaClient().$transaction(async (tx) => {
      await tx.taskThread.upsert({
        where: {
          id: threadId,
        },
        update: {
          projectId: input.projectId,
          projectPath: input.projectPath,
          model: input.model,
        },
        create: {
          id: threadId,
          projectId: input.projectId,
          projectPath: input.projectPath,
          model: input.model,
        },
      })

      await tx.task.update({
        where: {
          id: taskId,
        },
        data: {
          threadId,
        },
      })
    })
  } catch (error) {
    throw new TaskRepositoryError(
      "STORE_WRITE_ERROR",
      `Failed to attach task thread: ${String(error)}`,
    )
  }
}

export async function hasActiveTaskInThread(args: {
  threadId: string
  excludeTaskId?: string
}) {
  const threadId = args.threadId.trim()
  if (!threadId) {
    return false
  }

  try {
    const activeTask = await getPrismaClient().task.findFirst({
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
    throw new TaskRepositoryError(
      "STORE_READ_ERROR",
      `Failed to read thread activity: ${String(error)}`,
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
  failureCode?: string | null
}): Promise<CodexTask> {
  const taskId = input.taskId.trim()
  if (!taskId) {
    throw new TaskRepositoryError("INVALID_TASK_ID", "Task id cannot be empty.")
  }

  try {
    return await getPrismaClient().$transaction(async (tx) => {
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
            include: {
              events: {
                where: {
                  type: PrismaTaskEventType.summary,
                },
                orderBy: {
                  sequence: "desc",
                },
                take: 1,
              },
            },
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
      const command =
        input.command === undefined ? undefined : serializeCommand(input.command)

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
          failureCode:
            input.failureCode !== undefined ? input.failureCode : undefined,
          failureMessage: input.error !== undefined ? input.error : undefined,
          cancellationReason:
            input.status === "cancelled" && input.error !== undefined
              ? input.error
              : undefined,
        },
      })

      let sequence = await nextTaskEventSequence({
        runId: run.id,
        tx,
      })

      if (run.status !== nextStatus) {
        await tx.taskEvent.create({
          data: {
            runId: run.id,
            sequence,
            type: PrismaTaskEventType.state,
            payload: JSON.stringify({
              from: run.status,
              to: nextStatus,
            }),
          },
        })

        sequence += 1
      }

      if (input.stdout !== undefined || input.stderr !== undefined) {
        if (run.events[0]) {
          await tx.taskEvent.update({
            where: {
              id: run.events[0].id,
            },
            data: {
              payload: JSON.stringify({
                stdout: input.stdout ?? "",
                stderr: input.stderr ?? "",
              }),
            },
          })
        } else {
          await tx.taskEvent.create({
            data: {
              runId: run.id,
              sequence,
              type: PrismaTaskEventType.summary,
              payload: JSON.stringify({
                stdout: input.stdout ?? "",
                stderr: input.stderr ?? "",
              }),
            },
          })
        }
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
    const latestRun = await getPrismaClient().taskRun.findFirst({
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

    const events = await getPrismaClient().taskEvent.findMany({
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
      type: event.type,
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

export async function appendTaskEvent(args: {
  taskId: string
  type: TaskEventType
  payload: string
}) {
  const taskId = args.taskId.trim()
  if (!taskId) {
    throw new TaskRepositoryError("INVALID_TASK_ID", "Task id cannot be empty.")
  }

  try {
    await getPrismaClient().$transaction(async (tx) => {
      const latestRun = await tx.taskRun.findFirst({
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

      const sequence = await nextTaskEventSequence({
        runId: latestRun.id,
        tx,
      })

      await tx.taskEvent.create({
        data: {
          runId: latestRun.id,
          sequence,
          type: toPrismaTaskEventType(args.type),
          payload: args.payload,
        },
      })
    })
  } catch (error) {
    if (error instanceof TaskRepositoryError) {
      throw error
    }

    throw new TaskRepositoryError(
      "STORE_WRITE_ERROR",
      `Failed to append task event: ${String(error)}`,
    )
  }
}

export async function appendTaskMessage(args: {
  threadId: string
  taskId: string
  role: TaskMessageRole
  content: string
  source: string
  externalId?: string | null
  createdAt?: string | null
}): Promise<TaskConversationMessage> {
  const threadId = args.threadId.trim()
  const taskId = args.taskId.trim()
  const content = args.content.trim()

  if (!threadId || !taskId || !content) {
    throw new TaskRepositoryError(
      "STORE_WRITE_ERROR",
      "threadId, taskId and content are required.",
    )
  }

  try {
    const message = await getPrismaClient().$transaction(async (tx) => {
      if (args.externalId) {
        const existing = await tx.taskMessage.findUnique({
          where: {
            threadId_externalId: {
              threadId,
              externalId: args.externalId,
            },
          },
        })

        if (existing) {
          return existing
        }
      }

      const sequence = await nextThreadMessageSequence({
        threadId,
        tx,
      })

      return tx.taskMessage.create({
        data: {
          threadId,
          taskId,
          role: toPrismaTaskMessageRole(args.role),
          content,
          sequence,
          source: args.source,
          externalId: args.externalId ?? null,
          createdAt: toDate(args.createdAt) ?? undefined,
        },
      })
    })

    return {
      id: message.id,
      taskId: message.taskId,
      role: message.role,
      content: message.content,
      timestamp: message.createdAt.toISOString(),
      source: message.source,
    }
  } catch (error) {
    if (error instanceof TaskRepositoryError) {
      throw error
    }

    throw new TaskRepositoryError(
      "STORE_WRITE_ERROR",
      `Failed to append task message: ${String(error)}`,
    )
  }
}

export async function readTaskConversationFromDb(args: {
  taskId: string
  limit?: number
}): Promise<TaskConversation> {
  const taskId = args.taskId.trim()
  if (!taskId) {
    throw new TaskRepositoryError("INVALID_TASK_ID", "Task id cannot be empty.")
  }

  try {
    const task = await getPrismaClient().task.findUnique({
      where: {
        id: taskId,
      },
      select: {
        threadId: true,
      },
    })

    if (!task) {
      throw new TaskRepositoryError("NOT_FOUND", `Task not found: ${taskId}`)
    }

    if (!task.threadId) {
      return {
        taskId,
        threadId: null,
        rolloutPath: null,
        messages: [],
        truncated: false,
      }
    }

    const normalizedLimit =
      typeof args.limit === "number" && Number.isFinite(args.limit)
        ? Math.max(1, Math.trunc(args.limit))
        : 200

    const total = await getPrismaClient().taskMessage.count({
      where: {
        threadId: task.threadId,
      },
    })

    const messages = await getPrismaClient().taskMessage.findMany({
      where: {
        threadId: task.threadId,
      },
      orderBy: {
        sequence: "desc",
      },
      take: normalizedLimit,
    })

    return {
      taskId,
      threadId: task.threadId,
      rolloutPath: null,
      messages: messages
        .reverse()
        .map((message) => ({
          id: message.id,
          taskId: message.taskId,
          role: message.role,
          content: message.content,
          timestamp: message.createdAt.toISOString(),
          source: message.source,
        })),
      truncated: total > normalizedLimit,
    }
  } catch (error) {
    if (error instanceof TaskRepositoryError) {
      throw error
    }

    throw new TaskRepositoryError(
      "STORE_READ_ERROR",
      `Failed to read task conversation: ${String(error)}`,
    )
  }
}
