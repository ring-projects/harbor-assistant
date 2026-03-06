import { z } from "zod"

import { ERROR_CODES } from "@/constants"
import {
  TASK_STATUS_VALUES,
  type TaskConversation,
  type TaskConversationMessage,
  type TaskDetail,
  type TaskEvent,
  type TaskFilter,
  type TaskListItem,
  type TaskStatus,
  type TaskTimeRange,
  taskConversationMessageSchema,
  taskConversationSchema,
  taskDetailSchema,
  taskEventSchema,
  taskListItemSchema,
} from "@/modules/tasks/types/task-contract"

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

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return 0
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
    toStringOrNull(source.workspaceId) ??
    toStringOrNull(source.workspace_id)

  const status =
    toStatus(source.status) ??
    toStatus(source.taskStatus) ??
    toStatus(source.task_status)

  if (!taskId || !projectId || !status) {
    return null
  }

  const parsed = taskListItemSchema.safeParse({
    taskId,
    projectId,
    prompt: toStringOrEmpty(source.prompt),
    model:
      toStringOrNull(source.model) ?? toStringOrNull(source.modelName) ?? null,
    executor: toStringOrNull(source.executor) ?? "codex",
    status,
    createdAt:
      toStringOrNull(source.createdAt) ??
      toStringOrNull(source.created_at) ??
      new Date().toISOString(),
    startedAt: toOptionalDateString(source.startedAt ?? source.started_at),
    finishedAt: toOptionalDateString(source.finishedAt ?? source.finished_at),
    exitCode: toIntegerOrNull(source.exitCode ?? source.exit_code),
    command: toCommand(source.command),
    stdout: toStringOrEmpty(source.stdout),
    stderr: toStringOrEmpty(source.stderr),
    error:
      toStringOrNull(source.error) ??
      toStringOrNull(source.failureMessage) ??
      toStringOrNull(source.failure_message) ??
      null,
    retrySourceTaskId:
      toStringOrNull(source.retrySourceTaskId) ??
      toStringOrNull(source.retry_source_task_id) ??
      toStringOrNull(source.parentTaskId) ??
      null,
  })

  if (!parsed.success) {
    return null
  }

  return parsed.data
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
  const items = extractTaskArray(payload)
  const first = items[0]
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

function normalizeTaskEventCandidate(
  candidate: unknown,
  fallbackTaskId: string,
): TaskEvent | null {
  const source = asRecord(candidate)
  if (!source) {
    return null
  }

  const id =
    toStringOrNull(source.id) ??
    toStringOrNull(source.eventId) ??
    `${fallbackTaskId}-${String(source.sequence ?? "0")}`
  const type = toStringOrNull(source.type)
  const sequence = toNumber(source.sequence)

  if (!type) {
    return null
  }

  const payload =
    typeof source.payload === "string"
      ? source.payload
      : source.payload === null || source.payload === undefined
        ? ""
        : JSON.stringify(source.payload)

  const parsed = taskEventSchema.safeParse({
    id,
    taskId:
      toStringOrNull(source.taskId) ??
      toStringOrNull(source.task_id) ??
      fallbackTaskId,
    runId: toStringOrEmpty(source.runId ?? source.run_id),
    sequence,
    type,
    payload,
    createdAt: toDateString(source.createdAt ?? source.created_at),
  })

  return parsed.success ? parsed.data : null
}

function extractTaskEvents(payload: unknown, taskId: string): TaskEvent[] {
  const rows = extractTaskArray(payload)
  const events = rows
    .map((item) => normalizeTaskEventCandidate(item, taskId))
    .filter((item): item is TaskEvent => item !== null)

  return events.sort((left, right) => left.sequence - right.sequence)
}

function normalizeConversationMessageCandidate(
  candidate: unknown,
  fallbackTaskId: string,
): TaskConversationMessage | null {
  const source = asRecord(candidate)
  if (!source) {
    return null
  }

  const parsed = taskConversationMessageSchema.safeParse({
    id:
      toStringOrNull(source.id) ??
      `${fallbackTaskId}-${toStringOrNull(source.timestamp) ?? "message"}`,
    role: toStringOrNull(source.role) ?? "assistant",
    content: toStringOrEmpty(source.content),
    timestamp: toOptionalDateString(source.timestamp),
  })

  return parsed.success ? parsed.data : null
}

