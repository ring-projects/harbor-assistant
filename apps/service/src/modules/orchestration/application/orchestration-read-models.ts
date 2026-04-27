import type { Orchestration } from "../domain/orchestration"
import type { TaskEffort } from "../../task"

export type OrchestrationScheduleReadModel = {
  orchestrationId: string
  enabled: boolean
  cronExpression: string
  timezone: string
  concurrencyPolicy: "skip"
  taskTemplate: {
    title: string | null
    prompt: string | null
    items: Orchestration["schedule"] extends infer T
      ? T extends { taskTemplate: { items: infer I } }
        ? I
        : never
      : never
    executor: string
    model: string
    executionMode: string
    effort: TaskEffort
  }
  lastTriggeredAt: Date | null
  nextTriggerAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type OrchestrationReadModel = {
  id: string
  projectId: string
  title: string
  description: string | null
  status: Orchestration["status"]
  archivedAt: Date | null
  schedule: OrchestrationScheduleReadModel | null
  createdAt: Date
  updatedAt: Date
}

function toOrchestrationScheduleReadModel(
  schedule: NonNullable<Orchestration["schedule"]>,
): OrchestrationScheduleReadModel {
  return {
    orchestrationId: schedule.orchestrationId,
    enabled: schedule.enabled,
    cronExpression: schedule.cronExpression,
    timezone: schedule.timezone,
    concurrencyPolicy: schedule.concurrencyPolicy,
    taskTemplate: {
      title: schedule.taskTemplate.title,
      prompt: schedule.taskTemplate.prompt,
      items: schedule.taskTemplate.items,
      executor: schedule.taskTemplate.executor,
      model: schedule.taskTemplate.model,
      executionMode: schedule.taskTemplate.executionMode,
      effort: schedule.taskTemplate.effort,
    },
    lastTriggeredAt: schedule.lastTriggeredAt,
    nextTriggerAt: schedule.nextTriggerAt,
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
  }
}

export function toOrchestrationReadModel(
  orchestration: Orchestration,
): OrchestrationReadModel {
  return {
    id: orchestration.id,
    projectId: orchestration.projectId,
    title: orchestration.title,
    description: orchestration.description,
    status: orchestration.status,
    archivedAt: orchestration.archivedAt,
    schedule: orchestration.schedule
      ? toOrchestrationScheduleReadModel(orchestration.schedule)
      : null,
    createdAt: orchestration.createdAt,
    updatedAt: orchestration.updatedAt,
  }
}
