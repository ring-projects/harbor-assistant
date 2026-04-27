import type { PrismaClient } from "@prisma/client"

import type {
  CreateBootstrapRecordInput,
  OrchestrationBootstrapStore,
} from "../../application/orchestration-bootstrap-store"

export class PrismaOrchestrationBootstrapStore implements OrchestrationBootstrapStore {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateBootstrapRecordInput): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.orchestration.create({
        data: {
          id: input.orchestration.id,
          projectId: input.orchestration.projectId,
          title: input.orchestration.title,
          description: input.orchestration.description,
          status: input.orchestration.status,
          archivedAt: input.orchestration.archivedAt,
          createdAt: input.orchestration.createdAt,
          updatedAt: input.orchestration.updatedAt,
        },
      })

      await tx.task.create({
        data: {
          id: input.task.id,
          projectId: input.task.projectId,
          orchestrationId: input.task.orchestrationId,
          prompt: input.task.prompt,
          title: input.task.title,
          titleSource: input.task.titleSource,
          status: input.task.status,
          archivedAt: input.task.archivedAt,
          createdAt: input.task.createdAt,
          updatedAt: input.task.updatedAt,
          startedAt: input.task.startedAt,
          finishedAt: input.task.finishedAt,
        },
      })

      await tx.execution.create({
        data: {
          ownerType: "task",
          ownerId: input.task.id,
          executorType: input.runtimeConfig.executor,
          executorModel: input.runtimeConfig.model,
          executionMode: input.runtimeConfig.executionMode,
          executorEffort: input.runtimeConfig.effort,
          workingDirectory: input.projectPath,
          status: "queued",
          createdAt: input.task.createdAt,
          updatedAt: input.task.updatedAt,
        },
      })
    })
  }
}
