import { z } from "zod"
import {
  TASK_EFFORT_VALUES,
  TASK_EXECUTION_MODE_VALUES,
} from "@/modules/tasks/contracts"

export const ORCHESTRATION_STATUS_VALUES = ["active", "archived"] as const

export const orchestrationStatusSchema = z.enum(ORCHESTRATION_STATUS_VALUES)

const orchestrationTaskInputItemSchema = z.union([
  z.object({
    type: z.literal("text"),
    text: z.string().min(1),
  }),
  z.object({
    type: z.literal("local_image"),
    path: z.string().min(1),
  }),
  z.object({
    type: z.literal("local_file"),
    path: z.string().min(1),
  }),
])

export const orchestrationScheduleSchema = z.object({
  orchestrationId: z.string().min(1),
  enabled: z.boolean(),
  cronExpression: z.string().min(1),
  timezone: z.string().min(1),
  concurrencyPolicy: z.literal("skip"),
  taskTemplate: z.object({
    title: z.string().nullable().default(null),
    prompt: z.string().nullable().default(null),
    items: z.array(orchestrationTaskInputItemSchema).default([]),
    executor: z.string().min(1),
    model: z.string().min(1),
    executionMode: z.enum(TASK_EXECUTION_MODE_VALUES),
    effort: z.enum(TASK_EFFORT_VALUES),
  }),
  lastTriggeredAt: z.string().nullable().default(null),
  nextTriggerAt: z.string().nullable().default(null),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
})

export const orchestrationListItemSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable().default(null),
  status: orchestrationStatusSchema,
  archivedAt: z.string().nullable().default(null),
  schedule: orchestrationScheduleSchema.nullable().default(null),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
})

export const orchestrationDetailSchema = orchestrationListItemSchema

export type OrchestrationStatus = z.infer<typeof orchestrationStatusSchema>
export type OrchestrationSchedule = z.infer<typeof orchestrationScheduleSchema>
export type OrchestrationListItem = z.infer<typeof orchestrationListItemSchema>
export type OrchestrationDetail = z.infer<typeof orchestrationDetailSchema>
