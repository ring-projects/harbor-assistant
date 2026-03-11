export type CreateTaskBody = {
  projectId: string
  prompt: string
  model?: string
  executor?: string
}

export type BreakTaskTurnBody = {
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
  afterSequence?: number
  limit?: number
}

export type GetTaskDiffQuery = Record<string, never>

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

const taskAgentEventSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "taskId", "sequence", "eventType", "payload", "createdAt"],
  properties: {
    id: { type: "string" },
    taskId: { type: "string" },
    sequence: { type: "integer" },
    eventType: { type: "string" },
    payload: {
      type: "object",
      additionalProperties: true,
    },
    createdAt: { type: "string", format: "date-time" },
  },
} as const

const taskAgentEventStreamSchema = {
  type: "object",
  additionalProperties: false,
  required: ["taskId", "items", "nextSequence"],
  properties: {
    taskId: { type: "string" },
    items: {
      type: "array",
      items: taskAgentEventSchema,
    },
    nextSequence: { type: "integer" },
  },
} as const

const taskDiffLineSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "content", "oldLineNumber", "newLineNumber"],
  properties: {
    type: {
      type: "string",
      enum: ["context", "add", "delete", "meta"],
    },
    content: { type: "string" },
    oldLineNumber: { type: ["integer", "null"] },
    newLineNumber: { type: ["integer", "null"] },
  },
} as const

const taskDiffHunkSchema = {
  type: "object",
  additionalProperties: false,
  required: ["header", "lines"],
  properties: {
    header: { type: "string" },
    lines: {
      type: "array",
      items: taskDiffLineSchema,
    },
  },
} as const

const taskDiffFileSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "path",
    "oldPath",
    "status",
    "isBinary",
    "isTooLarge",
    "additions",
    "deletions",
    "patch",
    "hunks",
  ],
  properties: {
    path: { type: "string" },
    oldPath: { type: ["string", "null"] },
    status: {
      type: "string",
      enum: ["added", "modified", "deleted", "renamed", "copied", "binary", "unknown"],
    },
    isBinary: { type: "boolean" },
    isTooLarge: { type: "boolean" },
    additions: { type: "integer" },
    deletions: { type: "integer" },
    patch: { type: "string" },
    hunks: {
      type: "array",
      items: taskDiffHunkSchema,
    },
  },
} as const

const taskDiffSchema = {
  type: "object",
  additionalProperties: false,
  required: ["taskId", "files"],
  properties: {
    taskId: { type: "string" },
    files: {
      type: "array",
      items: taskDiffFileSchema,
    },
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
    events: taskAgentEventStreamSchema,
  },
} as const

const taskDiffSuccessResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ok", "diff"],
  properties: {
    ok: { type: "boolean", const: true },
    diff: taskDiffSchema,
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

export const breakTaskTurnBodySchema = {
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
    afterSequence: nonNegativeIntegerQueryParamSchema,
    limit: positiveIntegerQueryParamSchema,
  },
} as const

const emptyQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
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

export const postBreakTaskTurnRouteSchema = {
  params: taskIdParamsSchema,
  body: breakTaskTurnBodySchema,
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

export const getTaskDiffRouteSchema = {
  params: taskIdParamsSchema,
  querystring: emptyQuerySchema,
  response: {
    200: taskDiffSuccessResponseSchema,
  },
} as const

export const getProjectTasksRouteSchema = {
  params: projectIdParamsSchema,
  querystring: limitOnlyQuerySchema,
  response: {
    200: tasksSuccessResponseSchema,
  },
} as const
