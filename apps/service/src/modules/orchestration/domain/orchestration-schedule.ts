import type { AgentInputItem } from "../../../lib/agents"
import {
  normalizeAgentInputItems,
  resolveAgentInput,
} from "../../task/domain/task-input"
import {
  normalizeNullableTaskEffort,
  type TaskEffort,
} from "../../task/domain/task-effort"
import { createOrchestrationError } from "../errors"

export type OrchestrationConcurrencyPolicy = "skip"

export type OrchestrationTaskTemplate = {
  title: string | null
  prompt: string | null
  items: AgentInputItem[]
  executor: string
  model: string
  executionMode: string
  effort: TaskEffort
}

export type OrchestrationSchedule = {
  orchestrationId: string
  enabled: boolean
  cronExpression: string
  timezone: string
  concurrencyPolicy: OrchestrationConcurrencyPolicy
  taskTemplate: OrchestrationTaskTemplate
  lastTriggeredAt: Date | null
  nextTriggerAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export function assertValidTimeZone(timezone: string) {
  try {
    Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
    }).format(new Date())
  } catch {
    throw createOrchestrationError().invalidInput(
      `invalid timezone "${timezone}"`,
    )
  }
}

function createOrchestrationTaskTemplate(input: {
  title?: string | null
  prompt?: string | null
  items?: AgentInputItem[] | null
  executor: string
  model: string
  executionMode: string
  effort: TaskEffort
}): OrchestrationTaskTemplate {
  const title = input.title?.trim() || null
  const prompt = input.prompt?.trim() || null
  const items = normalizeAgentInputItems(input.items)
  const executor = input.executor.trim()
  const model = input.model.trim()
  const executionMode = input.executionMode.trim()
  const effort = normalizeNullableTaskEffort(input.effort)

  if (!resolveAgentInput({ prompt, items })) {
    throw createOrchestrationError().invalidInput(
      "schedule task input is required",
    )
  }
  if (!executor) {
    throw createOrchestrationError().invalidInput(
      "schedule executor is required",
    )
  }
  if (!model) {
    throw createOrchestrationError().invalidInput("schedule model is required")
  }
  if (!executionMode) {
    throw createOrchestrationError().invalidInput(
      "schedule executionMode is required",
    )
  }
  if (!effort) {
    throw createOrchestrationError().invalidInput(
      `invalid schedule effort "${input.effort}"`,
    )
  }

  return {
    title,
    prompt,
    items,
    executor,
    model,
    executionMode,
    effort,
  }
}

export function createOrchestrationSchedule(input: {
  orchestrationId: string
  enabled?: boolean
  cronExpression: string
  timezone?: string
  concurrencyPolicy?: OrchestrationConcurrencyPolicy
  taskTemplate: {
    title?: string | null
    prompt?: string | null
    items?: AgentInputItem[] | null
    executor: string
    model: string
    executionMode: string
    effort: TaskEffort
  }
  lastTriggeredAt?: Date | null
  nextTriggerAt?: Date | null
  createdAt?: Date
  updatedAt?: Date
}): OrchestrationSchedule {
  const orchestrationId = input.orchestrationId.trim()
  const cronExpression = input.cronExpression.trim()
  const timezone = input.timezone?.trim() || "UTC"
  const createdAt = input.createdAt ?? new Date()
  const updatedAt = input.updatedAt ?? createdAt

  if (!orchestrationId) {
    throw createOrchestrationError().invalidInput("orchestrationId is required")
  }
  if (!cronExpression) {
    throw createOrchestrationError().invalidInput(
      "schedule cronExpression is required",
    )
  }

  assertValidTimeZone(timezone)

  return {
    orchestrationId,
    enabled: input.enabled ?? true,
    cronExpression,
    timezone,
    concurrencyPolicy: input.concurrencyPolicy ?? "skip",
    taskTemplate: createOrchestrationTaskTemplate(input.taskTemplate),
    lastTriggeredAt: input.lastTriggeredAt ?? null,
    nextTriggerAt: input.nextTriggerAt ?? null,
    createdAt,
    updatedAt,
  }
}
