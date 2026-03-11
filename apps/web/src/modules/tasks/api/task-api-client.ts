import { z } from "zod"

import { ERROR_CODES } from "@/constants"
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

const EXECUTOR_API_BASE = "/api/v1"

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
  model?: string
}

export type FollowupTaskInput = {
  prompt: string
  model?: string
}

export type CreateTaskResult = {
  taskId: string
  task?: TaskDetail
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

function toIntegerOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null
  }

  if (typeof value === "number" && Number.isInteger(value)) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isInteger(parsed)) {
      return parsed
    }
  }

  return null
}

function toStatus(value: unknown): TaskStatus | null {
  if (typeof value !== "string") {
    return null
  }

  return STATUS_SET.has(value as TaskStatus) ? (value as TaskStatus) : null
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

function toCommand(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === "string")
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
    model: toStringOrNull(source.model),
    executor: toStringOrNull(source.executor) ?? "codex",
    status,
    threadId: toStringOrNull(source.threadId),
    parentTaskId: toStringOrNull(source.parentTaskId),
    createdAt: toDateString(source.createdAt),
    startedAt: toOptionalDateString(source.startedAt),
    finishedAt: toOptionalDateString(source.finishedAt),
    exitCode: toIntegerOrNull(source.exitCode),
    command: toCommand(source.command),
    stdout: toStringOrEmpty(source.stdout),
    stderr: toStringOrEmpty(source.stderr),
    error: toStringOrNull(source.error),
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
  const response = await fetch(`${EXECUTOR_API_BASE}/tasks`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      projectId,
      prompt: input.prompt,
      model: input.model,
      executor: "codex",
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
}): Promise<TaskListResult> {
  const response = await fetch(
    `${EXECUTOR_API_BASE}/projects/${encodeURIComponent(args.projectId)}/tasks`,
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
    `${EXECUTOR_API_BASE}/tasks/${encodeURIComponent(taskId)}`,
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
    `${EXECUTOR_API_BASE}/tasks/${encodeURIComponent(args.taskId)}/events${query ? `?${query}` : ""}`,
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

export async function breakTaskTurn(taskId: string): Promise<TaskDetail | null> {
  const response = await fetch(
    `${EXECUTOR_API_BASE}/tasks/${encodeURIComponent(taskId)}/break`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to break current turn.")

  return extractSingleTask(payload)
}

export async function retryTask(taskId: string): Promise<CreateTaskResult> {
  const response = await fetch(
    `${EXECUTOR_API_BASE}/tasks/${encodeURIComponent(taskId)}/retry`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to retry task.")

  const task = extractSingleTask(payload)
  const nextTaskId =
    toStringOrNull(payload?.newTaskId) ??
    toStringOrNull(payload?.taskId) ??
    toStringOrNull(payload?.id) ??
    task?.taskId ??
    null

  if (!nextTaskId) {
    throw new TaskApiClientError("Retry succeeded but taskId is missing.", {
      code: ERROR_CODES.TASK_RETRY_FAILED,
      status: response.status,
    })
  }

  return {
    taskId: nextTaskId,
    task: task ?? undefined,
  }
}

export async function followupTask(
  taskId: string,
  input: FollowupTaskInput,
): Promise<CreateTaskResult> {
  const response = await fetch(
    `${EXECUTOR_API_BASE}/tasks/${encodeURIComponent(taskId)}/followup`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        prompt: input.prompt,
        model: input.model,
      }),
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to follow up task.")

  const task = extractSingleTask(payload)
  const nextTaskId =
    toStringOrNull(payload?.newTaskId) ??
    toStringOrNull(payload?.taskId) ??
    toStringOrNull(payload?.id) ??
    task?.taskId ??
    null

  if (!nextTaskId) {
    throw new TaskApiClientError("Follow-up succeeded but taskId is missing.", {
      code: ERROR_CODES.TASK_FOLLOWUP_FAILED,
      status: response.status,
    })
  }

  return {
    taskId: nextTaskId,
    task: task ?? undefined,
  }
}
