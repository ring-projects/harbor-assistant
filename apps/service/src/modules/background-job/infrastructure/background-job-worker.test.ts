import { describe, expect, it, vi } from "vitest"

import type { BackgroundJobRepository } from "../application/background-job-repository"
import type { BackgroundJobRecord } from "../domain/background-job"
import { createBackgroundJobWorker } from "./background-job-worker"

function createRepositoryStub() {
  const completed: string[] = []
  const rescheduled: string[] = []
  const failed: string[] = []
  let claimed = false

  const repository: BackgroundJobRepository = {
    enqueue: vi.fn(),
    claimNextRunnable: vi.fn(async (): Promise<BackgroundJobRecord | null> => {
      if (claimed) {
        return null
      }
      claimed = true
      return {
        id: "job-1",
        type: "project_sandbox_template_bootstrap",
        status: "running",
        dedupeKey: "project-sandbox-template:project-1",
        payload: {
          projectId: "project-1",
        },
        attemptCount: 1,
        maxAttempts: 3,
        runAfter: new Date("2026-04-21T00:00:00.000Z"),
        lockedAt: new Date("2026-04-21T00:00:00.000Z"),
        lockedBy: "worker-1",
        lastError: null,
        createdAt: new Date("2026-04-21T00:00:00.000Z"),
        updatedAt: new Date("2026-04-21T00:00:00.000Z"),
        completedAt: null,
      }
    }),
    requeueStaleRunningJobs: vi.fn(async () => 0),
    complete: vi.fn(async ({ id }) => {
      completed.push(id)
    }),
    reschedule: vi.fn(async ({ id }) => {
      rescheduled.push(id)
    }),
    fail: vi.fn(async ({ id }) => {
      failed.push(id)
    }),
  }

  return {
    repository,
    completed,
    rescheduled,
    failed,
  }
}

describe("Background job worker", () => {
  it("claims and completes jobs through registered handlers", async () => {
    const repo = createRepositoryStub()
    const worker = createBackgroundJobWorker({
      repository: repo.repository,
      handlers: {
        project_sandbox_template_bootstrap: vi.fn(async () => {}),
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      intervalMs: 60_000,
      workerId: "worker-1",
    })

    worker.start()
    await new Promise((resolve) => setTimeout(resolve, 10))
    await worker.stop()

    expect(repo.completed).toEqual(["job-1"])
    expect(repo.rescheduled).toEqual([])
    expect(repo.failed).toEqual([])
  })
})