function extractSingleConversation(payload: unknown): TaskConversation | null {
  const source = asRecord(payload)
  if (!source) {
    return null
  }

  const root =
    source.conversation && typeof source.conversation === "object"
      ? asRecord(source.conversation)
      : source

  if (!root) {
    return null
  }

  const taskId =
    toStringOrNull(root.taskId) ??
    toStringOrNull(root.task_id) ??
    toStringOrNull(source.taskId) ??
    null
  if (!taskId) {
    return null
  }

  const messagesRaw = Array.isArray(root.messages) ? root.messages : []
  const messages = messagesRaw
    .map((item) => normalizeConversationMessageCandidate(item, taskId))
    .filter((item): item is TaskConversationMessage => item !== null)

  const parsed = taskConversationSchema.safeParse({
    taskId,
    threadId: toStringOrNull(root.threadId ?? root.thread_id),
    rolloutPath: toStringOrNull(root.rolloutPath ?? root.rollout_path),
    messages,
    truncated: root.truncated === true,
  })

  return parsed.success ? parsed.data : null
}

function computeRangeStart(range: TaskTimeRange) {
  const now = Date.now()

  if (range === "24h") {
    return new Date(now - 24 * 60 * 60 * 1000).toISOString()
  }

  if (range === "7d") {
    return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  }

  return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
}

function buildTaskListQuery(filter: Pick<TaskFilter, "timeRange" | "keyword">) {
  const searchParams = new URLSearchParams()
  searchParams.set("from", computeRangeStart(filter.timeRange))
  const keyword = filter.keyword.trim()
  if (keyword) {
    searchParams.set("q", keyword)
  }

  return searchParams.toString()
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
  filter: Pick<TaskFilter, "timeRange" | "keyword">
}): Promise<TaskListResult> {
  const query = buildTaskListQuery(args.filter)
  const suffix = query ? `?${query}` : ""
  const response = await fetch(
    `${EXECUTOR_API_BASE}/projects/${encodeURIComponent(args.projectId)}/tasks${suffix}`,
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

  const nextCursor =
    toStringOrNull(payload?.nextCursor) ?? toStringOrNull(payload?.cursor) ?? null

  return {
    tasks,
    nextCursor,
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
  limit?: number
}): Promise<TaskEvent[]> {
  const searchParams = new URLSearchParams()
  searchParams.set("limit", String(args.limit ?? 300))

  const response = await fetch(
    `${EXECUTOR_API_BASE}/tasks/${encodeURIComponent(args.taskId)}/events?${searchParams.toString()}`,
    {
      method: "GET",
      headers: {
        accept: "application/json",
      },
      cache: "no-store",
    },
  )

  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("text/event-stream")) {
    return []
  }

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to load task events.")

  return extractTaskEvents(payload, args.taskId)
}

export async function readTaskConversation(args: {
  taskId: string
  limit?: number
}): Promise<TaskConversation> {
  const searchParams = new URLSearchParams()
  if (typeof args.limit === "number" && Number.isFinite(args.limit)) {
    searchParams.set("limit", String(Math.max(1, Math.trunc(args.limit))))
  }

  const suffix = searchParams.toString()
  const response = await fetch(
    `${EXECUTOR_API_BASE}/tasks/${encodeURIComponent(args.taskId)}/conversation${suffix ? `?${suffix}` : ""}`,
    {
      method: "GET",
      cache: "no-store",
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to load task conversation.")

  const conversation = extractSingleConversation(payload)
  if (!conversation) {
    throw new TaskApiClientError("Task conversation payload is invalid.", {
      code: ERROR_CODES.INTERNAL_ERROR,
      status: response.status,
    })
  }

  return conversation
}

export async function cancelTask(taskId: string): Promise<TaskDetail | null> {
  const response = await fetch(
    `${EXECUTOR_API_BASE}/tasks/${encodeURIComponent(taskId)}/cancel`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to cancel task.")

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

export function parseTaskEventFromSSE(args: {
  data: string
  taskId: string
}): TaskEvent | null {
  const text = args.data.trim()
  if (!text) {
    return null
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }

  if (Array.isArray(parsed)) {
    const first = parsed[0]
    return first ? normalizeTaskEventCandidate(first, args.taskId) : null
  }

  const record = asRecord(parsed)
  if (!record) {
    return null
  }

  if (record.event && typeof record.event === "object") {
    return normalizeTaskEventCandidate(record.event, args.taskId)
  }

  return normalizeTaskEventCandidate(record, args.taskId)
}
