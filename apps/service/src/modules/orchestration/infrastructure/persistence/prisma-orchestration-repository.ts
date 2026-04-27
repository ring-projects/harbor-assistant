import type { PrismaClient } from "@prisma/client"

import type {
  OrchestrationListSurface,
  OrchestrationRepository,
} from "../../application/orchestration-repository"
import type { Orchestration } from "../../domain/orchestration"
import type { OrchestrationSchedule } from "../../domain/orchestration-schedule"
import {
  toDomainOrchestration,
  toDomainOrchestrationSchedule,
} from "./orchestration-mapper"

const orchestrationReadInclude = {
  schedule: true,
} as const

export class PrismaOrchestrationRepository implements OrchestrationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Orchestration | null> {
    const orchestration = await this.prisma.orchestration.findUnique({
      where: { id },
      include: orchestrationReadInclude,
    })

    return orchestration ? toDomainOrchestration(orchestration) : null
  }

  async listByProject(input: {
    projectId: string
    surface?: OrchestrationListSurface
  }): Promise<Orchestration[]> {
    const orchestrations = await this.prisma.orchestration.findMany({
      where: {
        projectId: input.projectId,
        ...(input.surface === "schedule"
          ? { schedule: { isNot: null } }
          : input.surface === "human-loop"
            ? { schedule: { is: null } }
            : {}),
      },
      include: orchestrationReadInclude,
      orderBy: [{ createdAt: "desc" }],
    })

    return orchestrations.map(toDomainOrchestration)
  }

  async save(orchestration: Orchestration): Promise<void> {
    await this.prisma.orchestration.upsert({
      where: { id: orchestration.id },
      create: {
        id: orchestration.id,
        projectId: orchestration.projectId,
        title: orchestration.title,
        description: orchestration.description,
        status: orchestration.status,
        archivedAt: orchestration.archivedAt,
        createdAt: orchestration.createdAt,
        updatedAt: orchestration.updatedAt,
      },
      update: {
        title: orchestration.title,
        description: orchestration.description,
        status: orchestration.status,
        archivedAt: orchestration.archivedAt,
        updatedAt: orchestration.updatedAt,
      },
    })
  }

  async findScheduleByOrchestrationId(
    orchestrationId: string,
  ): Promise<OrchestrationSchedule | null> {
    const orchestration = await this.findById(orchestrationId)
    return orchestration?.schedule ?? null
  }

  async saveSchedule(schedule: OrchestrationSchedule): Promise<void> {
    await this.prisma.orchestrationSchedule.upsert({
      where: { orchestrationId: schedule.orchestrationId },
      create: {
        orchestrationId: schedule.orchestrationId,
        enabled: schedule.enabled,
        cronExpression: schedule.cronExpression,
        timezone: schedule.timezone,
        concurrencyPolicy: schedule.concurrencyPolicy,
        taskTitle: schedule.taskTemplate.title,
        taskPrompt: schedule.taskTemplate.prompt,
        taskItems: schedule.taskTemplate.items,
        taskExecutor: schedule.taskTemplate.executor,
        taskModel: schedule.taskTemplate.model,
        taskExecutionMode: schedule.taskTemplate.executionMode,
        taskEffort: schedule.taskTemplate.effort,
        lastTriggeredAt: schedule.lastTriggeredAt,
        nextTriggerAt: schedule.nextTriggerAt,
        createdAt: schedule.createdAt,
        updatedAt: schedule.updatedAt,
      },
      update: {
        enabled: schedule.enabled,
        cronExpression: schedule.cronExpression,
        timezone: schedule.timezone,
        concurrencyPolicy: schedule.concurrencyPolicy,
        taskTitle: schedule.taskTemplate.title,
        taskPrompt: schedule.taskTemplate.prompt,
        taskItems: schedule.taskTemplate.items,
        taskExecutor: schedule.taskTemplate.executor,
        taskModel: schedule.taskTemplate.model,
        taskExecutionMode: schedule.taskTemplate.executionMode,
        taskEffort: schedule.taskTemplate.effort,
        lastTriggeredAt: schedule.lastTriggeredAt,
        nextTriggerAt: schedule.nextTriggerAt,
        updatedAt: schedule.updatedAt,
      },
    })
  }

  async listDueSchedules(input: {
    now: Date
    limit?: number
  }): Promise<OrchestrationSchedule[]> {
    const schedules = await this.prisma.orchestrationSchedule.findMany({
      where: {
        enabled: true,
        nextTriggerAt: {
          lte: input.now,
        },
        orchestration: {
          status: "active",
          archivedAt: null,
        },
      },
      orderBy: [{ nextTriggerAt: "asc" }],
      ...(input.limit === undefined ? {} : { take: input.limit }),
    })

    return schedules.map(toDomainOrchestrationSchedule)
  }
}
