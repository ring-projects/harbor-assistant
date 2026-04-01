import type { Orchestration } from "../domain/orchestration"

export type OrchestrationReadModel = {
  id: string
  projectId: string
  title: string
  description: string | null
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
    status: orchestration.status,
    archivedAt: orchestration.archivedAt,
    createdAt: orchestration.createdAt,
    updatedAt: orchestration.updatedAt,
  }
}
