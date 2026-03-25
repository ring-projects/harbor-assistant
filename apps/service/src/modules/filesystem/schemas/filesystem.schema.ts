export type ProjectFilesParams = {
  projectId: string
}

export type ProjectFilePathQuery = {
  path?: string
}

export type ProjectListDirectoryBody = {
  path?: string
  cursor?: string | null
  limit?: number
  includeHidden?: boolean
}

export type ProjectWriteTextFileBody = {
  path: string
  content: string
  createParents?: boolean
}

export type ProjectCreateDirectoryBody = {
  path: string
  recursive?: boolean
}

const projectFilesParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["projectId"],
  properties: {
    projectId: { type: "string", minLength: 1 },
  },
} as const

const projectFilePathQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    path: { type: "string" },
  },
} as const

const fileSystemEntrySchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "path", "type", "isHidden", "isSymlink", "size", "mtime"],
  properties: {
    name: { type: "string" },
    path: { type: "string" },
    type: {
      type: "string",
      enum: ["directory", "file"],
    },
    isHidden: { type: "boolean" },
    isSymlink: { type: "boolean" },
    size: { type: ["integer", "null"] },
    mtime: { type: ["string", "null"], format: "date-time" },
  },
} as const

const fileSystemPathInfoSchema = {
  type: "object",
  additionalProperties: false,
  required: ["path", "type", "isHidden", "isSymlink", "size", "mtime"],
  properties: {
    path: { type: "string" },
    type: {
      type: "string",
      enum: ["directory", "file"],
    },
    isHidden: { type: "boolean" },
    isSymlink: { type: "boolean" },
    size: { type: ["integer", "null"] },
    mtime: { type: ["string", "null"], format: "date-time" },
  },
} as const

const readTextFileSchema = {
  type: "object",
  additionalProperties: false,
  required: ["path", "content", "size", "mtime"],
  properties: {
    path: { type: "string" },
    content: { type: "string" },
    size: { type: ["integer", "null"] },
    mtime: { type: ["string", "null"], format: "date-time" },
  },
} as const

export const projectListDirectoryBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    path: { type: "string" },
    cursor: { type: ["string", "null"] },
    limit: { type: "integer", minimum: 1 },
    includeHidden: { type: "boolean" },
  },
} as const

export const projectWriteTextFileBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["path", "content"],
  properties: {
    path: { type: "string", minLength: 1 },
    content: { type: "string" },
    createParents: { type: "boolean" },
  },
} as const

export const projectCreateDirectoryBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["path"],
  properties: {
    path: { type: "string", minLength: 1 },
    recursive: { type: "boolean" },
  },
} as const

export const listProjectFilesRouteSchema = {
  params: projectFilesParamsSchema,
  body: projectListDirectoryBodySchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "listing"],
      properties: {
        ok: { type: "boolean", const: true },
        listing: {
          type: "object",
          additionalProperties: false,
          required: ["path", "parentPath", "entries", "nextCursor", "truncated"],
          properties: {
            path: { type: "string" },
            parentPath: { type: ["string", "null"] },
            entries: {
              type: "array",
              items: fileSystemEntrySchema,
            },
            nextCursor: { type: ["string", "null"] },
            truncated: { type: "boolean" },
          },
        },
      },
    },
  },
} as const

export const statProjectPathRouteSchema = {
  params: projectFilesParamsSchema,
  querystring: projectFilePathQuerySchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "pathInfo"],
      properties: {
        ok: { type: "boolean", const: true },
        pathInfo: fileSystemPathInfoSchema,
      },
    },
  },
} as const

export const readProjectTextFileRouteSchema = {
  params: projectFilesParamsSchema,
  querystring: projectFilePathQuerySchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "file"],
      properties: {
        ok: { type: "boolean", const: true },
        file: readTextFileSchema,
      },
    },
  },
} as const

export const writeProjectTextFileRouteSchema = {
  params: projectFilesParamsSchema,
  body: projectWriteTextFileBodySchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "file"],
      properties: {
        ok: { type: "boolean", const: true },
        file: readTextFileSchema,
      },
    },
  },
} as const

export const createProjectDirectoryRouteSchema = {
  params: projectFilesParamsSchema,
  body: projectCreateDirectoryBodySchema,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "directory"],
      properties: {
        ok: { type: "boolean", const: true },
        directory: fileSystemPathInfoSchema,
      },
    },
  },
} as const
