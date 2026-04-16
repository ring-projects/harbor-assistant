import type { AgentInputItem } from "../../../lib/agents"
import { TASK_EFFORT_VALUES, type TaskEffort } from "../domain/task-effort"

export type TaskIdParams = {
  taskId: string
}

export type ProjectIdParams = {
  projectId: string
}

export type UpdateTaskTitleBody = {
  title: string
}

export type ResumeTaskBody = {
  prompt?: string
  items?: AgentInputItem[]
  model?: string | null
  effort?: TaskEffort | null
}

export type CancelTaskBody = {
  reason?: string
}

export type UploadTaskInputImageBody = {
  name: string
  mediaType: string
  dataBase64: string
}

export type GetTaskEventsQuery = {
  afterSequence?: number
  limit?: number
}

const taskEntitySchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "projectId",
    "orchestrationId",
    "prompt",
    "title",
    "titleSource",
    "executor",
    "model",
    "executionMode",
    "effort",
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
    orchestrationId: { type: "string", minLength: 1 },
    prompt: { type: "string", minLength: 1 },
    title: { type: "string", minLength: 1 },
    titleSource: {
      type: "string",
      enum: ["prompt", "agent", "user"],
    },
    executor: { type: ["string", "null"] },
    model: { type: ["string", "null"] },
    executionMode: { type: ["string", "null"] },
    effort: {
      anyOf: [
        { type: "string", enum: TASK_EFFORT_VALUES },
        { type: "null" },
      ],
    },
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
    "orchestrationId",
    "title",
    "titleSource",
    "executor",
    "model",
    "executionMode",
    "effort",
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
    orchestrationId: { type: "string", minLength: 1 },
    title: { type: "string", minLength: 1 },
    titleSource: {
      type: "string",
      enum: ["prompt", "agent", "user"],
    },
    executor: { type: ["string", "null"] },
    model: { type: ["string", "null"] },
    executionMode: { type: ["string", "null"] },
    effort: {
      anyOf: [
        { type: "string", enum: TASK_EFFORT_VALUES },
        { type: "null" },
      ],
    },
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

const taskInputTextItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "text"],
  properties: {
    type: {
      type: "string",
      const: "text",
    },
    text: {
      type: "string",
      minLength: 1,
    },
  },
} as const

const taskInputLocalImageItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "path"],
  properties: {
    type: {
      type: "string",
      const: "local_image",
    },
    path: {
      type: "string",
      minLength: 1,
    },
  },
} as const

const taskInputLocalFileItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "path"],
  properties: {
    type: {
      type: "string",
      const: "local_file",
    },
    path: {
      type: "string",
      minLength: 1,
    },
  },
} as const

const taskInputItemsSchema = {
  type: "array",
  minItems: 1,
  items: {
    oneOf: [
      taskInputTextItemSchema,
      taskInputLocalImageItemSchema,
      taskInputLocalFileItemSchema,
    ],
  },
} as const

export const resumeTaskBodySchema = {
  type: "object",
  additionalProperties: false,
  allOf: [
    {
      not: {
        required: ["executor"],
      },
    },
  ],
  anyOf: [{ required: ["prompt"] }, { required: ["items"] }],
  properties: {
    prompt: { type: "string", minLength: 1 },
    items: taskInputItemsSchema,
    executor: { type: "null" },
    model: { type: ["string", "null"] },
    effort: {
      anyOf: [
        { type: "string", enum: TASK_EFFORT_VALUES },
        { type: "null" },
      ],
    },
  },
} as const

export const cancelTaskBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    reason: { type: "string", minLength: 1 },
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

export const uploadTaskInputImageBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "mediaType", "dataBase64"],
  properties: {
    name: { type: "string", minLength: 1 },
    mediaType: { type: "string", minLength: 1 },
    dataBase64: { type: "string", minLength: 1 },
  },
} as const

export const uploadTaskInputImageRouteSchema = {
  tags: ["tasks"],
  operationId: "uploadTaskInputFile",
  security: [{ cookieAuth: [] }],
  params: projectIdParamsSchema,
  body: uploadTaskInputImageBodySchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "path", "mediaType", "name", "size"],
      properties: {
        ok: { type: "boolean", const: true },
        path: { type: "string", minLength: 1 },
        mediaType: { type: "string", minLength: 1 },
        name: { type: "string", minLength: 1 },
        size: { type: "integer", minimum: 1 },
      },
    },
  },
} as const

export const getTaskRouteSchema = {
  tags: ["tasks"],
  operationId: "getTask",
  security: [{ cookieAuth: [] }],
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
  tags: ["tasks"],
  operationId: "updateTaskTitle",
  security: [{ cookieAuth: [] }],
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
  tags: ["tasks"],
  operationId: "archiveTask",
  security: [{ cookieAuth: [] }],
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

export const resumeTaskRouteSchema = {
  tags: ["tasks"],
  operationId: "resumeTask",
  security: [{ cookieAuth: [] }],
  params: taskIdParamsSchema,
  body: resumeTaskBodySchema,
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

export const cancelTaskRouteSchema = {
  tags: ["tasks"],
  operationId: "cancelTask",
  security: [{ cookieAuth: [] }],
  params: taskIdParamsSchema,
  body: cancelTaskBodySchema,
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
  tags: ["tasks"],
  operationId: "deleteTask",
  security: [{ cookieAuth: [] }],
  params: taskIdParamsSchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "taskId", "projectId", "orchestrationId"],
      properties: {
        ok: { type: "boolean", const: true },
        taskId: { type: "string", minLength: 1 },
        projectId: { type: "string", minLength: 1 },
        orchestrationId: { type: "string", minLength: 1 },
      },
    },
  },
} as const

export const getTaskEventsRouteSchema = {
  tags: ["tasks"],
  operationId: "getTaskEvents",
  security: [{ cookieAuth: [] }],
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
