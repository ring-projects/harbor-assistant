import { AUTHORIZATION_ACTIONS } from "../../authorization"

export type GitHubAuthStartQuery = {
  redirect?: string
}

export type GitHubAuthCallbackQuery = {
  code?: string
  state?: string
}

export type DelegateAgentTokenBody = {
  name?: string | null
  ttlSeconds?: number
  scopes: (typeof AUTHORIZATION_ACTIONS)[number][]
  projectId?: string | null
  orchestrationId?: string | null
  taskId?: string | null
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

const authSessionUserActorSchema = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "userId", "sessionId"],
  properties: {
    kind: { type: "string", const: "user" },
    userId: { type: "string", minLength: 1 },
    sessionId: { type: "string", minLength: 1 },
  },
} as const

const authSessionAgentActorSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "kind",
    "tokenId",
    "issuedByUserId",
    "scopes",
    "projectId",
    "orchestrationId",
    "taskId",
    "sourceTaskId",
    "expiresAt",
  ],
  properties: {
    kind: { type: "string", const: "agent" },
    tokenId: { type: "string", minLength: 1 },
    issuedByUserId: { type: ["string", "null"] },
    scopes: {
      type: "array",
      items: {
        type: "string",
        enum: [...AUTHORIZATION_ACTIONS],
      },
    },
    projectId: { type: ["string", "null"] },
    orchestrationId: { type: ["string", "null"] },
    taskId: { type: ["string", "null"] },
    sourceTaskId: { type: ["string", "null"] },
    expiresAt: { type: "string", format: "date-time" },
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
      required: ["ok", "authenticated", "user", "actor"],
      properties: {
        ok: { type: "boolean", const: true },
        authenticated: { type: "boolean" },
        user: {
          anyOf: [{ type: "null" }, authUserSchema],
        },
        actor: {
          anyOf: [
            { type: "null" },
            authSessionUserActorSchema,
            authSessionAgentActorSchema,
          ],
        },
      },
    },
  },
} as const

export const logoutRouteSchema = {
  tags: ["auth"],
  operationId: "logout",
  security: [{ cookieAuth: [] }, { bearerAuth: [] }],
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

export const delegateAgentTokenBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["scopes"],
  properties: {
    name: { type: ["string", "null"] },
    ttlSeconds: { type: "integer", minimum: 60 },
    scopes: {
      type: "array",
      minItems: 1,
      items: {
        type: "string",
        enum: [...AUTHORIZATION_ACTIONS],
      },
    },
    projectId: { type: ["string", "null"], minLength: 1 },
    orchestrationId: { type: ["string", "null"], minLength: 1 },
    taskId: { type: ["string", "null"], minLength: 1 },
  },
} as const

export const delegateAgentTokenRouteSchema = {
  tags: ["auth"],
  operationId: "delegateAgentToken",
  security: [{ cookieAuth: [] }, { bearerAuth: [] }],
  body: delegateAgentTokenBodySchema,
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "agentToken"],
      properties: {
        ok: { type: "boolean", const: true },
        agentToken: {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "token",
            "issuedByUserId",
            "projectId",
            "orchestrationId",
            "taskId",
            "scopes",
            "expiresAt",
            "createdAt",
          ],
          properties: {
            id: { type: "string", minLength: 1 },
            token: { type: "string", minLength: 1 },
            issuedByUserId: { type: ["string", "null"] },
            projectId: { type: ["string", "null"] },
            orchestrationId: { type: ["string", "null"] },
            taskId: { type: ["string", "null"] },
            scopes: {
              type: "array",
              items: {
                type: "string",
                enum: [...AUTHORIZATION_ACTIONS],
              },
            },
            expiresAt: { type: "string", format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
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
