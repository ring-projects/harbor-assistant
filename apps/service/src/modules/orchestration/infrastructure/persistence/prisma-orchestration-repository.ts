import type { PrismaClient } from "@prisma/client"

import type { OrchestrationRepository } from "../../application/orchestration-repository"
import type { Orchestration } from "../../domain/orchestration"
import { toDomainOrchestration } from "./orchestration-mapper"

export class PrismaOrchestrationRepository implements OrchestrationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Orchestration | null> {
    const orchestration = await this.prisma.orchestration.findUnique({
      where: { id },
    })

    return orchestration ? toDomainOrchestration(orchestration) : null
  }

  async listByProject(projectId: string): Promise<Orchestration[]> {
    const orchestrations = await this.prisma.orchestration.findMany({
      where: { projectId },
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
}
