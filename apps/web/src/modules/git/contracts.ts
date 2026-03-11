import { z } from "zod"

export const GIT_DIFF_FILE_STATUS_VALUES = [
  "added",
  "modified",
  "deleted",
  "renamed",
  "copied",
  "binary",
  "unknown",
] as const

export const GIT_DIFF_LINE_TYPE_VALUES = [
  "context",
  "add",
  "delete",
  "meta",
] as const

export const gitDiffFileStatusSchema = z.enum(GIT_DIFF_FILE_STATUS_VALUES)
export const gitDiffLineTypeSchema = z.enum(GIT_DIFF_LINE_TYPE_VALUES)

export const gitDiffLineSchema = z.object({
  type: gitDiffLineTypeSchema,
  content: z.string().default(""),
  oldLineNumber: z.number().int().nullable().default(null),
  newLineNumber: z.number().int().nullable().default(null),
})

export const gitDiffHunkSchema = z.object({
  header: z.string().min(1),
  lines: z.array(gitDiffLineSchema).default([]),
})

export const gitDiffFileSchema = z.object({
  path: z.string().min(1),
  oldPath: z.string().nullable().default(null),
  status: gitDiffFileStatusSchema,
  isBinary: z.boolean().default(false),
  isTooLarge: z.boolean().default(false),
  additions: z.number().int().nonnegative().default(0),
  deletions: z.number().int().nonnegative().default(0),
  patch: z.string().default(""),
  hunks: z.array(gitDiffHunkSchema).default([]),
})

export const gitDiffSchema = z.object({
  projectId: z.string().min(1),
  files: z.array(gitDiffFileSchema).default([]),
})

export type GitDiffFileStatus = z.infer<typeof gitDiffFileStatusSchema>
export type GitDiffLineType = z.infer<typeof gitDiffLineTypeSchema>
export type GitDiffLine = z.infer<typeof gitDiffLineSchema>
export type GitDiffHunk = z.infer<typeof gitDiffHunkSchema>
export type GitDiffFile = z.infer<typeof gitDiffFileSchema>
export type GitDiff = z.infer<typeof gitDiffSchema>
