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

export type GetTaskEventsQuery = {
  format?: "json" | "sse"
  afterSequence?: number
  limit?: number
}

export type GetTaskConversationQuery = {
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

const taskEventSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "taskId", "runId", "sequence", "type", "payload", "createdAt"],
  properties: {
    id: { type: "string" },
    taskId: { type: "string" },
    runId: { type: "string" },
    sequence: { type: "integer" },
    type: {
      type: "string",
      enum: ["state", "stdout", "stderr", "system", "summary"],
    },
    payload: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
  },
} as const

const taskConversationMessageSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "taskId", "role", "content", "timestamp", "source"],
  properties: {
    id: { type: "string" },
    taskId: { type: "string" },
    role: {
      type: "string",
      enum: ["user", "assistant", "system"],
    },
    content: { type: "string" },
    timestamp: { type: ["string", "null"], format: "date-time" },
    source: { type: "string" },
  },
} as const

const taskConversationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["taskId", "threadId", "rolloutPath", "messages", "truncated"],
  properties: {
    taskId: { type: "string" },
    threadId: { type: ["string", "null"] },
    rolloutPath: { type: ["string", "null"] },
    messages: {
      type: "array",
      items: taskConversationMessageSchema,
    },
    truncated: { type: "boolean" },
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

const taskEventsSuccessResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ok", "task", "events"],
  properties: {
    ok: { type: "boolean", const: true },
    task: taskEntitySchema,
    events: {
      type: "array",
      items: taskEventSchema,
    },
  },
} as const

const taskConversationSuccessResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ok", "conversation"],
  properties: {
    ok: { type: "boolean", const: true },
    conversation: taskConversationSchema,
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

const taskEventsQuerySchema = {
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

export const getTaskEventsRouteSchema = {
  params: taskIdParamsSchema,
  querystring: taskEventsQuerySchema,
  response: {
    200: taskEventsSuccessResponseSchema,
    206: taskEventsSuccessResponseSchema,
  },
} as const

export const getTaskConversationRouteSchema = {
  params: taskIdParamsSchema,
  querystring: limitOnlyQuerySchema,
  response: {
    200: taskConversationSuccessResponseSchema,
  },
} as const

export const getProjectTasksRouteSchema = {
  params: projectIdParamsSchema,
  querystring: limitOnlyQuerySchema,
  response: {
    200: tasksSuccessResponseSchema,
  },
} as const
