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
