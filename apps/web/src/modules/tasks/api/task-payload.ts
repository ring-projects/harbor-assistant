import {
  asRecord,
  pickString,
  toIsoDateString,
  toOptionalIsoDateString,
  toStringOrEmpty,
  toStringOrNull,
} from "@/lib/protocol"
import {
  type TaskAgentEvent,
  type TaskAgentEventStream,
  TASK_EXECUTION_MODE_VALUES,
  TASK_EFFORT_VALUES,
  TASK_STATUS_VALUES,
  type TaskDetail,
  type TaskEffort,
  type TaskExecutionMode,
  type TaskListItem,
  type TaskStatus,
  taskAgentEventSchema,
  taskAgentEventStreamSchema,
  taskDetailSchema,
  taskListItemSchema,
} from "@/modules/tasks/contracts"

const STATUS_SET = new Set<TaskStatus>(TASK_STATUS_VALUES)
const EXECUTION_MODE_SET = new Set<TaskExecutionMode>(TASK_EXECUTION_MODE_VALUES)
const EFFORT_SET = new Set<TaskEffort>(TASK_EFFORT_VALUES)

export function toTaskStatus(value: unknown): TaskStatus | null {
  if (typeof value !== "string") {
    return null
  }

  return STATUS_SET.has(value as TaskStatus) ? (value as TaskStatus) : null
}

function toExecutionMode(value: unknown): TaskExecutionMode | null {
  if (typeof value !== "string") {
    return null
  }

  return EXECUTION_MODE_SET.has(value as TaskExecutionMode)
    ? (value as TaskExecutionMode)
    : null
}

function toTaskEffort(value: unknown): TaskEffort | null {
  if (typeof value !== "string") {
    return null
  }

  return EFFORT_SET.has(value as TaskEffort) ? (value as TaskEffort) : null
}

export function normalizeTaskCandidate(candidate: unknown): TaskListItem | null {
  const source = asRecord(candidate)
  if (!source) {
    return null
  }

  const taskId = pickString(source, "taskId", "id", "task_id")
  const projectId = pickString(source, "projectId", "project_id")
  const orchestrationId = pickString(
    source,
    "orchestrationId",
    "orchestration_id",
  )
  const status = toTaskStatus(source.status)

  if (!taskId || !projectId || !orchestrationId || !status) {
    return null
  }

  const parsed = taskListItemSchema.safeParse({
    taskId,
    projectId,
    orchestrationId,
    prompt: toStringOrEmpty(source.prompt),
    title: toStringOrEmpty(source.title),
    titleSource:
      source.titleSource === "agent" || source.titleSource === "user"
        ? source.titleSource
        : "prompt",
    model: toStringOrNull(source.model),
    executor: toStringOrNull(source.executor),
    executionMode: toExecutionMode(source.executionMode),
    effort: toTaskEffort(source.effort),
    status,
    archivedAt: toOptionalIsoDateString(source.archivedAt),
    createdAt: toIsoDateString(source.createdAt),
    startedAt: toOptionalIsoDateString(source.startedAt),
    finishedAt: toOptionalIsoDateString(source.finishedAt),
  })

  return parsed.success ? parsed.data : null
}

export function extractTaskArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload
  }

  const record = asRecord(payload)
  if (!record) {
    return []
  }

  for (const candidate of [record.tasks, record.items, record.data]) {
    if (Array.isArray(candidate)) {
      return candidate
    }
  }

  const task = asRecord(record.task)
  return task ? [task] : []
}

export function extractTaskList(payload: unknown): TaskListItem[] {
  return extractTaskArray(payload)
    .map((item) => normalizeTaskCandidate(item))
    .filter((item): item is TaskListItem => item !== null)
}

export function extractSingleTask(payload: unknown): TaskDetail | null {
  const task = normalizeTaskCandidate(extractTaskArray(payload)[0])
  if (!task) {
    return null
  }

  const parsed = taskDetailSchema.safeParse(task)
  return parsed.success ? parsed.data : null
}

export function normalizeTaskEvent(
  taskId: string,
  candidate: unknown,
): TaskAgentEvent | null {
  const source = asRecord(candidate)
  if (!source) {
    return null
  }

  const id = toStringOrNull(source.id)
  const eventType = toStringOrNull(source.eventType)
  const payload = asRecord(source.payload)
  const sequence =
    typeof source.sequence === "number" && Number.isInteger(source.sequence)
      ? source.sequence
      : null

  if (!id || !eventType || !payload || sequence === null) {
    return null
  }

  const parsed = taskAgentEventSchema.safeParse({
    id,
    taskId,
    sequence,
    eventType,
    payload,
    createdAt: toIsoDateString(source.createdAt),
  })

  return parsed.success ? parsed.data : null
}

export function extractTaskEvents(
  payload: unknown,
  options?: { fallbackTaskId?: string },
): TaskAgentEventStream | null {
  const source = asRecord(payload)
  if (!source) {
    return null
  }

  const root = asRecord(source.events) ?? source
  const taskId =
    pickString(root, "taskId") ??
    pickString(source, "taskId", "task_id") ??
    options?.fallbackTaskId ??
    null

  if (!taskId) {
    return null
  }

  const items = Array.isArray(root.items)
    ? root.items
        .map((event) => normalizeTaskEvent(taskId, event))
        .filter((event): event is TaskAgentEvent => event !== null)
    : []

  const parsed = taskAgentEventStreamSchema.safeParse({
    taskId,
    items,
    nextSequence:
      typeof root.nextSequence === "number" && Number.isInteger(root.nextSequence)
        ? root.nextSequence
        : items.at(-1)?.sequence ?? 0,
  })

  return parsed.success ? parsed.data : null
}
