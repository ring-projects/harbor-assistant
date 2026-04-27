import type { BackgroundJob as PrismaBackgroundJob } from "@prisma/client"

import type { BackgroundJobRecord } from "../../domain/background-job"

export function toDomainBackgroundJob(
  record: PrismaBackgroundJob,
): BackgroundJobRecord {
  return {
    id: record.id,
    type: record.type as BackgroundJobRecord["type"],
    status: record.status as BackgroundJobRecord["status"],
    dedupeKey: record.dedupeKey,
    payload:
      record.payload &&
      typeof record.payload === "object" &&
      !Array.isArray(record.payload)
        ? (record.payload as Record<string, unknown>)
        : {},
    attemptCount: record.attemptCount,
    maxAttempts: record.maxAttempts,
    runAfter: record.runAfter,
    lockedAt: record.lockedAt,
    lockedBy: record.lockedBy,
    lastError: record.lastError,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    completedAt: record.completedAt,
  }
}
