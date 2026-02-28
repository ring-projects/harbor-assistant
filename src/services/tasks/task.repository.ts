import { randomUUID } from "node:crypto"
import path from "node:path"

import {
  readJsonFile,
  withFileLock,
  writeJsonFileAtomic,
} from "@/lib/json-store"
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

function ensureValidTaskDocument(
  candidate: TaskStoreDocument,
): TaskStoreDocument {
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    !Array.isArray(candidate.tasks)
  ) {
    throw new TaskRepositoryError(
      "STORE_READ_ERROR",
      "Task store file has invalid JSON schema.",
    )
  }

  const normalizedTasks: CodexTask[] = []
  for (const item of candidate.tasks) {
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
    const status = typeof record.status === "string" ? record.status : null
    const createdAt =
      typeof record.createdAt === "string" ? record.createdAt : null

    if (!id || !projectId || !projectPath || !prompt || !status || !createdAt) {
      continue
    }

    normalizedTasks.push({
      id,
      projectId,
      projectPath,
      prompt,
      model: typeof record.model === "string" ? record.model : null,
      status: status as CodexTask["status"],
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
      typeof candidate.version === "number" ? candidate.version : STORE_VERSION,
    updatedAt:
      typeof candidate.updatedAt === "string"
        ? candidate.updatedAt
        : nowIsoString(),
    tasks: normalizedTasks,
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
      `Failed to read task store: ${String(error)}`,
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
      `Failed to write task store: ${String(error)}`,
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

export async function listTasksByProject(args: {
  projectId: string
  limit?: number
}): Promise<CodexTask[]> {
  const projectId = args.projectId.trim()
  if (!projectId) {
    return []
  }

  const document = await loadTaskDocument()
  const tasks = document.tasks
    .filter((task) => task.projectId === projectId)
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

  const filePath = resolveTaskDataFile()

  return withFileLock(filePath, async () => {
    const document = await loadTaskDocument()

    const task: CodexTask = {
      id: randomUUID(),
      projectId,
      projectPath: input.projectPath,
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
      exitCode:
        input.exitCode !== undefined ? input.exitCode : previous.exitCode,
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
