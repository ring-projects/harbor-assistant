export type CreateTaskBody = {
  projectId: string
  prompt: string
  model?: string
  executor?: string
}

export type CancelTaskBody = {
  reason?: string
}

export type FollowupTaskBody = {
  prompt: string
  model?: string
}

export type TaskIdParams = {
  taskId: string
}

export type ProjectIdParams = {
  projectId: string
}

export type GetTaskTimelineQuery = {
  format?: "json" | "sse"
  afterSequence?: number
  limit?: number
}

export type GetProjectTasksQuery = {
  limit?: number
}

const taskEntitySchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "projectId",
    "projectPath",
    "prompt",
    "executor",
    "model",
    "status",
    "threadId",
    "parentTaskId",
    "createdAt",
    "startedAt",
    "finishedAt",
    "exitCode",
    "command",
    "stdout",
    "stderr",
    "error",
  ],
  properties: {
    id: { type: "string" },
    projectId: { type: "string" },
    projectPath: { type: "string" },
    prompt: { type: "string" },
    executor: { type: "string" },
    model: { type: ["string", "null"] },
    status: {
      type: "string",
      enum: ["queued", "running", "completed", "failed", "cancelled"],
    },
    threadId: { type: ["string", "null"] },
    parentTaskId: { type: ["string", "null"] },
    createdAt: { type: "string", format: "date-time" },
    startedAt: { type: ["string", "null"], format: "date-time" },
    finishedAt: { type: ["string", "null"], format: "date-time" },
    exitCode: { type: ["integer", "null"] },
    command: {
      type: "array",
      items: { type: "string" },
    },
    stdout: { type: "string" },
    stderr: { type: "string" },
    error: { type: ["string", "null"] },
  },
} as const

const taskTimelineItemSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "taskId",
    "sequence",
    "kind",
    "role",
    "status",
    "source",
    "content",
    "payload",
    "createdAt",
  ],
  properties: {
    id: { type: "string" },
    taskId: { type: "string" },
    sequence: { type: "integer" },
    kind: {
      type: "string",
      enum: ["message", "status", "stdout", "stderr", "summary", "error", "system"],
    },
    role: {
      type: ["string", "null"],
      enum: ["user", "assistant", "system", null],
    },
    status: {
      type: ["string", "null"],
      enum: ["queued", "running", "completed", "failed", "cancelled", null],
    },
    source: { type: ["string", "null"] },
    content: { type: ["string", "null"] },
    payload: { type: ["string", "null"] },
    createdAt: { type: "string", format: "date-time" },
  },
} as const

const taskTimelineSchema = {
  type: "object",
  additionalProperties: false,
  required: ["taskId", "items", "nextSequence"],
  properties: {
    taskId: { type: "string" },
    items: {
      type: "array",
      items: taskTimelineItemSchema,
    },
    nextSequence: { type: "integer" },
  },
} as const

const taskSuccessResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ok", "task"],
  properties: {
    ok: { type: "boolean", const: true },
    task: taskEntitySchema,
  },
} as const

const tasksSuccessResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ok", "tasks"],
  properties: {
    ok: { type: "boolean", const: true },
    tasks: {
      type: "array",
      items: taskEntitySchema,
    },
  },
} as const

const taskTimelineSuccessResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ok", "task", "timeline"],
  properties: {
    ok: { type: "boolean", const: true },
    task: taskEntitySchema,
    timeline: taskTimelineSchema,
  },
} as const

const taskIdParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["taskId"],
  properties: {
    taskId: { type: "string" },
  },
} as const

const projectIdParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["projectId"],
  properties: {
    projectId: { type: "string" },
  },
} as const

const positiveIntegerQueryParamSchema = {
  type: "integer",
  minimum: 1,
} as const

const nonNegativeIntegerQueryParamSchema = {
  type: "integer",
  minimum: 0,
} as const

export const createTaskBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["projectId", "prompt"],
  properties: {
    projectId: { type: "string" },
    prompt: { type: "string" },
    model: { type: "string" },
    executor: { type: "string" },
  },
} as const

export const cancelTaskBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    reason: { type: "string" },
  },
} as const

export const followupTaskBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["prompt"],
  properties: {
    prompt: { type: "string" },
    model: { type: "string" },
  },
} as const

const taskTimelineQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    format: {
      type: "string",
      enum: ["json", "sse"],
    },
    afterSequence: nonNegativeIntegerQueryParamSchema,
    limit: positiveIntegerQueryParamSchema,
  },
} as const

const limitOnlyQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    limit: positiveIntegerQueryParamSchema,
  },
} as const

export const createTaskRouteSchema = {
  body: createTaskBodySchema,
  response: {
    200: taskSuccessResponseSchema,
  },
} as const

export const getTaskRouteSchema = {
  params: taskIdParamsSchema,
  response: {
    200: taskSuccessResponseSchema,
  },
} as const

export const postCancelTaskRouteSchema = {
  params: taskIdParamsSchema,
  body: cancelTaskBodySchema,
  response: {
    200: taskSuccessResponseSchema,
  },
} as const

export const postRetryTaskRouteSchema = {
  params: taskIdParamsSchema,
  response: {
    200: taskSuccessResponseSchema,
  },
} as const

export const followupTaskRouteSchema = {
  params: taskIdParamsSchema,
  body: followupTaskBodySchema,
  response: {
    200: taskSuccessResponseSchema,
  },
} as const

export const getTaskTimelineRouteSchema = {
  params: taskIdParamsSchema,
  querystring: taskTimelineQuerySchema,
  response: {
    200: taskTimelineSuccessResponseSchema,
    206: taskTimelineSuccessResponseSchema,
  },
} as const

export const getProjectTasksRouteSchema = {
  params: projectIdParamsSchema,
  querystring: limitOnlyQuerySchema,
  response: {
    200: tasksSuccessResponseSchema,
  },
} as const
