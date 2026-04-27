export type ProjectIdParams = {
  id: string
}

export type DeleteProjectResponse = {
  ok: true
  projectId: string
}

export type CreateProjectBody = {
  id: string
  name: string
  workspaceId?: string | null
  description?: string | null
  repositoryBinding?: {
    provider: "github"
    installationId: string
    repositoryFullName: string
  }
} & (
  | {
      source: {
        type: "rootPath"
        rootPath: string
      }
    }
  | {
      source: {
        type: "git"
        repositoryUrl: string
        branch?: string | null
      }
    }
)

export type ProjectRepositoryBindingResponse = {
  projectId: string
  provider: "github"
  installationId: string
  repositoryOwner: string
  repositoryName: string
  repositoryFullName: string
  repositoryUrl: string
  defaultBranch: string | null
  visibility: "public" | "private" | "internal" | null
  localPathState: "missing" | "ready"
}

export type PutProjectRepositoryBindingBody = {
  provider: "github"
  installationId: string
  repositoryFullName: string
}

export type UpdateProjectBody = {
  name?: string
  description?: string | null
  rootPath?: string
}

export type UpdateProjectSettingsBody = Partial<{
  retention: Partial<{
    logRetentionDays: number | null
    eventRetentionDays: number | null
  }>
}>

const projectSettingsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["retention"],
  properties: {
    retention: {
      type: "object",
      additionalProperties: false,
      required: ["logRetentionDays", "eventRetentionDays"],
      properties: {
        logRetentionDays: { type: ["integer", "null"], minimum: 1 },
        eventRetentionDays: { type: ["integer", "null"], minimum: 1 },
      },
    },
  },
} as const

const rootPathProjectSourceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "rootPath", "normalizedPath"],
  properties: {
    type: { type: "string", const: "rootPath" },
    rootPath: { type: "string", minLength: 1 },
    normalizedPath: { type: "string", minLength: 1 },
  },
} as const

const gitProjectSourceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "repositoryUrl", "branch"],
  properties: {
    type: { type: "string", const: "git" },
    repositoryUrl: { type: "string", minLength: 1 },
    branch: { type: ["string", "null"] },
  },
} as const

const createRootPathProjectSourceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "rootPath"],
  properties: {
    type: { type: "string", const: "rootPath" },
    rootPath: { type: "string", minLength: 1 },
  },
} as const

const createGitProjectSourceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "repositoryUrl"],
  properties: {
    type: { type: "string", const: "git" },
    repositoryUrl: { type: "string", minLength: 1 },
    branch: { type: ["string", "null"] },
  },
} as const

const repositoryBindingSchema = {
  type: "object",
  additionalProperties: false,
  required: ["provider", "installationId", "repositoryFullName"],
  properties: {
    provider: { type: "string", const: "github" },
    installationId: { type: "string", minLength: 1 },
    repositoryFullName: { type: "string", minLength: 1 },
  },
} as const

const projectEntitySchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "workspaceId",
    "slug",
    "name",
    "description",
    "source",
    "rootPath",
    "normalizedPath",
    "status",
    "createdAt",
    "updatedAt",
    "archivedAt",
    "lastOpenedAt",
    "settings",
  ],
  properties: {
    id: { type: "string", minLength: 1 },
    workspaceId: { type: ["string", "null"], minLength: 1 },
    slug: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1 },
    description: { type: ["string", "null"] },
    source: {
      oneOf: [rootPathProjectSourceSchema, gitProjectSourceSchema],
    },
    rootPath: { type: ["string", "null"] },
    normalizedPath: { type: ["string", "null"] },
    status: {
      type: "string",
      enum: ["active", "archived", "missing"],
    },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    archivedAt: { type: ["string", "null"], format: "date-time" },
    lastOpenedAt: { type: ["string", "null"], format: "date-time" },
    settings: projectSettingsSchema,
  },
} as const

export const projectIdParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id"],
  properties: {
    id: { type: "string", minLength: 1 },
  },
} as const

export const createProjectBodySchema = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["id", "name", "source"],
      properties: {
        id: { type: "string", minLength: 1 },
        name: { type: "string", minLength: 1 },
        workspaceId: { type: ["string", "null"], minLength: 1 },
        description: { type: ["string", "null"] },
        source: createRootPathProjectSourceSchema,
        repositoryBinding: false,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["id", "name", "source"],
      properties: {
        id: { type: "string", minLength: 1 },
        name: { type: "string", minLength: 1 },
        workspaceId: { type: ["string", "null"], minLength: 1 },
        description: { type: ["string", "null"] },
        source: createGitProjectSourceSchema,
        repositoryBinding: repositoryBindingSchema,
      },
    },
  ],
} as const

const projectRepositoryBindingEntitySchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "projectId",
    "provider",
    "installationId",
    "repositoryOwner",
    "repositoryName",
    "repositoryFullName",
    "repositoryUrl",
    "defaultBranch",
    "visibility",
    "localPathState",
  ],
  properties: {
    projectId: { type: "string", minLength: 1 },
    provider: { type: "string", const: "github" },
    installationId: { type: "string", minLength: 1 },
    repositoryOwner: { type: "string", minLength: 1 },
    repositoryName: { type: "string", minLength: 1 },
    repositoryFullName: { type: "string", minLength: 1 },
    repositoryUrl: { type: "string", minLength: 1 },
    defaultBranch: { type: ["string", "null"] },
    visibility: {
      type: ["string", "null"],
      enum: ["public", "private", "internal", null],
    },
    localPathState: {
      type: "string",
      enum: ["missing", "ready"],
    },
  },
} as const

