import type { AgentInputItem } from "../../../lib/agents"
import { TASK_EFFORT_VALUES, type TaskEffort } from "../../task"

export type OrchestrationIdParams = {
  orchestrationId: string
}

export type ProjectIdParams = {
  projectId: string
}

export type ListProjectOrchestrationsQuery = {
  surface?: "human-loop" | "schedule"
}

export type CreateOrchestrationBody = {
  projectId: string
  title?: string | null
  description?: string | null
}

export type UpdateOrchestrationBody = {
  title?: string | null
  description?: string | null
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

export type ScheduleTaskTemplateBody = {
  prompt?: string | null
  items?: AgentInputItem[] | null
  title?: string | null
  executor: string
  model: string
  executionMode: string
  effort: TaskEffort
}

export type UpsertOrchestrationScheduleBody = {
  enabled: boolean
  cronExpression: string
  timezone?: string
  concurrencyPolicy?: "skip"
  taskTemplate: ScheduleTaskTemplateBody
}

export type BootstrapOrchestrationBody = {
  projectId: string
  orchestration?: {
    title?: string | null
    description?: string | null
  }
  initialTask: CreateOrchestrationTaskBody
}

export type ListOrchestrationTasksQuery = {
  limit?: number
  includeArchived?: boolean
}

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

const taskInputLocalFileItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "path"],
  properties: {
    type: { type: "string", const: "local_file" },
    path: { type: "string", minLength: 1 },
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

const orchestrationScheduleSchema = {
  type: ["object", "null"],
  additionalProperties: false,
  required: [
    "orchestrationId",
    "enabled",
    "cronExpression",
    "timezone",
    "concurrencyPolicy",
    "taskTemplate",
    "lastTriggeredAt",
    "nextTriggerAt",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    orchestrationId: { type: "string", minLength: 1 },
    enabled: { type: "boolean" },
    cronExpression: { type: "string", minLength: 1 },
    timezone: { type: "string", minLength: 1 },
    concurrencyPolicy: {
      type: "string",
      enum: ["skip"],
    },
    taskTemplate: {
      type: "object",
      additionalProperties: false,
      required: [
        "title",
        "prompt",
        "items",
        "executor",
        "model",
        "executionMode",
        "effort",
      ],
      properties: {
        title: { type: ["string", "null"] },
        prompt: { type: ["string", "null"] },
        items: {
          type: "array",
          items: taskInputItemsSchema.items,
        },
        executor: { type: "string", minLength: 1 },
        model: { type: "string", minLength: 1 },
        executionMode: { type: "string", minLength: 1 },
        effort: { type: "string", enum: TASK_EFFORT_VALUES },
      },
    },
    lastTriggeredAt: { type: ["string", "null"], format: "date-time" },
    nextTriggerAt: { type: ["string", "null"], format: "date-time" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
} as const

const orchestrationEntitySchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "projectId",
    "title",
    "description",
    "status",
    "archivedAt",
    "schedule",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: { type: "string", minLength: 1 },
    projectId: { type: "string", minLength: 1 },
    title: { type: "string", minLength: 1 },
    description: { type: ["string", "null"] },
    status: {
      type: "string",
      enum: ["active", "archived"],
    },
    archivedAt: { type: ["string", "null"], format: "date-time" },
    schedule: orchestrationScheduleSchema,
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
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
      anyOf: [{ type: "string", enum: TASK_EFFORT_VALUES }, { type: "null" }],
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

const taskDetailSchema = {
  ...taskListItemSchema,
  required: [...taskListItemSchema.required, "prompt"],
  properties: {
    ...taskListItemSchema.properties,
    prompt: { type: "string", minLength: 1 },
  },
} as const

const bootstrapWarningSchema = {
  type: "object",
  additionalProperties: false,
  required: ["code", "message"],
  properties: {
    code: { type: "string", minLength: 1 },
    message: { type: "string", minLength: 1 },
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

export const listProjectOrchestrationsQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    surface: {
      type: "string",
      enum: ["human-loop", "schedule"],
    },
  },
} as const

export const createOrchestrationBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["projectId"],
  properties: {
    projectId: { type: "string", minLength: 1 },
    title: { type: ["string", "null"] },
    description: { type: ["string", "null"] },
  },
} as const

export const updateOrchestrationBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: ["string", "null"] },
    description: { type: ["string", "null"] },
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

export const scheduleTaskTemplateBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["executor", "model", "executionMode", "effort"],
  anyOf: [{ required: ["prompt"] }, { required: ["items"] }],
  properties: {
    prompt: {
      anyOf: [{ type: "string", minLength: 1 }, { type: "null" }],
    },
    items: {
      anyOf: [taskInputItemsSchema, { type: "null" }],
    },
    title: {
      anyOf: [{ type: "string", minLength: 1 }, { type: "null" }],
    },
    executor: { type: "string", minLength: 1 },
    model: { type: "string", minLength: 1 },
    executionMode: { type: "string", minLength: 1 },
    effort: { type: "string", enum: TASK_EFFORT_VALUES },
  },
} as const

