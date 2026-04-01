import type { TaskRecord } from "../../task/application/task-read-models"
import { isTerminalTaskStatus } from "../../task/domain/task"
import type { Orchestration } from "../domain/orchestration"
import {
  toOrchestrationListItem,
  type OrchestrationDetail,
  type OrchestrationListItem,
} from "./orchestration-read-models"

export function buildOrchestrationListItem(
  orchestration: Orchestration,
  tasks: TaskRecord[],
): OrchestrationListItem {
  const latestTask = tasks[0] ?? null
  const activeTaskCount = tasks.filter(
    (task) => task.archivedAt === null && !isTerminalTaskStatus(task.status),
  ).length

  return toOrchestrationListItem({
    orchestration,
    taskCount: tasks.length,
    activeTaskCount,
    latestTaskSummary: latestTask?.title ?? null,
    latestTaskUpdatedAt: latestTask?.updatedAt ?? null,
  })
}

export function buildOrchestrationDetail(
  orchestration: Orchestration,
  tasks: TaskRecord[],
): OrchestrationDetail {
  return buildOrchestrationListItem(orchestration, tasks)
}
