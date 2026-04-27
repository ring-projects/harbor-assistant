import type {
  BackgroundJobRecord,
  BackgroundJobType,
} from "../domain/background-job"

export interface BackgroundJobRepository {
  enqueue(input: {
    type: BackgroundJobType
    dedupeKey?: string | null
    payload: Record<string, unknown>
    runAfter?: Date
    maxAttempts?: number
  }): Promise<BackgroundJobRecord>

  claimNextRunnable(input: {
    workerId: string
    now: Date
  }): Promise<BackgroundJobRecord | null>

  requeueStaleRunningJobs(input: {
    now: Date
    staleBefore: Date
  }): Promise<number>

  complete(input: { id: string; now: Date }): Promise<void>

  reschedule(input: {
    id: string
    now: Date
    runAfter: Date
    error: string
  }): Promise<void>

  fail(input: { id: string; now: Date; error: string }): Promise<void>
}
