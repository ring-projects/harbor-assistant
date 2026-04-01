import type { Orchestration } from "../domain/orchestration"

export type OrchestrationListItem = {
  id: string
  projectId: string
  title: string
  description: string | null
  initPrompt: string | null
  config: Record<string, unknown> | null
  status: Orchestration["status"]
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
  taskCount: number
  activeTaskCount: number
  latestTaskSummary: string | null
  latestTaskUpdatedAt: Date | null
}

export type OrchestrationDetail = OrchestrationListItem

export function toOrchestrationListItem(args: {
  orchestration: Orchestration
  taskCount: number
  activeTaskCount: number
  latestTaskSummary: string | null
  latestTaskUpdatedAt: Date | null
}): OrchestrationListItem {
  return {
    id: args.orchestration.id,
    projectId: args.orchestration.projectId,
    title: args.orchestration.title,
    description: args.orchestration.description,
    initPrompt: args.orchestration.initPrompt,
    config: args.orchestration.config
      ? structuredClone(args.orchestration.config)
      : null,
    status: args.orchestration.status,
    archivedAt: args.orchestration.archivedAt,
    createdAt: args.orchestration.createdAt,
    updatedAt: args.orchestration.updatedAt,
    taskCount: args.taskCount,
    activeTaskCount: args.activeTaskCount,
    latestTaskSummary: args.latestTaskSummary,
    latestTaskUpdatedAt: args.latestTaskUpdatedAt,
  }
}
