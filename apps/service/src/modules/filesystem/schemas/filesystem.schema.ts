export type ListDirectoryBody = {
  path?: string
  cursor?: string | null
  limit?: number
  includeHidden?: boolean
}

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

const fileSystemListResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ok", "path", "parentPath", "entries", "nextCursor", "truncated"],
  properties: {
    ok: { type: "boolean", const: true },
    path: { type: "string" },
    parentPath: { type: ["string", "null"] },
    entries: {
      type: "array",
      items: fileSystemEntrySchema,
    },
    nextCursor: { type: ["string", "null"] },
    truncated: { type: "boolean" },
  },
} as const

export const fileSystemListBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    path: { type: "string" },
    cursor: { type: ["string", "null"] },
    limit: { type: "integer", minimum: 1 },
    includeHidden: { type: "boolean" },
  },
} as const

export const listDirectoryRouteSchema = {
  body: fileSystemListBodySchema,
  response: {
    200: fileSystemListResponseSchema,
  },
} as const