export const updateProjectBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1 },
    description: { type: ["string", "null"] },
    rootPath: { type: "string", minLength: 1 },
  },
  anyOf: [
    { required: ["name"] },
    { required: ["description"] },
    { required: ["rootPath"] },
  ],
} as const

export const updateProjectSettingsBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    retention: {
      type: "object",
      additionalProperties: false,
      properties: {
        logRetentionDays: { type: ["integer", "null"], minimum: 1 },
        eventRetentionDays: { type: ["integer", "null"], minimum: 1 },
      },
      anyOf: [
        { required: ["logRetentionDays"] },
        { required: ["eventRetentionDays"] },
      ],
    },
  },
  required: ["retention"],
} as const

export const listProjectsRouteSchema = {
  tags: ["projects"],
  operationId: "listProjects",
  security: [{ cookieAuth: [] }],
  response: {
    200: {
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
    },
  },
} as const

export const createProjectRouteSchema = {
  tags: ["projects"],
  operationId: "createProject",
  security: [{ cookieAuth: [] }],
  body: createProjectBodySchema,
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "project"],
      properties: {
        ok: { type: "boolean", const: true },
        project: projectEntitySchema,
      },
    },
  },
} as const

export const getProjectRouteSchema = {
  tags: ["projects"],
  operationId: "getProject",
  security: [{ cookieAuth: [] }],
  params: projectIdParamsSchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "project"],
      properties: {
        ok: { type: "boolean", const: true },
        project: projectEntitySchema,
      },
    },
  },
} as const

export const updateProjectRouteSchema = {
  tags: ["projects"],
  operationId: "updateProject",
  security: [{ cookieAuth: [] }],
  params: projectIdParamsSchema,
  body: updateProjectBodySchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "project"],
      properties: {
        ok: { type: "boolean", const: true },
        project: projectEntitySchema,
      },
    },
  },
} as const

export const getProjectSettingsRouteSchema = {
  tags: ["projects"],
  operationId: "getProjectSettings",
  security: [{ cookieAuth: [] }],
  params: projectIdParamsSchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "settings"],
      properties: {
        ok: { type: "boolean", const: true },
        settings: projectSettingsSchema,
      },
    },
  },
} as const

export const updateProjectSettingsRouteSchema = {
  tags: ["projects"],
  operationId: "updateProjectSettings",
  security: [{ cookieAuth: [] }],
  params: projectIdParamsSchema,
  body: updateProjectSettingsBodySchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "project"],
      properties: {
        ok: { type: "boolean", const: true },
        project: projectEntitySchema,
      },
    },
  },
} as const

export const archiveProjectRouteSchema = {
  tags: ["projects"],
  operationId: "archiveProject",
  security: [{ cookieAuth: [] }],
  params: projectIdParamsSchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "project"],
      properties: {
        ok: { type: "boolean", const: true },
        project: projectEntitySchema,
      },
    },
  },
} as const

export const getProjectRepositoryBindingRouteSchema = {
  tags: ["projects"],
  operationId: "getProjectRepositoryBinding",
  security: [{ cookieAuth: [] }],
  params: projectIdParamsSchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "repositoryBinding"],
      properties: {
        ok: { type: "boolean", const: true },
        repositoryBinding: projectRepositoryBindingEntitySchema,
      },
    },
  },
} as const

export const putProjectRepositoryBindingRouteSchema = {
  tags: ["projects"],
  operationId: "putProjectRepositoryBinding",
  security: [{ cookieAuth: [] }],
  params: projectIdParamsSchema,
  body: repositoryBindingSchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "repositoryBinding"],
      properties: {
        ok: { type: "boolean", const: true },
        repositoryBinding: projectRepositoryBindingEntitySchema,
      },
    },
  },
} as const

export const provisionProjectLocalPathRouteSchema = {
  tags: ["projects"],
  operationId: "provisionProjectLocalPath",
  security: [{ cookieAuth: [] }],
  params: projectIdParamsSchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "project", "repositoryBinding"],
      properties: {
        ok: { type: "boolean", const: true },
        project: projectEntitySchema,
        repositoryBinding: projectRepositoryBindingEntitySchema,
      },
    },
  },
} as const

export const syncProjectLocalPathRouteSchema = {
  tags: ["projects"],
  operationId: "syncProjectLocalPath",
  security: [{ cookieAuth: [] }],
  params: projectIdParamsSchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "projectId", "syncedAt"],
      properties: {
        ok: { type: "boolean", const: true },
        projectId: { type: "string", minLength: 1 },
        syncedAt: { type: "string", format: "date-time" },
      },
    },
  },
} as const

export const restoreProjectRouteSchema = {
  tags: ["projects"],
  operationId: "restoreProject",
  security: [{ cookieAuth: [] }],
  params: projectIdParamsSchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "project"],
      properties: {
        ok: { type: "boolean", const: true },
        project: projectEntitySchema,
      },
    },
  },
} as const

export const deleteProjectRouteSchema = {
  tags: ["projects"],
  operationId: "deleteProject",
  security: [{ cookieAuth: [] }],
  params: projectIdParamsSchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "projectId"],
      properties: {
        ok: { type: "boolean", const: true },
        projectId: { type: "string", minLength: 1 },
      },
    },
  },
} as const
