import { z } from "zod"

import { ERROR_CODES } from "@/constants"
import { buildExecutorApiUrl } from "@/lib/executor-service-url"
import {
  type TaskAgentEventStream,
  TASK_STATUS_VALUES,
  type TaskDetail,
  type TaskListItem,
  type TaskStatus,
  taskAgentEventStreamSchema,
  taskDetailSchema,
  taskListItemSchema,
} from "@/modules/tasks/contracts"

const taskApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
})

type TaskApiError = z.infer<typeof taskApiErrorSchema>

type TaskEnvelopePayload = {
  ok?: boolean
  error?: TaskApiError
} & Record<string, unknown>

const STATUS_SET = new Set<TaskStatus>(TASK_STATUS_VALUES)

export class TaskApiClientError extends Error {
  code: string
  status: number

  constructor(message: string, options?: { code?: string; status?: number }) {
    super(message)
    this.name = "TaskApiClientError"
    this.code = options?.code ?? ERROR_CODES.INTERNAL_ERROR
    this.status = options?.status ?? 500
  }
}

export type CreateTaskInput = {
  prompt: string
  title?: string
  model?: string
  executor?: string
  executionMode?: "safe" | "connected" | "full-access"
}

export type CreateTaskResult = {
  taskId: string
  task?: TaskDetail
}

export type DeleteTaskResult = {
  taskId: string
  projectId: string
}

export type TaskListResult = {
  tasks: TaskListItem[]
  nextCursor: string | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) {
    return null
  }

  return value as Record<string, unknown>
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function toStringOrEmpty(value: unknown) {
  return typeof value === "string" ? value : ""
}

function toStatus(value: unknown): TaskStatus | null {
  if (typeof value !== "string") {
    return null
  }

  return STATUS_SET.has(value as TaskStatus) ? (value as TaskStatus) : null
}

function toExecutionMode(
  value: unknown,
): "safe" | "connected" | "full-access" | null {
  return value === "safe" ||
    value === "connected" ||
    value === "full-access"
    ? value
    : null
}

function toDateString(value: unknown) {
  if (typeof value !== "string") {
    return new Date().toISOString()
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString()
  }

  return parsed.toISOString()
}

function toOptionalDateString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null
  }

  return toDateString(value)
}

function normalizeTaskCandidate(candidate: unknown): TaskListItem | null {
  const source = asRecord(candidate)
  if (!source) {
    return null
  }

  const taskId =
    toStringOrNull(source.taskId) ??
    toStringOrNull(source.id) ??
    toStringOrNull(source.task_id)
  const projectId =
    toStringOrNull(source.projectId) ??
    toStringOrNull(source.project_id) ??
    null
  const status = toStatus(source.status)

  if (!taskId || !projectId || !status) {
    return null
  }
  const parsed = taskListItemSchema.safeParse({
    taskId,
    projectId,
    prompt: toStringOrEmpty(source.prompt),
    title: toStringOrEmpty(source.title),
    titleSource:
      source.titleSource === "agent" || source.titleSource === "user"
        ? source.titleSource
        : "prompt",
    model: toStringOrNull(source.model),
    executor: toStringOrNull(source.executor),
    executionMode: toExecutionMode(source.executionMode),
    status,
    archivedAt: toOptionalDateString(source.archivedAt),
    createdAt: toDateString(source.createdAt),
    startedAt: toOptionalDateString(source.startedAt),
    finishedAt: toOptionalDateString(source.finishedAt),
  })

  return parsed.success ? parsed.data : null
}

function extractTaskArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload
  }

  const record = asRecord(payload)
  if (!record) {
    return []
  }

  const options = [record.tasks, record.items, record.data]
  for (const candidate of options) {
    if (Array.isArray(candidate)) {
      return candidate
    }
  }

  if (record.task && typeof record.task === "object") {
    return [record.task]
  }

  return []
}

function extractSingleTask(payload: unknown): TaskDetail | null {
  const first = extractTaskArray(payload)[0]
  if (!first) {
    return null
  }

  const normalized = normalizeTaskCandidate(first)
  if (!normalized) {
    return null
  }

  const parsed = taskDetailSchema.safeParse(normalized)
  return parsed.success ? parsed.data : null
}

function extractTaskEvents(payload: unknown): TaskAgentEventStream | null {
  const source = asRecord(payload)
  if (!source) {
    return null
  }

  const root =
    source.events && typeof source.events === "object"
      ? asRecord(source.events)
      : source
  if (!root) {
    return null
  }

  const parsed = taskAgentEventStreamSchema.safeParse({
    taskId:
      toStringOrNull(root.taskId) ??
      toStringOrNull(source.taskId) ??
      toStringOrNull(source.task_id),
    items: Array.isArray(root.items) ? root.items : [],
    nextSequence:
      typeof root.nextSequence === "number" && Number.isInteger(root.nextSequence)
        ? root.nextSequence
        : 0,
  })

  return parsed.success ? parsed.data : null
}

