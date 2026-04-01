import type { AgentInputItem } from "../../../lib/agents"
import { TASK_EFFORT_VALUES, type TaskEffort } from "../../task"

export type OrchestrationIdParams = {
  orchestrationId: string
}

export type ProjectIdParams = {
  projectId: string
}

export type CreateOrchestrationBody = {
  projectId: string
  title: string
  description?: string | null
  defaultPrompt?: string | null
  defaultConfig?: Record<string, unknown> | null
}

export type CreateOrchestrationTaskBody = {
  prompt?: string
  items?: AgentInputItem[]
  title?: string
  executor: string
  model: string
  executionMode: string
  effort: TaskEffort
}

export type ListOrchestrationTasksQuery = {
  limit?: number
  includeArchived?: boolean
}

const jsonObjectSchema = {
  type: ["object", "null"],
  additionalProperties: true,
} as const

const orchestrationEntitySchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "projectId",
    "title",
    "description",
    "defaultPrompt",
    "defaultConfig",
    "status",
    "archivedAt",
    "createdAt",
    "updatedAt",
    "taskCount",
    "activeTaskCount",
    "latestTaskSummary",
    "latestTaskUpdatedAt",
  ],
  properties: {
    id: { type: "string", minLength: 1 },
    projectId: { type: "string", minLength: 1 },
    title: { type: "string", minLength: 1 },
    description: { type: ["string", "null"] },
    defaultPrompt: { type: ["string", "null"] },
    defaultConfig: jsonObjectSchema,
    status: {
      type: "string",
      enum: ["active", "paused", "archived"],
    },
    archivedAt: { type: ["string", "null"], format: "date-time" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    taskCount: { type: "integer", minimum: 0 },
    activeTaskCount: { type: "integer", minimum: 0 },
    latestTaskSummary: { type: ["string", "null"] },
    latestTaskUpdatedAt: { type: ["string", "null"], format: "date-time" },
  },
} as const

const taskInputTextItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "text"],
  properties: {
    type: { type: "string", const: "text" },
    text: { type: "string", minLength: 1 },
  },
} as const

const taskInputLocalImageItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "path"],
  properties: {
    type: { type: "string", const: "local_image" },
    path: { type: "string", minLength: 1 },
  },
} as const

const taskInputItemsSchema = {
  type: "array",
  minItems: 1,
  items: {
    oneOf: [taskInputTextItemSchema, taskInputLocalImageItemSchema],
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

export const orchestrationIdParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["orchestrationId"],
  properties: {
    orchestrationId: { type: "string", minLength: 1 },
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

export const createOrchestrationBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["projectId", "title"],
  properties: {
    projectId: { type: "string", minLength: 1 },
    title: { type: "string", minLength: 1 },
    description: { type: ["string", "null"] },
    defaultPrompt: { type: ["string", "null"] },
    defaultConfig: jsonObjectSchema,
  },
} as const

export const listOrchestrationTasksQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    limit: { type: "integer", minimum: 1, maximum: 500 },
    includeArchived: { type: "boolean" },
  },
} as const

export const createOrchestrationTaskBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["executor", "model", "executionMode", "effort"],
  anyOf: [{ required: ["prompt"] }, { required: ["items"] }],
  properties: {
    prompt: { type: "string", minLength: 1 },
    items: taskInputItemsSchema,
    title: { type: "string", minLength: 1 },
    executor: { type: "string", minLength: 1 },
    model: { type: "string", minLength: 1 },
    executionMode: { type: "string", minLength: 1 },
    effort: { type: "string", enum: TASK_EFFORT_VALUES },
  },
} as const

export const createOrchestrationRouteSchema = {
  body: createOrchestrationBodySchema,
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "orchestration"],
      properties: {
        ok: { type: "boolean", const: true },
        orchestration: orchestrationEntitySchema,
      },
    },
  },
} as const

export const getOrchestrationRouteSchema = {
  params: orchestrationIdParamsSchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "orchestration"],
      properties: {
        ok: { type: "boolean", const: true },
        orchestration: orchestrationEntitySchema,
      },
    },
  },
} as const

export const listProjectOrchestrationsRouteSchema = {
  params: projectIdParamsSchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "orchestrations"],
      properties: {
        ok: { type: "boolean", const: true },
        orchestrations: {
          type: "array",
          items: orchestrationEntitySchema,
        },
      },
    },
  },
} as const

export const createOrchestrationTaskRouteSchema = {
  params: orchestrationIdParamsSchema,
  body: createOrchestrationTaskBodySchema,
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "task"],
      properties: {
        ok: { type: "boolean", const: true },
        task: {
          ...taskListItemSchema,
          required: [...taskListItemSchema.required, "prompt"],
          properties: {
            ...taskListItemSchema.properties,
            prompt: { type: "string", minLength: 1 },
          },
        },
      },
    },
  },
} as const

export const listOrchestrationTasksRouteSchema = {
  params: orchestrationIdParamsSchema,
  querystring: listOrchestrationTasksQuerySchema,
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
