import type {
  Orchestration as PrismaOrchestration,
  OrchestrationSchedule as PrismaOrchestrationSchedule,
} from "@prisma/client"

import {
  createOrchestration,
  type Orchestration,
} from "../../domain/orchestration"
import { createOrchestrationSchedule } from "../../domain/orchestration-schedule"

export function toDomainOrchestrationSchedule(
  schedule: PrismaOrchestrationSchedule,
) {
  const items = Array.isArray(schedule.taskItems) ? schedule.taskItems : []

  return createOrchestrationSchedule({
    orchestrationId: schedule.orchestrationId,
    enabled: schedule.enabled,
    cronExpression: schedule.cronExpression,
    timezone: schedule.timezone,
    concurrencyPolicy: schedule.concurrencyPolicy,
    taskTemplate: {
      title: schedule.taskTitle,
      prompt: schedule.taskPrompt,
      items: items as Parameters<
        typeof createOrchestrationSchedule
      >[0]["taskTemplate"]["items"],
      executor: schedule.taskExecutor,
      model: schedule.taskModel,
      executionMode: schedule.taskExecutionMode,
      effort: schedule.taskEffort as Parameters<
        typeof createOrchestrationSchedule
      >[0]["taskTemplate"]["effort"],
    },
    lastTriggeredAt: schedule.lastTriggeredAt,
    nextTriggerAt: schedule.nextTriggerAt,
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
  })
}

export function toDomainOrchestration(
  orchestration: PrismaOrchestration & {
    schedule?: PrismaOrchestrationSchedule | null
  },
): Orchestration {
  return createOrchestration({
    id: orchestration.id,
    projectId: orchestration.projectId,
    title: orchestration.title,
    description: orchestration.description,
    status: orchestration.status,
    archivedAt: orchestration.archivedAt,
    schedule: orchestration.schedule
      ? toDomainOrchestrationSchedule(orchestration.schedule)
      : null,
    createdAt: orchestration.createdAt,
    updatedAt: orchestration.updatedAt,
  })
}
