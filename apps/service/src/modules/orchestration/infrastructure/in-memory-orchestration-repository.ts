import type {
  OrchestrationListSurface,
  OrchestrationRepository,
} from "../application/orchestration-repository"
import type { Orchestration } from "../domain/orchestration"
import type { OrchestrationSchedule } from "../domain/orchestration-schedule"

export class InMemoryOrchestrationRepository implements OrchestrationRepository {
  private readonly orchestrations = new Map<string, Orchestration>()
  private readonly schedules = new Map<string, OrchestrationSchedule>()

  constructor(seed: Orchestration[] = []) {
    for (const orchestration of seed) {
      this.orchestrations.set(orchestration.id, orchestration)
      if (orchestration.schedule) {
        this.schedules.set(orchestration.id, orchestration.schedule)
      }
    }
  }

  async findById(id: string): Promise<Orchestration | null> {
    const orchestration = this.orchestrations.get(id)

    if (!orchestration) {
      return null
    }

    return {
      ...orchestration,
      schedule: this.schedules.get(id) ?? null,
    }
  }

  async listByProject(input: {
    projectId: string
    surface?: OrchestrationListSurface
  }): Promise<Orchestration[]> {
    return [...this.orchestrations.values()]
      .filter((orchestration) => orchestration.projectId === input.projectId)
      .filter((orchestration) => {
        const schedule =
          this.schedules.get(orchestration.id) ?? orchestration.schedule ?? null

        if (input.surface === "schedule") {
          return schedule !== null
        }

        if (input.surface === "human-loop") {
          return schedule === null
        }

        return true
      })
      .map((orchestration) => ({
        ...orchestration,
        schedule: this.schedules.get(orchestration.id) ?? null,
      }))
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      )
  }

  async save(orchestration: Orchestration): Promise<void> {
    this.orchestrations.set(orchestration.id, {
      ...orchestration,
      schedule:
        this.schedules.get(orchestration.id) ?? orchestration.schedule ?? null,
    })
  }

  async findScheduleByOrchestrationId(
    orchestrationId: string,
  ): Promise<OrchestrationSchedule | null> {
    return this.schedules.get(orchestrationId) ?? null
  }

  async saveSchedule(schedule: OrchestrationSchedule): Promise<void> {
    this.schedules.set(schedule.orchestrationId, schedule)
    const orchestration = this.orchestrations.get(schedule.orchestrationId)

    if (orchestration) {
      this.orchestrations.set(schedule.orchestrationId, {
        ...orchestration,
        schedule,
      })
    }
  }

  async listDueSchedules(input: {
    now: Date
    limit?: number
  }): Promise<OrchestrationSchedule[]> {
    const dueSchedules = [...this.schedules.values()]
      .filter((schedule) => schedule.enabled && schedule.nextTriggerAt !== null)
      .filter(
        (schedule) => schedule.nextTriggerAt!.getTime() <= input.now.getTime(),
      )
      .sort(
        (left, right) =>
          left.nextTriggerAt!.getTime() - right.nextTriggerAt!.getTime(),
      )

    if (input.limit === undefined) {
      return dueSchedules
    }

    return dueSchedules.slice(0, input.limit)
  }
}
