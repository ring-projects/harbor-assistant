import { Prisma, type PrismaClient } from "@prisma/client"

import type { BackgroundJobRepository } from "../../application/background-job-repository"
import { toDomainBackgroundJob } from "./background-job-mapper"

const ACTIVE_STATUSES = ["pending", "running"] as const

export class PrismaBackgroundJobRepository implements BackgroundJobRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async enqueue(input: Parameters<BackgroundJobRepository["enqueue"]>[0]) {
    if (input.dedupeKey?.trim()) {
      const existing = await this.prisma.backgroundJob.findFirst({
        where: {
          dedupeKey: input.dedupeKey.trim(),
          status: {
            in: [...ACTIVE_STATUSES],
          },
        },
        orderBy: [
          {
            createdAt: "desc",
          },
        ],
      })
      if (existing) {
        return toDomainBackgroundJob(existing)
      }
    }

    const created = await this.prisma.backgroundJob.create({
      data: {
        type: input.type,
        dedupeKey: input.dedupeKey?.trim() || null,
        payload: input.payload as Prisma.InputJsonValue,
        runAfter: input.runAfter ?? new Date(),
        maxAttempts: input.maxAttempts ?? 3,
      },
    })
    return toDomainBackgroundJob(created)
  }

  async claimNextRunnable(input: { workerId: string; now: Date }) {
    return this.prisma.$transaction(async (tx) => {
      const candidate = await tx.backgroundJob.findFirst({
        where: {
          status: "pending",
          runAfter: {
            lte: input.now,
          },
        },
        orderBy: [
          {
            runAfter: "asc",
          },
          {
            createdAt: "asc",
          },
        ],
      })

      if (!candidate) {
        return null
      }

      const claimed = await tx.backgroundJob.updateMany({
        where: {
          id: candidate.id,
          status: "pending",
        },
        data: {
          status: "running",
          attemptCount: {
            increment: 1,
          },
          lockedAt: input.now,
          lockedBy: input.workerId,
          lastError: null,
        },
      })

      if (claimed.count === 0) {
        return null
      }

      const record = await tx.backgroundJob.findUnique({
        where: {
          id: candidate.id,
        },
      })

      return record ? toDomainBackgroundJob(record) : null
    })
  }

  async requeueStaleRunningJobs(input: { now: Date; staleBefore: Date }) {
    const result = await this.prisma.backgroundJob.updateMany({
      where: {
        status: "running",
        lockedAt: {
          lt: input.staleBefore,
        },
      },
      data: {
        status: "pending",
        lockedAt: null,
        lockedBy: null,
        runAfter: input.now,
        lastError: "Recovered stale running job after worker interruption.",
      },
    })

    return result.count
  }

  async complete(input: { id: string; now: Date }) {
    await this.prisma.backgroundJob.update({
      where: {
        id: input.id,
      },
      data: {
        status: "completed",
        lockedAt: null,
        lockedBy: null,
        lastError: null,
        completedAt: input.now,
      },
    })
  }

  async reschedule(input: {
    id: string
    now: Date
    runAfter: Date
    error: string
  }) {
    await this.prisma.backgroundJob.update({
      where: {
        id: input.id,
      },
      data: {
        status: "pending",
        lockedAt: null,
        lockedBy: null,
        runAfter: input.runAfter,
        lastError: input.error.trim() || "Background job failed.",
        completedAt: null,
      },
    })
  }

  async fail(input: { id: string; now: Date; error: string }) {
    await this.prisma.backgroundJob.update({
      where: {
        id: input.id,
      },
      data: {
        status: "failed",
        lockedAt: null,
        lockedBy: null,
        lastError: input.error.trim() || "Background job failed.",
        completedAt: input.now,
      },
    })
  }
}
