export type UserIdParams = {
  userId: string
}

const userEntitySchema = {
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

export const userIdParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["userId"],
  properties: {
    userId: { type: "string", minLength: 1 },
  },
} as const

export const getCurrentUserRouteSchema = {
  tags: ["user"],
  operationId: "getCurrentUser",
  security: [{ cookieAuth: [] }],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "user"],
      properties: {
        ok: { type: "boolean", const: true },
        user: userEntitySchema,
      },
    },
  },
} as const

export const getUserRouteSchema = {
  tags: ["user"],
  operationId: "getUser",
  security: [{ cookieAuth: [] }],
  params: userIdParamsSchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "user"],
      properties: {
        ok: { type: "boolean", const: true },
        user: userEntitySchema,
      },
    },
  },
} as const
