import type { Orchestration } from "../domain/orchestration"

export interface OrchestrationRepository {
  findById(id: string): Promise<Orchestration | null>
  listByProject(projectId: string): Promise<Orchestration[]>
  save(orchestration: Orchestration): Promise<void>
}
