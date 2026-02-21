import { randomUUID } from "node:crypto"
import path from "node:path"

import { readJsonFile, withFileLock, writeJsonFileAtomic } from "@/lib/json-store"
import type {
  CodexTask,
  TaskErrorCode,
  TaskStatus,
  TaskStoreDocument,
} from "@/services/tasks/types"
import { getAppConfig } from "@/utils/yaml-config"

const STORE_VERSION = 1

function nowIsoString() {
  return new Date().toISOString()
}

function createDefaultDocument(): TaskStoreDocument {
  return {
    version: STORE_VERSION,
    updatedAt: nowIsoString(),
    tasks: [],
  }
}

function resolveTaskDataFile() {
  return path.resolve(getAppConfig().task.dataFile)
}

function ensureValidTaskDocument(candidate: TaskStoreDocument): TaskStoreDocument {
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    !Array.isArray(candidate.tasks)
  ) {
    throw new TaskRepositoryError(
      "STORE_READ_ERROR",
      "Task store file has invalid JSON schema."
    )
  }

  return {
    version:
      typeof candidate.version === "number" ? candidate.version : STORE_VERSION,
    updatedAt:
      typeof candidate.updatedAt === "string" ? candidate.updatedAt : nowIsoString(),
    tasks: candidate.tasks
      .filter((item) => typeof item === "object" && item !== null)
      .filter(
        (item) =>
          typeof item.id === "string" &&
          typeof item.workspaceId === "string" &&
          typeof item.workspacePath === "string" &&
          typeof item.prompt === "string" &&
          typeof item.status === "string" &&
          typeof item.createdAt === "string"
      ) as CodexTask[],
  }
}

async function loadTaskDocument(): Promise<TaskStoreDocument> {
  const filePath = resolveTaskDataFile()

  let document: TaskStoreDocument
  try {
    document = await readJsonFile<TaskStoreDocument>({
      filePath,
      fallback: createDefaultDocument(),
    })
  } catch (error) {
    throw new TaskRepositoryError(
      "STORE_READ_ERROR",
      `Failed to read task store: ${String(error)}`
    )
  }

  return ensureValidTaskDocument(document)
}

async function saveTaskDocument(document: TaskStoreDocument) {
  const filePath = resolveTaskDataFile()

  try {
    await writeJsonFileAtomic({
      filePath,
      data: document,
    })
  } catch (error) {
    throw new TaskRepositoryError(
      "STORE_WRITE_ERROR",
      `Failed to write task store: ${String(error)}`
    )
  }
}

function taskComparator(first: CodexTask, second: CodexTask) {
  return second.createdAt.localeCompare(first.createdAt)
}

export class TaskRepositoryError extends Error {
  code: TaskErrorCode

  constructor(code: TaskErrorCode, message: string) {
    super(message)
    this.name = "TaskRepositoryError"
    this.code = code
  }
}

export async function listTasksByWorkspace(args: {
  workspaceId: string
  limit?: number
}): Promise<CodexTask[]> {
  const workspaceId = args.workspaceId.trim()
  if (!workspaceId) {
    return []
  }

  const document = await loadTaskDocument()
  const tasks = document.tasks
    .filter((task) => task.workspaceId === workspaceId)
    .sort(taskComparator)

  if (typeof args.limit === "number" && Number.isFinite(args.limit)) {
    return tasks.slice(0, Math.max(1, Math.trunc(args.limit)))
  }

  return tasks
}

export async function getTaskById(taskId: string): Promise<CodexTask | null> {
  const trimmedTaskId = taskId.trim()
  if (!trimmedTaskId) {
    return null
  }

  const document = await loadTaskDocument()
  return document.tasks.find((task) => task.id === trimmedTaskId) ?? null
}

export async function createTask(input: {
  workspaceId: string
  workspacePath: string
  prompt: string
  model: string | null
}): Promise<CodexTask> {
  const workspaceId = input.workspaceId.trim()
  const prompt = input.prompt.trim()
  if (!workspaceId || !prompt) {
    throw new TaskRepositoryError(
      "STORE_WRITE_ERROR",
      "workspaceId and prompt are required."
    )
  }

  const filePath = resolveTaskDataFile()

  return withFileLock(filePath, async () => {
    const document = await loadTaskDocument()

    const task: CodexTask = {
      id: randomUUID(),
      workspaceId,
      workspacePath: input.workspacePath,
      prompt,
      model: input.model,
      status: "queued",
      createdAt: nowIsoString(),
      startedAt: null,
      finishedAt: null,
      exitCode: null,
      command: [],
      stdout: "",
      stderr: "",
      error: null,
    }

    const nextDocument: TaskStoreDocument = {
      ...document,
      updatedAt: nowIsoString(),
      tasks: [task, ...document.tasks],
    }

    await saveTaskDocument(nextDocument)
    return task
  })
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

  const filePath = resolveTaskDataFile()

  return withFileLock(filePath, async () => {
    const document = await loadTaskDocument()
    const targetIndex = document.tasks.findIndex((task) => task.id === taskId)
    if (targetIndex < 0) {
      throw new TaskRepositoryError("NOT_FOUND", `Task not found: ${taskId}`)
    }

    const previous = document.tasks[targetIndex]
    const nextTask: CodexTask = {
      ...previous,
      status: input.status,
      startedAt:
        input.startedAt !== undefined ? input.startedAt : previous.startedAt,
      finishedAt:
        input.finishedAt !== undefined ? input.finishedAt : previous.finishedAt,
      exitCode: input.exitCode !== undefined ? input.exitCode : previous.exitCode,
      command: input.command !== undefined ? input.command : previous.command,
      stdout: input.stdout !== undefined ? input.stdout : previous.stdout,
      stderr: input.stderr !== undefined ? input.stderr : previous.stderr,
      error: input.error !== undefined ? input.error : previous.error,
    }

    const nextTasks = [...document.tasks]
    nextTasks[targetIndex] = nextTask

    const nextDocument: TaskStoreDocument = {
      ...document,
      updatedAt: nowIsoString(),
      tasks: nextTasks,
    }

    await saveTaskDocument(nextDocument)
    return nextTask
  })
}
