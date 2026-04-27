import { randomUUID } from "node:crypto"

import type { BackgroundJobRepository } from "../application/background-job-repository"
import type {
  BackgroundJobRecord,
  BackgroundJobType,
} from "../domain/background-job"

const DEFAULT_INTERVAL_MS = 5_000
const DEFAULT_BATCH_SIZE = 10
const DEFAULT_LOCK_TIMEOUT_MS = 60_000

type BackgroundJobHandler = (job: BackgroundJobRecord) => Promise<void>

type BackgroundJobWorkerLogger = {
  info(payload: Record<string, unknown> | string, message?: string): void
  warn(payload: Record<string, unknown> | string, message?: string): void
  error(payload: Record<string, unknown> | string, message?: string): void
}

function computeRetryDelayMs(attemptCount: number) {
  return Math.min(60_000, Math.max(1, attemptCount) * 5_000)
}

export function createBackgroundJobWorker(args: {
  repository: BackgroundJobRepository
  handlers: Partial<Record<BackgroundJobType, BackgroundJobHandler>>
  logger: BackgroundJobWorkerLogger
  intervalMs?: number
  batchSize?: number
  lockTimeoutMs?: number
  now?: () => Date
  workerId?: string
}) {
  let timer: NodeJS.Timeout | null = null
  let running = false
  const workerId = args.workerId ?? `harbor-worker-${randomUUID()}`

  async function processJob(job: BackgroundJobRecord) {
    const handler = args.handlers[job.type]
    const now = args.now?.() ?? new Date()

    if (!handler) {
      await args.repository.fail({
        id: job.id,
        now,
        error: `No background job handler registered for type "${job.type}".`,
      })
      args.logger.error(
        {
          jobId: job.id,
          type: job.type,
        },
        "Failed background job because no handler was registered",
      )
      return
    }

    try {
      await handler(job)
      await args.repository.complete({
        id: job.id,
        now,
      })
      args.logger.info(
        {
          jobId: job.id,
          type: job.type,
          attemptCount: job.attemptCount,
        },
        "Completed background job",
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (job.attemptCount < job.maxAttempts) {
        const runAfter = new Date(
          now.getTime() + computeRetryDelayMs(job.attemptCount),
        )
        await args.repository.reschedule({
          id: job.id,
          now,
          runAfter,
          error: message,
        })
        args.logger.warn(
          {
            jobId: job.id,
            type: job.type,
            attemptCount: job.attemptCount,
            maxAttempts: job.maxAttempts,
            runAfter: runAfter.toISOString(),
            error,
          },
          "Rescheduled background job after failure",
        )
        return
      }

      await args.repository.fail({
        id: job.id,
        now,
        error: message,
      })
      args.logger.error(
        {
          jobId: job.id,
          type: job.type,
          attemptCount: job.attemptCount,
          maxAttempts: job.maxAttempts,
          error,
        },
        "Failed background job permanently",
      )
    }
  }

  async function tick() {
    if (running) {
      return
    }

    running = true
    try {
      const now = args.now?.() ?? new Date()
      const recovered = await args.repository.requeueStaleRunningJobs({
        now,
        staleBefore: new Date(
          now.getTime() - (args.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS),
        ),
      })
      if (recovered > 0) {
        args.logger.warn(
          {
            count: recovered,
            workerId,
          },
          "Recovered stale background jobs",
        )
      }

      for (
        let index = 0;
        index < (args.batchSize ?? DEFAULT_BATCH_SIZE);
        index += 1
      ) {
        const job = await args.repository.claimNextRunnable({
          workerId,
          now: args.now?.() ?? new Date(),
        })

        if (!job) {
          break
        }

        await processJob(job)
      }
    } finally {
      running = false
    }
  }

  return {
    start() {
      if (timer) {
        return
      }

      timer = setInterval(() => {
        void tick()
      }, args.intervalMs ?? DEFAULT_INTERVAL_MS)
      void tick()
    },
    async stop() {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    },
  }
}
