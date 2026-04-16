export type GitProjectParams = {
  projectId: string
}

export type CheckoutGitBranchBody = {
  branchName: string
}

export type CreateGitBranchBody = {
  branchName: string
  checkout?: boolean
  fromRef?: string | null
}

const gitProjectParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["projectId"],
  properties: {
    projectId: { type: "string", minLength: 1 },
  },
} as const

const gitRepositorySummarySchema = {
  type: "object",
  additionalProperties: false,
  required: ["path", "repositoryRoot", "currentBranch", "detached", "dirty"],
  properties: {
    path: { type: "string" },
    repositoryRoot: { type: "string" },
    currentBranch: { type: ["string", "null"] },
    detached: { type: "boolean" },
    dirty: { type: "boolean" },
  },
} as const

const gitBranchSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "current"],
  properties: {
    name: { type: "string" },
    current: { type: "boolean" },
  },
} as const

const gitBranchListSchema = {
  type: "object",
  additionalProperties: false,
  required: ["path", "currentBranch", "branches"],
  properties: {
    path: { type: "string" },
    currentBranch: { type: ["string", "null"] },
    branches: {
      type: "array",
      items: gitBranchSchema,
    },
  },
} as const

const gitDiffLineSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "content", "oldLineNumber", "newLineNumber"],
  properties: {
    type: {
      type: "string",
      enum: ["context", "add", "delete", "meta"],
    },
    content: { type: "string" },
    oldLineNumber: { type: ["integer", "null"] },
    newLineNumber: { type: ["integer", "null"] },
  },
} as const

const gitDiffHunkSchema = {
  type: "object",
  additionalProperties: false,
  required: ["header", "lines"],
  properties: {
    header: { type: "string" },
    lines: {
      type: "array",
      items: gitDiffLineSchema,
    },
  },
} as const

const gitDiffFileSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "path",
    "oldPath",
    "status",
    "isBinary",
    "isTooLarge",
    "additions",
    "deletions",
    "patch",
    "hunks",
  ],
  properties: {
    path: { type: "string" },
    oldPath: { type: ["string", "null"] },
    status: {
      type: "string",
      enum: ["added", "modified", "deleted", "renamed", "copied", "binary", "unknown"],
    },
    isBinary: { type: "boolean" },
    isTooLarge: { type: "boolean" },
    additions: { type: "integer" },
    deletions: { type: "integer" },
    patch: { type: "string" },
    hunks: {
      type: "array",
      items: gitDiffHunkSchema,
    },
  },
} as const

const checkoutGitBranchBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["branchName"],
  properties: {
    branchName: { type: "string", minLength: 1 },
  },
} as const

const createGitBranchBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["branchName"],
  properties: {
    branchName: { type: "string", minLength: 1 },
    checkout: { type: "boolean" },
    fromRef: { type: ["string", "null"] },
  },
} as const

export const getProjectGitRepositoryRouteSchema = {
  tags: ["git"],
  operationId: "getProjectGitRepository",
  security: [{ cookieAuth: [] }],
  params: gitProjectParamsSchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "repository"],
      properties: {
        ok: { type: "boolean", const: true },
        repository: gitRepositorySummarySchema,
      },
    },
  },
} as const

export const listProjectGitBranchesRouteSchema = {
  tags: ["git"],
  operationId: "listProjectGitBranches",
  security: [{ cookieAuth: [] }],
  params: gitProjectParamsSchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "branches"],
      properties: {
        ok: { type: "boolean", const: true },
        branches: gitBranchListSchema,
      },
    },
  },
} as const

export const getProjectGitDiffRouteSchema = {
  tags: ["git"],
  operationId: "getProjectGitDiff",
  security: [{ cookieAuth: [] }],
  params: gitProjectParamsSchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "diff"],
      properties: {
        ok: { type: "boolean", const: true },
        diff: {
          type: "object",
          additionalProperties: false,
          required: ["path", "files"],
          properties: {
            path: { type: "string" },
            files: {
              type: "array",
              items: gitDiffFileSchema,
            },
          },
        },
      },
    },
  },
} as const

export const checkoutProjectGitBranchRouteSchema = {
  tags: ["git"],
  operationId: "checkoutProjectGitBranch",
  security: [{ cookieAuth: [] }],
  params: gitProjectParamsSchema,
  body: checkoutGitBranchBodySchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "repository"],
      properties: {
        ok: { type: "boolean", const: true },
        repository: gitRepositorySummarySchema,
      },
    },
  },
} as const

export const createProjectGitBranchRouteSchema = {
  tags: ["git"],
  operationId: "createProjectGitBranch",
  security: [{ cookieAuth: [] }],
  params: gitProjectParamsSchema,
  body: createGitBranchBodySchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "branches"],
      properties: {
        ok: { type: "boolean", const: true },
        branches: gitBranchListSchema,
      },
    },
  },
} as const
