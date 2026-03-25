export type TaskIdParams = {
  taskId: string
}

export type ProjectIdParams = {
  projectId: string
}

export type UpdateTaskTitleBody = {
  title: string
}

export type CreateTaskBody = {
  projectId: string
  prompt: string
  title?: string
  executor?: string | null
  model?: string | null
  executionMode?: string | null
}

export type GetTaskEventsQuery = {
  afterSequence?: number
  limit?: number
}

export type GetProjectTasksQuery = {
  limit?: number
  includeArchived?: boolean
}

const taskEntitySchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "projectId",
    "prompt",
    "title",
    "status",
    "archivedAt",
    "createdAt",
    "updatedAt",
    "startedAt",
    "finishedAt",
  ],
  properties: {
    id: { type: "string", minLength: 1 },
    projectId: { type: "string", minLength: 1 },
    prompt: { type: "string", minLength: 1 },
    title: { type: "string", minLength: 1 },
    status: {
      type: "string",
      enum: ["queued", "running", "completed", "failed", "cancelled"],
    },
    archivedAt: { type: ["string", "null"], format: "date-time" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    startedAt: { type: ["string", "null"], format: "date-time" },
    finishedAt: { type: ["string", "null"], format: "date-time" },
  },
} as const

const taskListItemSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "projectId",
    "title",
    "status",
    "archivedAt",
    "createdAt",
    "updatedAt",
    "startedAt",
    "finishedAt",
  ],
  properties: {
    id: { type: "string", minLength: 1 },
    projectId: { type: "string", minLength: 1 },
    title: { type: "string", minLength: 1 },
    status: {
      type: "string",
      enum: ["queued", "running", "completed", "failed", "cancelled"],
    },
    archivedAt: { type: ["string", "null"], format: "date-time" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    startedAt: { type: ["string", "null"], format: "date-time" },
    finishedAt: { type: ["string", "null"], format: "date-time" },
  },
} as const

const taskEventItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "taskId", "sequence", "eventType", "payload", "createdAt"],
  properties: {
    id: { type: "string", minLength: 1 },
    taskId: { type: "string", minLength: 1 },
    sequence: { type: "integer", minimum: 1 },
    eventType: { type: "string", minLength: 1 },
    payload: {
      type: "object",
      additionalProperties: true,
    },
    createdAt: { type: "string", format: "date-time" },
  },
} as const

const taskEventStreamSchema = {
  type: "object",
  additionalProperties: false,
  required: ["taskId", "items", "nextSequence"],
  properties: {
    taskId: { type: "string", minLength: 1 },
    items: {
      type: "array",
      items: taskEventItemSchema,
    },
    nextSequence: { type: "integer", minimum: 1 },
  },
} as const

export const taskIdParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["taskId"],
  properties: {
    taskId: { type: "string", minLength: 1 },
  },
} as const

export const projectIdParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["projectId"],
  properties: {
    projectId: { type: "string", minLength: 1 },
  },
} as const

export const updateTaskTitleBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["title"],
  properties: {
    title: { type: "string", minLength: 1 },
  },
} as const

export const getTaskEventsQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    afterSequence: { type: "integer", minimum: 0 },
    limit: { type: "integer", minimum: 1, maximum: 500 },
  },
} as const

export const getProjectTasksQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    limit: { type: "integer", minimum: 1, maximum: 500 },
    includeArchived: { type: "boolean" },
  },
} as const

export const createTaskBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["projectId", "prompt"],
  properties: {
    projectId: { type: "string", minLength: 1 },
    prompt: { type: "string", minLength: 1 },
    title: { type: "string", minLength: 1 },
    executor: { type: ["string", "null"] },
    model: { type: ["string", "null"] },
    executionMode: { type: ["string", "null"] },
  },
} as const

export const createTaskRouteSchema = {
  body: createTaskBodySchema,
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "task"],
      properties: {
        ok: { type: "boolean", const: true },
        task: taskEntitySchema,
      },
    },
  },
} as const

export const getTaskRouteSchema = {
  params: taskIdParamsSchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "task"],
      properties: {
        ok: { type: "boolean", const: true },
        task: taskEntitySchema,
      },
    },
  },
} as const

export const updateTaskTitleRouteSchema = {
  params: taskIdParamsSchema,
  body: updateTaskTitleBodySchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "task"],
      properties: {
        ok: { type: "boolean", const: true },
        task: taskEntitySchema,
      },
    },
  },
} as const

export const archiveTaskRouteSchema = {
  params: taskIdParamsSchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "task"],
      properties: {
        ok: { type: "boolean", const: true },
        task: taskEntitySchema,
      },
    },
  },
} as const

export const deleteTaskRouteSchema = {
  params: taskIdParamsSchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "taskId", "projectId"],
      properties: {
        ok: { type: "boolean", const: true },
        taskId: { type: "string", minLength: 1 },
        projectId: { type: "string", minLength: 1 },
      },
    },
  },
} as const

export const getTaskEventsRouteSchema = {
  params: taskIdParamsSchema,
  querystring: getTaskEventsQuerySchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "task", "events"],
      properties: {
        ok: { type: "boolean", const: true },
        task: taskEntitySchema,
        events: taskEventStreamSchema,
      },
    },
    206: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "task", "events"],
      properties: {
        ok: { type: "boolean", const: true },
        task: taskEntitySchema,
        events: taskEventStreamSchema,
      },
    },
  },
} as const

export const getProjectTasksRouteSchema = {
  params: projectIdParamsSchema,
  querystring: getProjectTasksQuerySchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "tasks"],
      properties: {
        ok: { type: "boolean", const: true },
        tasks: {
          type: "array",
          items: taskListItemSchema,
        },
      },
    },
  },
} as const
