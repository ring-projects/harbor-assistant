import { z } from "zod"

export const TASK_STATUS_VALUES = [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const

export const TASK_AGENT_EVENT_TYPE_VALUES = [
  "session.started",
  "turn.started",
  "message",
  "command.started",
  "command.output",
  "command.completed",
  "web_search.started",
  "web_search.completed",
  "file_change",
  "mcp_tool_call.started",
  "mcp_tool_call.completed",
  "reasoning",
  "todo_list",
  "error",
  "turn.completed",
  "turn.failed",
  "session.completed",
] as const

export const TASK_TIME_RANGE_VALUES = ["24h", "7d", "30d"] as const
export const TASK_EXECUTION_MODE_VALUES = [
  "safe",
  "connected",
  "full-access",
] as const

export const taskStatusSchema = z.enum(TASK_STATUS_VALUES)
export const taskTimeRangeSchema = z.enum(TASK_TIME_RANGE_VALUES)
export const taskExecutionModeSchema = z.enum(TASK_EXECUTION_MODE_VALUES)

export const taskFilterSchema = z.object({
  statuses: z.array(taskStatusSchema),
  timeRange: taskTimeRangeSchema,
  keyword: z.string().default(""),
})

export const taskListItemSchema = z.object({
  taskId: z.string().min(1),
  projectId: z.string().min(1),
  prompt: z.string().default(""),
  title: z.string().default(""),
  titleSource: z.enum(["prompt", "agent", "user"]).default("prompt"),
  titleUpdatedAt: z.string().nullable().default(null),
  model: z.string().nullable().default(null),
  executor: z.string().default("codex"),
  executionMode: taskExecutionModeSchema.nullable().default(null),
  status: taskStatusSchema,
  threadId: z.string().nullable().default(null),
  parentTaskId: z.string().nullable().default(null),
  archivedAt: z.string().nullable().default(null),
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

export const taskAgentEventTypeSchema = z.enum(TASK_AGENT_EVENT_TYPE_VALUES)

export const taskAgentEventSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  eventType: taskAgentEventTypeSchema,
  payload: z.object({}).catchall(z.unknown()),
  createdAt: z.string().min(1),
})

export const taskAgentEventStreamSchema = z.object({
  taskId: z.string().min(1),
  items: z.array(taskAgentEventSchema).default([]),
  nextSequence: z.number().int().nonnegative(),
})

export type TaskStatus = z.infer<typeof taskStatusSchema>
export type TaskAgentEventType = z.infer<typeof taskAgentEventTypeSchema>
export type TaskTimeRange = z.infer<typeof taskTimeRangeSchema>
export type TaskExecutionMode = z.infer<typeof taskExecutionModeSchema>
export type TaskFilter = z.infer<typeof taskFilterSchema>
export type TaskListItem = z.infer<typeof taskListItemSchema>
export type TaskDetail = z.infer<typeof taskDetailSchema>
export type TaskAgentEvent = z.infer<typeof taskAgentEventSchema>
export type TaskAgentEventStream = z.infer<typeof taskAgentEventStreamSchema>

export const TERMINAL_TASK_STATUSES: TaskStatus[] = [
  "completed",
  "failed",
  "cancelled",
]
