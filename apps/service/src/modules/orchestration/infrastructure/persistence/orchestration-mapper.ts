import type { Orchestration as PrismaOrchestration } from "@prisma/client"

import {
  createOrchestration,
  type Orchestration,
} from "../../domain/orchestration"

export function toDomainOrchestration(
  orchestration: PrismaOrchestration,
): Orchestration {
  return createOrchestration({
    id: orchestration.id,
    projectId: orchestration.projectId,
    title: orchestration.title,
    description: orchestration.description,
    defaultPrompt: orchestration.defaultPrompt,
    defaultConfig:
      orchestration.defaultConfig &&
      typeof orchestration.defaultConfig === "object" &&
      !Array.isArray(orchestration.defaultConfig)
        ? (orchestration.defaultConfig as Record<string, unknown>)
        : null,
    status: orchestration.status,
    archivedAt: orchestration.archivedAt,
    createdAt: orchestration.createdAt,
    updatedAt: orchestration.updatedAt,
  })
}
