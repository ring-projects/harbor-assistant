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
}

export type CancelTaskBody = {
  reason?: string
}

export type CreateTaskBody = {
  projectId: string
  prompt?: string
  items?: AgentInputItem[]
  title?: string
  executor?: string | null
  model?: string | null
  executionMode?: string | null
  effort?: TaskEffort | null
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

const taskInputItemsSchema = {
  type: "array",
  minItems: 1,
  items: {
    oneOf: [taskInputTextItemSchema, taskInputLocalImageItemSchema],
  },
} as const

export const resumeTaskBodySchema = {
  type: "object",
  additionalProperties: false,
  anyOf: [{ required: ["prompt"] }, { required: ["items"] }],
  properties: {
    prompt: { type: "string", minLength: 1 },
    items: taskInputItemsSchema,
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
  required: ["projectId"],
  anyOf: [{ required: ["prompt"] }, { required: ["items"] }],
  properties: {
    projectId: { type: "string", minLength: 1 },
    prompt: { type: "string", minLength: 1 },
    items: taskInputItemsSchema,
    title: { type: "string", minLength: 1 },
    executor: { type: ["string", "null"] },
    model: { type: ["string", "null"] },
    executionMode: { type: ["string", "null"] },
    effort: {
      anyOf: [
        { type: "string", enum: TASK_EFFORT_VALUES },
        { type: "null" },
      ],
    },
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

export const resumeTaskRouteSchema = {
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
