import { createTaskUseCase } from "../../modules/task/application/create-task"
import { listOrchestrationTasksUseCase } from "../../modules/task/application/list-orchestration-tasks"
import type { ProjectTaskPort } from "../../modules/task/application/project-task-port"
import type { TaskNotificationPublisher } from "../../modules/task/application/task-notification"
import type { TaskRecordStore } from "../../modules/task/application/task-record-store"
import type { TaskRepository } from "../../modules/task/application/task-repository"
import type { TaskRuntimePort } from "../../modules/task/application/task-runtime-port"
import type { OrchestrationTaskPort } from "../../modules/orchestration/application/orchestration-task-port"

export function createOrchestrationTaskPort(args: {
  projectTaskPort: ProjectTaskPort
  taskRecordStore: TaskRecordStore
  repository: TaskRepository
  runtimePort: TaskRuntimePort
  notificationPublisher: TaskNotificationPublisher
}): OrchestrationTaskPort {
  return {
    async createTaskForOrchestration(input) {
      return createTaskUseCase(
        {
          projectTaskPort: args.projectTaskPort,
          taskRecordStore: args.taskRecordStore,
          repository: args.repository,
          runtimePort: args.runtimePort,
          notificationPublisher: args.notificationPublisher,
        },
        input,
      )
    },
    async listTasksForOrchestration(input) {
      return listOrchestrationTasksUseCase(args.repository, input)
    },
  }
}
