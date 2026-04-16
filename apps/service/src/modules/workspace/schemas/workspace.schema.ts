export type WorkspaceIdParams = {
  id: string
}

export type WorkspaceMemberParams = {
  id: string
  userId: string
}

export type CreateWorkspaceBody = {
  id?: string
  name: string
}

export type WorkspaceGithubLoginBody = {
  githubLogin: string
}

export type AcceptWorkspaceInvitationParams = {
  invitationId: string
}

const membershipSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "workspaceId",
    "userId",
    "role",
    "status",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    workspaceId: { type: "string", minLength: 1 },
    userId: { type: "string", minLength: 1 },
    role: { type: "string", enum: ["owner", "member"] },
    status: { type: "string", enum: ["active", "removed"] },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
} as const

const workspaceEntitySchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "slug",
    "name",
    "type",
    "status",
    "createdByUserId",
    "createdAt",
    "updatedAt",
    "archivedAt",
    "memberships",
  ],
  properties: {
    id: { type: "string", minLength: 1 },
    slug: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1 },
    type: { type: "string", enum: ["personal", "team"] },
    status: { type: "string", enum: ["active", "archived"] },
    createdByUserId: { type: "string", minLength: 1 },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    archivedAt: { type: ["string", "null"], format: "date-time" },
    memberships: {
      type: "array",
      items: membershipSchema,
    },
  },
} as const

const workspaceInvitationSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "workspaceId",
    "inviteeGithubLogin",
    "role",
    "status",
    "invitedByUserId",
    "acceptedByUserId",
    "createdAt",
    "updatedAt",
    "acceptedAt",
  ],
  properties: {
    id: { type: "string", minLength: 1 },
    workspaceId: { type: "string", minLength: 1 },
    inviteeGithubLogin: { type: "string", minLength: 1 },
    role: { type: "string", enum: ["member"] },
    status: { type: "string", enum: ["pending", "accepted", "revoked"] },
    invitedByUserId: { type: "string", minLength: 1 },
    acceptedByUserId: { type: ["string", "null"] },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    acceptedAt: { type: ["string", "null"], format: "date-time" },
  },
} as const

export const workspaceIdParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id"],
  properties: {
    id: { type: "string", minLength: 1 },
  },
} as const

export const workspaceMemberParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "userId"],
  properties: {
    id: { type: "string", minLength: 1 },
    userId: { type: "string", minLength: 1 },
  },
} as const

export const createWorkspaceBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["name"],
  properties: {
    id: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1 },
  },
} as const

export const workspaceGithubLoginBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["githubLogin"],
  properties: {
    githubLogin: { type: "string", minLength: 1 },
  },
} as const

export const acceptWorkspaceInvitationParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["invitationId"],
  properties: {
    invitationId: { type: "string", minLength: 1 },
  },
} as const

export const listUserWorkspacesRouteSchema = {
  tags: ["workspace"],
  operationId: "listWorkspaces",
  security: [{ cookieAuth: [] }],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "workspaces"],
      properties: {
        ok: { type: "boolean", const: true },
        workspaces: {
          type: "array",
          items: workspaceEntitySchema,
        },
      },
    },
  },
} as const

export const createWorkspaceRouteSchema = {
  tags: ["workspace"],
  operationId: "createWorkspace",
  security: [{ cookieAuth: [] }],
  body: createWorkspaceBodySchema,
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "workspace"],
      properties: {
        ok: { type: "boolean", const: true },
        workspace: workspaceEntitySchema,
      },
    },
  },
} as const

export const listWorkspaceMembersRouteSchema = {
  tags: ["workspace"],
  operationId: "listWorkspaceMembers",
  security: [{ cookieAuth: [] }],
  params: workspaceIdParamsSchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "memberships"],
      properties: {
        ok: { type: "boolean", const: true },
        memberships: {
          type: "array",
          items: membershipSchema,
        },
      },
    },
  },
} as const

export const addWorkspaceMemberRouteSchema = {
  tags: ["workspace"],
  operationId: "addWorkspaceMember",
  security: [{ cookieAuth: [] }],
  params: workspaceIdParamsSchema,
  body: workspaceGithubLoginBodySchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "membership"],
      properties: {
        ok: { type: "boolean", const: true },
        membership: membershipSchema,
      },
    },
  },
} as const

export const removeWorkspaceMemberRouteSchema = {
  tags: ["workspace"],
  operationId: "removeWorkspaceMember",
  security: [{ cookieAuth: [] }],
  params: workspaceMemberParamsSchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "membership"],
      properties: {
        ok: { type: "boolean", const: true },
        membership: membershipSchema,
      },
    },
  },
} as const

export const listWorkspaceInvitationsRouteSchema = {
  tags: ["workspace"],
  operationId: "listWorkspaceInvitations",
  security: [{ cookieAuth: [] }],
  params: workspaceIdParamsSchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "invitations"],
      properties: {
        ok: { type: "boolean", const: true },
        invitations: {
          type: "array",
          items: workspaceInvitationSchema,
        },
      },
    },
  },
} as const

export const createWorkspaceInvitationRouteSchema = {
  tags: ["workspace"],
  operationId: "createWorkspaceInvitation",
  security: [{ cookieAuth: [] }],
  params: workspaceIdParamsSchema,
  body: workspaceGithubLoginBodySchema,
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "invitation"],
      properties: {
        ok: { type: "boolean", const: true },
        invitation: workspaceInvitationSchema,
      },
    },
  },
} as const

export const acceptWorkspaceInvitationRouteSchema = {
  tags: ["workspace"],
  operationId: "acceptWorkspaceInvitation",
  security: [{ cookieAuth: [] }],
  params: acceptWorkspaceInvitationParamsSchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "invitation", "membership"],
      properties: {
        ok: { type: "boolean", const: true },
        invitation: workspaceInvitationSchema,
        membership: {
          anyOf: [{ type: "null" }, membershipSchema],
        },
      },
    },
  },
} as const
