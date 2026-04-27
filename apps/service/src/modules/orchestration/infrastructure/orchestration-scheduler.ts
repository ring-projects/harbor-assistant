import type { ProjectTaskPort } from "../../task/application/project-task-port"
import type { TaskNotificationPublisher } from "../../task/application/task-notification"
import type { TaskRecordStore } from "../../task/application/task-record-store"
import type { TaskRepository } from "../../task/application/task-repository"
import type { TaskRuntimePort } from "../../task/application/task-runtime-port"
import { runDueOrchestrationSchedulesUseCase } from "../application/run-due-orchestration-schedules"
import type { OrchestrationRepository } from "../application/orchestration-repository"

const DEFAULT_SCHEDULER_INTERVAL_MS = 30_000
const DEFAULT_SCHEDULER_BATCH_SIZE = 25

type OrchestrationSchedulerLogger = {
  info(payload: Record<string, unknown> | string, message?: string): void
  error(payload: Record<string, unknown> | string, message?: string): void
}

export function createOrchestrationScheduler(args: {
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
  intervalMs?: number
  batchSize?: number
}) {
  let timer: NodeJS.Timeout | null = null
  let running = false

  async function tick() {
    if (running) {
      return
    }

    running = true
    try {
      await runDueOrchestrationSchedulesUseCase({
        repository: args.repository,
        taskRepository: args.taskRepository,
        projectTaskPort: args.projectTaskPort,
        runtimePort: args.runtimePort,
        notificationPublisher: args.notificationPublisher,
        logger: args.logger,
        limit: args.batchSize ?? DEFAULT_SCHEDULER_BATCH_SIZE,
      })
    } finally {
      running = false
    }
  }

  return {
    start() {
      if (timer) {
        return
      }

      timer = setInterval(() => {
        void tick()
      }, args.intervalMs ?? DEFAULT_SCHEDULER_INTERVAL_MS)

      void tick()
    },
    async stop() {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    },
  }
}
