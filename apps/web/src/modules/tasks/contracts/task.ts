import { z } from "zod"

export const TASK_STATUS_VALUES = [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const

export const TASK_TIMELINE_KIND_VALUES = [
  "message",
  "status",
  "stdout",
  "stderr",
  "summary",
  "error",
  "system",
] as const

export const TASK_TIME_RANGE_VALUES = ["24h", "7d", "30d"] as const

export const taskStatusSchema = z.enum(TASK_STATUS_VALUES)
export const taskTimelineKindSchema = z.enum(TASK_TIMELINE_KIND_VALUES)
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
  threadId: z.string().nullable().default(null),
  parentTaskId: z.string().nullable().default(null),
  createdAt: z.string().min(1),
  startedAt: z.string().nullable().default(null),
  finishedAt: z.string().nullable().default(null),
  exitCode: z.number().int().nullable().default(null),
  command: z.array(z.string()).default([]),
  stdout: z.string().default(""),
  stderr: z.string().default(""),
  error: z.string().nullable().default(null),
})

export const taskDetailSchema = taskListItemSchema

export const taskTimelineItemSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  kind: taskTimelineKindSchema,
  role: z.enum(["user", "assistant", "system"]).nullable().default(null),
  status: taskStatusSchema.nullable().default(null),
  source: z.string().nullable().default(null),
  content: z.string().nullable().default(null),
  payload: z.string().nullable().default(null),
  createdAt: z.string().min(1),
})

export const taskTimelineSchema = z.object({
  taskId: z.string().min(1),
  items: z.array(taskTimelineItemSchema).default([]),
  nextSequence: z.number().int().nonnegative(),
})

export type TaskStatus = z.infer<typeof taskStatusSchema>
export type TaskTimelineKind = z.infer<typeof taskTimelineKindSchema>
export type TaskTimeRange = z.infer<typeof taskTimeRangeSchema>
export type TaskFilter = z.infer<typeof taskFilterSchema>
export type TaskListItem = z.infer<typeof taskListItemSchema>
export type TaskDetail = z.infer<typeof taskDetailSchema>
export type TaskTimelineItem = z.infer<typeof taskTimelineItemSchema>
export type TaskTimeline = z.infer<typeof taskTimelineSchema>

export const TERMINAL_TASK_STATUSES: TaskStatus[] = [
  "completed",
  "failed",
  "cancelled",
]
