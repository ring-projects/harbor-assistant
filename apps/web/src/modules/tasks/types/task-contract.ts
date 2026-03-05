import { z } from "zod"

export const TASK_STATUS_VALUES = [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const

export const TASK_EVENT_TYPE_VALUES = [
  "state",
  "stdout",
  "stderr",
  "system",
  "summary",
] as const

export const TASK_TIME_RANGE_VALUES = ["24h", "7d", "30d"] as const

export const taskStatusSchema = z.enum(TASK_STATUS_VALUES)
export const taskEventTypeSchema = z.enum(TASK_EVENT_TYPE_VALUES)
export const taskTimeRangeSchema = z.enum(TASK_TIME_RANGE_VALUES)

export const taskFilterSchema = z.object({
  statuses: z.array(taskStatusSchema),
  timeRange: taskTimeRangeSchema,
  keyword: z.string().default(""),
})

export const taskListItemSchema = z.object({
  taskId: z.string().min(1),
  projectId: z.string().min(1),
  prompt: z.string().default(""),
  model: z.string().nullable().default(null),
  executor: z.string().default("codex"),
  status: taskStatusSchema,
  createdAt: z.string().min(1),
  startedAt: z.string().nullable().default(null),
  finishedAt: z.string().nullable().default(null),
  command: z.array(z.string()).default([]),
  stdout: z.string().default(""),
  stderr: z.string().default(""),
  error: z.string().nullable().default(null),
  retrySourceTaskId: z.string().nullable().default(null),
})

export const taskDetailSchema = taskListItemSchema

export const taskEventSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  runId: z.string().default(""),
  sequence: z.number().int().nonnegative(),
  type: taskEventTypeSchema,
  payload: z.string().default(""),
  createdAt: z.string().min(1),
})

export type TaskStatus = z.infer<typeof taskStatusSchema>
export type TaskEventType = z.infer<typeof taskEventTypeSchema>
export type TaskTimeRange = z.infer<typeof taskTimeRangeSchema>
export type TaskFilter = z.infer<typeof taskFilterSchema>
export type TaskListItem = z.infer<typeof taskListItemSchema>
export type TaskDetail = z.infer<typeof taskDetailSchema>
export type TaskEvent = z.infer<typeof taskEventSchema>

export const TERMINAL_TASK_STATUSES: TaskStatus[] = [
  "completed",
  "failed",
  "cancelled",
]
