import { resolveAgentInput } from "../../task/domain/task-input"
import type { ProjectTaskPort } from "../../task/application/project-task-port"
import type { TaskNotificationPublisher } from "../../task/application/task-notification"
import type { TaskRecordStore } from "../../task/application/task-record-store"
import type { TaskRepository } from "../../task/application/task-repository"
import type { TaskRuntimePort } from "../../task/application/task-runtime-port"
import { createOrchestrationTaskUseCase } from "./create-orchestration-task"
import { resolveNextCronOccurrence } from "./orchestration-cron"
import type { OrchestrationRepository } from "./orchestration-repository"

const ACTIVE_TASK_STATUSES = new Set(["queued", "running"])

type OrchestrationSchedulerLogger = {
  info(payload: Record<string, unknown>, message: string): void
  error(payload: Record<string, unknown>, message: string): void
}

export async function runDueOrchestrationSchedulesUseCase(args: {
  repository: Pick<
    OrchestrationRepository,
    "findById" | "listDueSchedules" | "saveSchedule"
  >
  taskRepository: Pick<
    TaskRepository,
    "listByOrchestration" | "findById" | "save"
  > &
    TaskRecordStore
  projectTaskPort: ProjectTaskPort
  runtimePort: TaskRuntimePort
  notificationPublisher: TaskNotificationPublisher
  logger: OrchestrationSchedulerLogger
  now?: () => Date
  limit?: number
}) {
  const now = args.now?.() ?? new Date()
  const schedules = await args.repository.listDueSchedules({
    now,
    limit: args.limit,
  })

  for (const schedule of schedules) {
    const orchestration = await args.repository.findById(
      schedule.orchestrationId,
    )
    if (
      !orchestration ||
      !orchestration.schedule ||
      !orchestration.schedule.enabled
    ) {
      continue
    }

    const nextTriggerAt = resolveNextCronOccurrence({
      cronExpression: orchestration.schedule.cronExpression,
      timezone: orchestration.schedule.timezone,
      after: now,
    })

    if (orchestration.schedule.concurrencyPolicy === "skip") {
      const latestTasks = await args.taskRepository.listByOrchestration({
        orchestrationId: orchestration.id,
        includeArchived: false,
        limit: 1,
      })
      const latestTask = latestTasks[0]

      if (latestTask && ACTIVE_TASK_STATUSES.has(latestTask.status)) {
        await args.repository.saveSchedule({
          ...orchestration.schedule,
          nextTriggerAt,
          updatedAt: now,
        })
        args.logger.info(
          {
            orchestrationId: orchestration.id,
            scheduleNextTriggerAt: nextTriggerAt.toISOString(),
            activeTaskId: latestTask.id,
          },
          "Skipped orchestration cron trigger because a task is already active",
        )
        continue
      }
    }

    try {
      const taskInput = resolveAgentInput({
        prompt: orchestration.schedule.taskTemplate.prompt,
        items: orchestration.schedule.taskTemplate.items,
      })

      if (!taskInput) {
        throw new Error("schedule task input is required")
      }

      const task = await createOrchestrationTaskUseCase(
        {
          repository: args.repository,
          projectTaskPort: args.projectTaskPort,
          taskRepository: args.taskRepository,
          runtimePort: args.runtimePort,
          notificationPublisher: args.notificationPublisher,
        },
        {
          orchestrationId: orchestration.id,
          title: orchestration.schedule.taskTemplate.title ?? undefined,
          prompt: typeof taskInput === "string" ? taskInput : undefined,
          items: Array.isArray(taskInput) ? taskInput : undefined,
          executor: orchestration.schedule.taskTemplate.executor,
          model: orchestration.schedule.taskTemplate.model,
          executionMode: orchestration.schedule.taskTemplate.executionMode,
          effort: orchestration.schedule.taskTemplate.effort,
        },
      )

      await args.repository.saveSchedule({
        ...orchestration.schedule,
        lastTriggeredAt: now,
        nextTriggerAt,
        updatedAt: now,
      })
      args.logger.info(
        {
          orchestrationId: orchestration.id,
          taskId: task.id,
          scheduleNextTriggerAt: nextTriggerAt.toISOString(),
        },
        "Triggered orchestration cron task",
      )
    } catch (error) {
      await args.repository.saveSchedule({
        ...orchestration.schedule,
        nextTriggerAt,
        updatedAt: now,
      })
      args.logger.error(
        {
          error,
          orchestrationId: orchestration.id,
          scheduleNextTriggerAt: nextTriggerAt.toISOString(),
        },
        "Failed to trigger orchestration cron task",
      )
    }
  }
}
