import { afterEach, describe, expect, it, vi } from "vitest"

import {
  createOrchestration,
  readProjectOrchestrations,
} from "./orchestration-api-client"

const originalExecutorApiBaseUrl = process.env.NEXT_PUBLIC_EXECUTOR_API_BASE_URL

describe("orchestration-api-client", () => {
  afterEach(() => {
    if (originalExecutorApiBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_EXECUTOR_API_BASE_URL
    } else {
      process.env.NEXT_PUBLIC_EXECUTOR_API_BASE_URL = originalExecutorApiBaseUrl
    }

    vi.restoreAllMocks()
  })

  it("reads orchestrations using the service id contract", async () => {
    process.env.NEXT_PUBLIC_EXECUTOR_API_BASE_URL = "http://executor.example.com"

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          orchestrations: [
            {
              id: "orch-1",
              projectId: "project-1",
              title: "Runtime cleanup",
              description: null,
              initPrompt: null,
              config: null,
              status: "active",
              archivedAt: null,
              createdAt: "2026-04-01T00:00:00.000Z",
              updatedAt: "2026-04-01T00:00:00.000Z",
            },
          ],
        }),
      }),
    )

    await expect(readProjectOrchestrations("project-1")).resolves.toEqual([
      {
        id: "orch-1",
        projectId: "project-1",
        title: "Runtime cleanup",
        description: null,
        initPrompt: null,
        config: null,
        status: "active",
        archivedAt: null,
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
    ])
  })

  it("drops orchestration payloads that do not expose id", async () => {
    process.env.NEXT_PUBLIC_EXECUTOR_API_BASE_URL = "http://executor.example.com"

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          orchestrations: [
            {
              orchestrationId: "orch-legacy",
              projectId: "project-1",
              title: "Legacy payload",
              status: "active",
              createdAt: "2026-04-01T00:00:00.000Z",
              updatedAt: "2026-04-01T00:00:00.000Z",
            },
          ],
        }),
      }),
    )

    await expect(readProjectOrchestrations("project-1")).resolves.toEqual([])
  })

  it("creates orchestrations and returns the normalized id field", async () => {
    process.env.NEXT_PUBLIC_EXECUTOR_API_BASE_URL = "http://executor.example.com"

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          ok: true,
          orchestration: {
            id: "orch-created-1",
            projectId: "project-1",
            title: "Release review",
            description: null,
            initPrompt: null,
            config: null,
            status: "active",
            archivedAt: null,
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
        }),
      }),
    )

    await expect(
      createOrchestration({
        projectId: "project-1",
        title: "Release review",
      }),
    ).resolves.toMatchObject({
      id: "orch-created-1",
      projectId: "project-1",
      title: "Release review",
    })
  })
})
