import { z } from "zod"

export const ORCHESTRATION_STATUS_VALUES = [
  "active",
  "archived",
] as const

export const orchestrationStatusSchema = z.enum(ORCHESTRATION_STATUS_VALUES)

export const orchestrationListItemSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable().default(null),
  status: orchestrationStatusSchema,
  archivedAt: z.string().nullable().default(null),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
})

export const orchestrationDetailSchema = orchestrationListItemSchema

export type OrchestrationStatus = z.infer<typeof orchestrationStatusSchema>
export type OrchestrationListItem = z.infer<typeof orchestrationListItemSchema>
export type OrchestrationDetail = z.infer<typeof orchestrationDetailSchema>