export const bootstrapOrchestrationBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["projectId", "initialTask"],
  properties: {
    projectId: { type: "string", minLength: 1 },
    orchestration: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: ["string", "null"] },
        description: { type: ["string", "null"] },
      },
    },
    initialTask: createOrchestrationTaskBodySchema,
  },
} as const

export const upsertOrchestrationScheduleBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["enabled", "cronExpression", "taskTemplate"],
  properties: {
    enabled: { type: "boolean" },
    cronExpression: { type: "string", minLength: 1 },
    timezone: { type: "string", minLength: 1 },
    concurrencyPolicy: {
      type: "string",
      enum: ["skip"],
    },
    taskTemplate: scheduleTaskTemplateBodySchema,
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

export const createOrchestrationRouteSchema = {
  tags: ["orchestration"],
  operationId: "createOrchestration",
  security: [{ cookieAuth: [] }, { bearerAuth: [] }],
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

export const bootstrapOrchestrationRouteSchema = {
  tags: ["orchestration"],
  operationId: "bootstrapOrchestration",
  security: [{ cookieAuth: [] }, { bearerAuth: [] }],
  body: bootstrapOrchestrationBodySchema,
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "orchestration", "task", "bootstrap"],
      properties: {
        ok: { type: "boolean", const: true },
        orchestration: orchestrationEntitySchema,
        task: taskDetailSchema,
        bootstrap: {
          type: "object",
          additionalProperties: false,
          required: ["runtimeStarted", "warning"],
          properties: {
            runtimeStarted: { type: "boolean" },
            warning: {
              anyOf: [bootstrapWarningSchema, { type: "null" }],
            },
          },
        },
      },
    },
  },
} as const

export const getOrchestrationRouteSchema = {
  tags: ["orchestration"],
  operationId: "getOrchestration",
  security: [{ cookieAuth: [] }, { bearerAuth: [] }],
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

export const updateOrchestrationRouteSchema = {
  tags: ["orchestration"],
  operationId: "updateOrchestration",
  security: [{ cookieAuth: [] }, { bearerAuth: [] }],
  params: orchestrationIdParamsSchema,
  body: updateOrchestrationBodySchema,
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

export const upsertOrchestrationScheduleRouteSchema = {
  tags: ["orchestration"],
  operationId: "upsertOrchestrationSchedule",
  security: [{ cookieAuth: [] }, { bearerAuth: [] }],
  params: orchestrationIdParamsSchema,
  body: upsertOrchestrationScheduleBodySchema,
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
  tags: ["orchestration"],
  operationId: "listProjectOrchestrations",
  security: [{ cookieAuth: [] }, { bearerAuth: [] }],
  params: projectIdParamsSchema,
  querystring: listProjectOrchestrationsQuerySchema,
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
  tags: ["orchestration"],
  operationId: "createOrchestrationTask",
  security: [{ cookieAuth: [] }, { bearerAuth: [] }],
  params: orchestrationIdParamsSchema,
  body: createOrchestrationTaskBodySchema,
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "task"],
      properties: {
        ok: { type: "boolean", const: true },
        task: taskDetailSchema,
      },
    },
  },
} as const

export const listOrchestrationTasksRouteSchema = {
  tags: ["orchestration"],
  operationId: "listOrchestrationTasks",
  security: [{ cookieAuth: [] }, { bearerAuth: [] }],
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
