export type GitHubAuthStartQuery = {
  redirect?: string
}

export type GitHubAuthCallbackQuery = {
  code?: string
  state?: string
}

const authUserSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "githubLogin",
    "name",
    "email",
    "avatarUrl",
    "status",
    "lastLoginAt",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: { type: "string", minLength: 1 },
    githubLogin: { type: "string", minLength: 1 },
    name: { type: ["string", "null"] },
    email: { type: ["string", "null"] },
    avatarUrl: { type: ["string", "null"] },
    status: { type: "string", enum: ["active", "disabled"] },
    lastLoginAt: { type: ["string", "null"], format: "date-time" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
} as const

const gitHubAuthStartQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    redirect: { type: "string", minLength: 1 },
  },
} as const

const gitHubAuthCallbackQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    code: { type: "string", minLength: 1 },
    state: { type: "string", minLength: 1 },
  },
} as const

export const getAuthSessionRouteSchema = {
  tags: ["auth"],
  operationId: "getAuthSession",
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "authenticated", "user"],
      properties: {
        ok: { type: "boolean", const: true },
        authenticated: { type: "boolean" },
        user: {
          anyOf: [{ type: "null" }, authUserSchema],
        },
      },
    },
  },
} as const

export const logoutRouteSchema = {
  tags: ["auth"],
  operationId: "logout",
  security: [{ cookieAuth: [] }],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok"],
      properties: {
        ok: { type: "boolean", const: true },
      },
    },
  },
} as const

export const startGitHubAuthRouteSchema = {
  tags: ["auth"],
  operationId: "startGitHubAuth",
  querystring: gitHubAuthStartQuerySchema,
} as const

export const completeGitHubAuthRouteSchema = {
  tags: ["auth"],
  operationId: "completeGitHubAuth",
  querystring: gitHubAuthCallbackQuerySchema,
} as const
