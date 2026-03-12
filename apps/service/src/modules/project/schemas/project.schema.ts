export type ProjectIdParams = {
  id: string
}

export type CreateProjectBody = {
  path: string
  name?: string
}

export type UpdateProjectBody = {
  path?: string
  name?: string
}

export type ProjectSettingsBody = {
  defaultExecutor?: "codex" | "claude-code"
  defaultModel?: string | null
  defaultExecutionMode?: "safe" | "connected" | "full-access"
  maxConcurrentTasks?: number
  logRetentionDays?: number | null
  eventRetentionDays?: number | null
  harborSkillsEnabled?: boolean
  harborSkillProfile?: string | null
}

const projectEntitySchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "name",
    "slug",
    "rootPath",
    "normalizedPath",
    "description",
    "status",
    "lastOpenedAt",
    "createdAt",
    "updatedAt",
    "archivedAt",
    "path",
  ],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    slug: { type: ["string", "null"] },
    rootPath: { type: "string" },
    normalizedPath: { type: "string" },
    description: { type: ["string", "null"] },
    status: {
      type: "string",
      enum: ["active", "archived", "missing"],
    },
    lastOpenedAt: {
      type: ["string", "null"],
      format: "date-time",
    },
    createdAt: {
      type: "string",
      format: "date-time",
    },
    updatedAt: {
      type: "string",
      format: "date-time",
    },
    archivedAt: {
      type: ["string", "null"],
      format: "date-time",
    },
    path: { type: "string" },
  },
} as const

const projectsSuccessResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ok", "projects"],
  properties: {
    ok: { type: "boolean", const: true },
    projects: {
      type: "array",
      items: projectEntitySchema,
    },
  },
} as const

const projectSettingsEntitySchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "projectId",
    "defaultExecutor",
    "defaultModel",
    "defaultExecutionMode",
    "maxConcurrentTasks",
    "logRetentionDays",
    "eventRetentionDays",
    "harborSkillsEnabled",
    "harborSkillProfile",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    projectId: { type: "string" },
    defaultExecutor: {
      type: ["string", "null"],
      enum: ["codex", "claude-code", null],
    },
    defaultModel: { type: ["string", "null"] },
    defaultExecutionMode: {
      type: ["string", "null"],
      enum: ["safe", "connected", "full-access", null],
    },
    maxConcurrentTasks: {
      type: "integer",
      minimum: 1,
    },
    logRetentionDays: {
      type: ["integer", "null"],
      minimum: 1,
    },
    eventRetentionDays: {
      type: ["integer", "null"],
      minimum: 1,
    },
    harborSkillsEnabled: {
      type: "boolean",
    },
    harborSkillProfile: {
      type: ["string", "null"],
    },
    createdAt: {
      type: "string",
      format: "date-time",
    },
    updatedAt: {
      type: "string",
      format: "date-time",
    },
  },
} as const

const projectSettingsSuccessResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ok", "settings"],
  properties: {
    ok: { type: "boolean", const: true },
    settings: projectSettingsEntitySchema,
  },
} as const

export const projectIdParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id"],
  properties: {
    id: { type: "string" },
  },
} as const

export const createProjectBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["path"],
  properties: {
    path: { type: "string" },
    name: { type: "string" },
  },
} as const

export const updateProjectBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    path: { type: "string" },
    name: { type: "string" },
  },
  anyOf: [
    { required: ["path"] },
    { required: ["name"] },
  ],
} as const

export const projectSettingsBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    defaultExecutor: {
      type: "string",
      enum: ["codex", "claude-code"],
    },
    defaultModel: {
      type: ["string", "null"],
    },
    defaultExecutionMode: {
      type: "string",
      enum: ["safe", "connected", "full-access"],
    },
    maxConcurrentTasks: {
      type: "integer",
      minimum: 1,
    },
    logRetentionDays: {
      type: ["integer", "null"],
      minimum: 1,
    },
    eventRetentionDays: {
      type: ["integer", "null"],
      minimum: 1,
    },
    harborSkillsEnabled: {
      type: "boolean",
    },
    harborSkillProfile: {
      type: ["string", "null"],
    },
  },
  anyOf: [
    { required: ["defaultExecutor"] },
    { required: ["defaultModel"] },
    { required: ["defaultExecutionMode"] },
    { required: ["maxConcurrentTasks"] },
    { required: ["logRetentionDays"] },
    { required: ["eventRetentionDays"] },
    { required: ["harborSkillsEnabled"] },
    { required: ["harborSkillProfile"] },
  ],
} as const

export const listProjectsRouteSchema = {
  response: {
    200: projectsSuccessResponseSchema,
  },
} as const

export const createProjectRouteSchema = {
  body: createProjectBodySchema,
  response: {
    200: projectsSuccessResponseSchema,
  },
} as const

export const updateProjectRouteSchema = {
  params: projectIdParamsSchema,
  body: updateProjectBodySchema,
  response: {
    200: projectsSuccessResponseSchema,
  },
} as const

export const deleteProjectRouteSchema = {
  params: projectIdParamsSchema,
  response: {
    200: projectsSuccessResponseSchema,
  },
} as const

export const getProjectSettingsRouteSchema = {
  params: projectIdParamsSchema,
  response: {
    200: projectSettingsSuccessResponseSchema,
  },
} as const

export const updateProjectSettingsRouteSchema = {
  params: projectIdParamsSchema,
  body: projectSettingsBodySchema,
  response: {
    200: projectSettingsSuccessResponseSchema,
  },
} as const