async function parseJson(response: Response): Promise<TaskEnvelopePayload | null> {
  return (await response.json().catch(() => null)) as TaskEnvelopePayload | null
}

function throwIfFailed(
  response: Response,
  payload: TaskEnvelopePayload | null,
  fallbackMessage: string,
) {
  const parsedError = taskApiErrorSchema.safeParse(payload?.error)

  if (response.ok && payload?.ok !== false) {
    return
  }

  throw new TaskApiClientError(
    parsedError.success ? parsedError.data.message : fallbackMessage,
    {
      status: response.status,
      code: parsedError.success
        ? parsedError.data.code
        : ERROR_CODES.INTERNAL_ERROR,
    },
  )
}

export async function createTask(
  projectId: string,
  input: CreateTaskInput,
): Promise<CreateTaskResult> {
  const response = await fetch(buildExecutorApiUrl("/v1/tasks"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      projectId,
      prompt: input.prompt,
      title: input.title,
      model: input.model,
      executor: input.executor ?? "codex",
      executionMode: input.executionMode,
    }),
  })

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to create task.")

  const task = extractSingleTask(payload)
  const taskId =
    toStringOrNull(payload?.taskId) ??
    toStringOrNull(payload?.id) ??
    task?.taskId ??
    null

  if (!taskId) {
    throw new TaskApiClientError("Task created but taskId is missing.", {
      code: ERROR_CODES.TASK_START_FAILED,
      status: response.status,
    })
  }

  return {
    taskId,
    task: task ?? undefined,
  }
}

export async function readProjectTasks(args: {
  projectId: string
  includeArchived?: boolean
}): Promise<TaskListResult> {
  const searchParams = new URLSearchParams()
  if (args.includeArchived) {
    searchParams.set("includeArchived", "true")
  }

  const response = await fetch(
    buildExecutorApiUrl(
      `/v1/projects/${encodeURIComponent(args.projectId)}/tasks${searchParams.size > 0 ? `?${searchParams.toString()}` : ""}`,
    ),
    {
      method: "GET",
      cache: "no-store",
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to load tasks.")

  const tasks = extractTaskArray(payload)
    .map((item) => normalizeTaskCandidate(item))
    .filter((item): item is TaskListItem => item !== null)

  return {
    tasks,
    nextCursor: null,
  }
}

export async function readTaskDetail(taskId: string): Promise<TaskDetail> {
  const response = await fetch(
    buildExecutorApiUrl(`/v1/tasks/${encodeURIComponent(taskId)}`),
    {
      method: "GET",
      cache: "no-store",
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to load task detail.")

  const task = extractSingleTask(payload)

  if (!task) {
    throw new TaskApiClientError("Task detail payload is invalid.", {
      code: ERROR_CODES.TASK_NOT_FOUND,
      status: response.status,
    })
  }

  return task
}

export async function readTaskEvents(args: {
  taskId: string
  afterSequence?: number
  limit?: number
}): Promise<TaskAgentEventStream> {
  const searchParams = new URLSearchParams()

  if (typeof args.afterSequence === "number" && Number.isFinite(args.afterSequence)) {
    searchParams.set(
      "afterSequence",
      String(Math.max(0, Math.trunc(args.afterSequence))),
    )
  }

  if (typeof args.limit === "number" && Number.isFinite(args.limit)) {
    searchParams.set("limit", String(Math.max(1, Math.trunc(args.limit))))
  }

  const query = searchParams.toString()
  const response = await fetch(
    buildExecutorApiUrl(
      `/v1/tasks/${encodeURIComponent(args.taskId)}/events${query ? `?${query}` : ""}`,
    ),
    {
      method: "GET",
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to load task events.")

  const events = extractTaskEvents(payload)
  if (!events) {
    throw new TaskApiClientError("Task events payload is invalid.", {
      code: ERROR_CODES.INTERNAL_ERROR,
      status: response.status,
    })
  }

  return events
}

export async function archiveTask(taskId: string): Promise<TaskDetail> {
  const response = await fetch(
    buildExecutorApiUrl(`/v1/tasks/${encodeURIComponent(taskId)}/archive`),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to archive task.")

  const task = extractSingleTask(payload)
  if (!task) {
    throw new TaskApiClientError("Archive succeeded but task payload is invalid.", {
      code: ERROR_CODES.TASK_ARCHIVE_FAILED,
      status: response.status,
    })
  }

  return task
}

export async function deleteTask(taskId: string): Promise<DeleteTaskResult> {
  const response = await fetch(
    buildExecutorApiUrl(`/v1/tasks/${encodeURIComponent(taskId)}`),
    {
      method: "DELETE",
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to delete task.")

  const nextTaskId =
    toStringOrNull(payload?.taskId) ??
    toStringOrNull(payload?.id)
  const projectId = toStringOrNull(payload?.projectId)

  if (!nextTaskId || !projectId) {
    throw new TaskApiClientError("Delete succeeded but payload is invalid.", {
      code: ERROR_CODES.TASK_DELETE_FAILED,
      status: response.status,
    })
  }

  return {
    taskId: nextTaskId,
    projectId,
  }
}
