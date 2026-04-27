import type { Orchestration } from "../domain/orchestration"
import type { OrchestrationSchedule } from "../domain/orchestration-schedule"

export type OrchestrationListSurface = "human-loop" | "schedule"

export interface OrchestrationRepository {
  findById(id: string): Promise<Orchestration | null>
  listByProject(input: {
    projectId: string
    surface?: OrchestrationListSurface
  }): Promise<Orchestration[]>
  save(orchestration: Orchestration): Promise<void>
  findScheduleByOrchestrationId(
    orchestrationId: string,
  ): Promise<OrchestrationSchedule | null>
  saveSchedule(schedule: OrchestrationSchedule): Promise<void>
  listDueSchedules(input: {
    now: Date
    limit?: number
  }): Promise<OrchestrationSchedule[]>
}
