import { z } from "zod"

export const ORCHESTRATION_STATUS_VALUES = [
  "active",
  "paused",
  "archived",
] as const

export const orchestrationStatusSchema = z.enum(ORCHESTRATION_STATUS_VALUES)

export const orchestrationListItemSchema = z.object({
  orchestrationId: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable().default(null),
  defaultPrompt: z.string().nullable().default(null),
  defaultConfig: z.record(z.string(), z.unknown()).nullable().default(null),
  status: orchestrationStatusSchema,
  archivedAt: z.string().nullable().default(null),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  taskCount: z.number().int().nonnegative(),
  activeTaskCount: z.number().int().nonnegative(),
  latestTaskSummary: z.string().nullable().default(null),
  latestTaskUpdatedAt: z.string().nullable().default(null),
})

export const orchestrationDetailSchema = orchestrationListItemSchema

export type OrchestrationStatus = z.infer<typeof orchestrationStatusSchema>
export type OrchestrationListItem = z.infer<typeof orchestrationListItemSchema>
export type OrchestrationDetail = z.infer<typeof orchestrationDetailSchema>
