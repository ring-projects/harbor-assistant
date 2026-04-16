export type GitHubInstallUrlQuery = {
  returnTo?: string
  workspaceId?: string
}

export type GitHubSetupQuery = {
  installation_id?: string
  setup_action?: string
  state?: string
}

export type GitHubInstallationsQuery = {
  workspaceId?: string
}

export type GitHubInstallationRepositoriesParams = {
  installationId: string
}

const gitHubInstallationsQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    workspaceId: { type: "string", minLength: 1 },
  },
} as const

const gitHubInstallUrlQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    returnTo: { type: "string", minLength: 1 },
    workspaceId: { type: "string", minLength: 1 },
  },
} as const

const gitHubSetupQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    installation_id: { type: "string", minLength: 1 },
    setup_action: { type: "string", minLength: 1 },
    state: { type: "string", minLength: 1 },
  },
} as const

const gitHubInstallationRepositoriesParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["installationId"],
  properties: {
    installationId: { type: "string", minLength: 1 },
  },
} as const

const gitHubAppInstallationSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "accountType",
    "accountLogin",
    "targetType",
    "status",
    "installedByUserId",
    "createdAt",
    "updatedAt",
    "lastValidatedAt",
  ],
  properties: {
    id: { type: "string", minLength: 1 },
    accountType: { type: "string", enum: ["user", "organization"] },
    accountLogin: { type: "string", minLength: 1 },
    targetType: { type: "string", enum: ["selected", "all"] },
    status: { type: "string", enum: ["active", "suspended", "deleted"] },
    installedByUserId: { type: ["string", "null"] },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    lastValidatedAt: { type: ["string", "null"], format: "date-time" },
  },
} as const

const gitHubInstallationRepositorySummarySchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "nodeId",
    "owner",
    "name",
    "fullName",
    "url",
    "defaultBranch",
    "visibility",
  ],
  properties: {
    nodeId: { type: ["string", "null"] },
    owner: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1 },
    fullName: { type: "string", minLength: 1 },
    url: { type: "string", minLength: 1 },
    defaultBranch: { type: ["string", "null"] },
    visibility: {
      type: ["string", "null"],
      enum: ["public", "private", "internal", null],
    },
  },
} as const

export const getGitHubInstallUrlRouteSchema = {
  tags: ["github"],
  operationId: "getGitHubAppInstallUrl",
  security: [{ cookieAuth: [] }],
  querystring: gitHubInstallUrlQuerySchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "installUrl"],
      properties: {
        ok: { type: "boolean", const: true },
        installUrl: { type: "string", minLength: 1 },
      },
    },
  },
} as const

export const completeGitHubSetupRouteSchema = {
  tags: ["github"],
  operationId: "completeGitHubAppSetup",
  security: [{ cookieAuth: [] }],
  querystring: gitHubSetupQuerySchema,
} as const

export const listGitHubInstallationsRouteSchema = {
  tags: ["github"],
  operationId: "listGitHubInstallations",
  security: [{ cookieAuth: [] }],
  querystring: gitHubInstallationsQuerySchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "installations"],
      properties: {
        ok: { type: "boolean", const: true },
        installations: {
          type: "array",
          items: gitHubAppInstallationSchema,
        },
      },
    },
  },
} as const

export const listGitHubInstallationRepositoriesRouteSchema = {
  tags: ["github"],
  operationId: "listGitHubInstallationRepositories",
  security: [{ cookieAuth: [] }],
  params: gitHubInstallationRepositoriesParamsSchema,
  querystring: gitHubInstallationsQuerySchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "repositories"],
      properties: {
        ok: { type: "boolean", const: true },
        repositories: {
          type: "array",
          items: gitHubInstallationRepositorySummarySchema,
        },
      },
    },
  },
} as const
