import { assertOrchestrationIsActive } from "../domain/orchestration"
import {
  createOrchestrationSchedule,
  type OrchestrationConcurrencyPolicy,
} from "../domain/orchestration-schedule"
import { createOrchestrationError } from "../errors"
import { resolveNextCronOccurrence } from "./orchestration-cron"
import { toOrchestrationReadModel } from "./orchestration-read-models"
import type { OrchestrationRepository } from "./orchestration-repository"
import type { AgentInputItem } from "../../../lib/agents"
import type { TaskEffort } from "../../task"

export async function upsertOrchestrationScheduleUseCase(
  args: {
    repository: Pick<OrchestrationRepository, "findById" | "saveSchedule">
    now?: () => Date
  },
  input: {
    orchestrationId: string
    enabled: boolean
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
  },
) {
  const orchestrationId = input.orchestrationId.trim()
  if (!orchestrationId) {
    throw createOrchestrationError().invalidInput("orchestrationId is required")
  }

  const orchestration = await args.repository.findById(orchestrationId)
  if (!orchestration) {
    throw createOrchestrationError().notFound()
  }

  assertOrchestrationIsActive(orchestration)

  const now = args.now?.() ?? new Date()
  const schedule = createOrchestrationSchedule({
    orchestrationId,
    enabled: input.enabled,
    cronExpression: input.cronExpression,
    timezone: input.timezone,
    concurrencyPolicy: input.concurrencyPolicy,
    taskTemplate: input.taskTemplate,
    createdAt: orchestration.schedule?.createdAt ?? now,
    updatedAt: now,
    lastTriggeredAt: orchestration.schedule?.lastTriggeredAt ?? null,
    nextTriggerAt: input.enabled
      ? resolveNextCronOccurrence({
          cronExpression: input.cronExpression,
          timezone: input.timezone?.trim() || "UTC",
          after: now,
        })
      : null,
  })

  await args.repository.saveSchedule(schedule)

  return toOrchestrationReadModel({
    ...orchestration,
    schedule,
  })
}
