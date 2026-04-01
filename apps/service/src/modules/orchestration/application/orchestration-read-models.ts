import type { Orchestration } from "../domain/orchestration"

export type OrchestrationReadModel = {
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
}

export function toOrchestrationReadModel(
  orchestration: Orchestration,
): OrchestrationReadModel {
  return {
    id: orchestration.id,
    projectId: orchestration.projectId,
    title: orchestration.title,
    description: orchestration.description,
    initPrompt: orchestration.initPrompt,
    config: orchestration.config
      ? structuredClone(orchestration.config)
      : null,
    status: orchestration.status,
    archivedAt: orchestration.archivedAt,
    createdAt: orchestration.createdAt,
    updatedAt: orchestration.updatedAt,
  }
}
