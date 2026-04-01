import type { OrchestrationRepository } from "../application/orchestration-repository"
import type { Orchestration } from "../domain/orchestration"

export class InMemoryOrchestrationRepository implements OrchestrationRepository {
  private readonly orchestrations = new Map<string, Orchestration>()

  constructor(seed: Orchestration[] = []) {
    for (const orchestration of seed) {
      this.orchestrations.set(orchestration.id, orchestration)
    }
  }

  async findById(id: string): Promise<Orchestration | null> {
    return this.orchestrations.get(id) ?? null
  }

  async listByProject(projectId: string): Promise<Orchestration[]> {
    return [...this.orchestrations.values()]
      .filter((orchestration) => orchestration.projectId === projectId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
  }

  async save(orchestration: Orchestration): Promise<void> {
    this.orchestrations.set(orchestration.id, orchestration)
  }
}
