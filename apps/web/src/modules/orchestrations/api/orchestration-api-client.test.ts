import { afterEach, describe, expect, it, vi } from "vitest"

import {
  bootstrapOrchestration,
  createOrchestration,
  readProjectOrchestrations,
  upsertOrchestrationSchedule,
} from "./orchestration-api-client"

const originalHarborApiBaseUrl = process.env.VITE_HARBOR_API_BASE_URL

describe("orchestration-api-client", () => {
  afterEach(() => {
    if (originalHarborApiBaseUrl === undefined) {
      delete process.env.VITE_HARBOR_API_BASE_URL
    } else {
      process.env.VITE_HARBOR_API_BASE_URL = originalHarborApiBaseUrl
    }

    vi.restoreAllMocks()
  })

  it("reads orchestrations using the service id contract", async () => {
    process.env.VITE_HARBOR_API_BASE_URL = "http://executor.example.com"

    const fetchMock = vi.fn().mockResolvedValue({
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
            status: "active",
            archivedAt: null,
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
        ],
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(readProjectOrchestrations("project-1")).resolves.toEqual([
      {
        id: "orch-1",
        projectId: "project-1",
        title: "Runtime cleanup",
        description: null,
        status: "active",
        archivedAt: null,
        schedule: null,
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
    ])

    expect(fetchMock).toHaveBeenCalledWith(
      "http://executor.example.com/v1/projects/project-1/orchestrations",
      expect.objectContaining({
        method: "GET",
      }),
    )
  })

  it("passes the surface filter when requested", async () => {
    process.env.VITE_HARBOR_API_BASE_URL = "http://executor.example.com"

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        orchestrations: [],
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      readProjectOrchestrations("project-1", {
        surface: "schedule",
      }),
    ).resolves.toEqual([])

    expect(fetchMock).toHaveBeenCalledWith(
      "http://executor.example.com/v1/projects/project-1/orchestrations?surface=schedule",
      expect.objectContaining({
        method: "GET",
      }),
    )
  })

  it("drops orchestration payloads that do not expose id", async () => {
    process.env.VITE_HARBOR_API_BASE_URL = "http://executor.example.com"

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
    process.env.VITE_HARBOR_API_BASE_URL = "http://executor.example.com"

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
      }),
    ).resolves.toMatchObject({
      id: "orch-created-1",
      projectId: "project-1",
      title: "Release review",
    })
  })

  it("bootstraps orchestration and initial task in one request", async () => {
    process.env.VITE_HARBOR_API_BASE_URL = "http://executor.example.com"

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        ok: true,
        orchestration: {
          id: "orch-bootstrap-1",
          projectId: "project-1",
          title: "Release review",
          description: "Coordinate the ship room",
          status: "active",
          archivedAt: null,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
        task: {
          id: "task-bootstrap-1",
          projectId: "project-1",
          orchestrationId: "orch-bootstrap-1",
          prompt: "Audit the release branch and summarize blockers.",
          title: "Audit the release branch and summarize blockers.",
          titleSource: "prompt",
          model: "gpt-5",
          executor: "codex",
          executionMode: "connected",
          effort: "medium",
          status: "queued",
          archivedAt: null,
          createdAt: "2026-04-01T00:00:00.000Z",
          startedAt: null,
          finishedAt: null,
        },
        bootstrap: {
          runtimeStarted: false,
          warning: {
            code: "TASK_RUNTIME_START_FAILED",
            message: "Runtime start failed after persistence.",
          },
        },
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      bootstrapOrchestration({
        projectId: "project-1",
        initialTask: {
          prompt: "Audit the release branch and summarize blockers.",
          model: "gpt-5",
          executor: "codex",
          executionMode: "connected",
          effort: "medium",
        },
      }),
    ).resolves.toMatchObject({
      orchestration: {
        id: "orch-bootstrap-1",
        projectId: "project-1",
      },
      task: {
        id: "task-bootstrap-1",
        orchestrationId: "orch-bootstrap-1",
      },
      bootstrap: {
        runtimeStarted: false,
        warning: {
          code: "TASK_RUNTIME_START_FAILED",
        },
      },
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "http://executor.example.com/v1/orchestrations/bootstrap",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          projectId: "project-1",
          orchestration: {},
          initialTask: {
            prompt: "Audit the release branch and summarize blockers.",
            model: "gpt-5",
            executor: "codex",
            executionMode: "connected",
            effort: "medium",
          },
        }),
      }),
    )
  })

  it("updates a session schedule and returns the normalized schedule payload", async () => {
    process.env.VITE_HARBOR_API_BASE_URL = "http://executor.example.com"

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        orchestration: {
          id: "orch-1",
          projectId: "project-1",
          title: "Release review",
          description: null,
          status: "active",
          archivedAt: null,
          schedule: {
            orchestrationId: "orch-1",
            enabled: true,
            cronExpression: "0 9 * * mon-fri",
            timezone: "Asia/Shanghai",
            concurrencyPolicy: "skip",
            taskTemplate: {
              title: null,
              prompt: "Check the release branch.",
              items: [],
              executor: "codex",
              model: "gpt-5.3-codex",
              executionMode: "full-access",
              effort: "medium",
            },
            lastTriggeredAt: null,
            nextTriggerAt: "2026-04-18T01:00:00.000Z",
            createdAt: "2026-04-18T00:00:00.000Z",
            updatedAt: "2026-04-18T00:05:00.000Z",
          },
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-18T00:05:00.000Z",
        },
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      upsertOrchestrationSchedule({
        orchestrationId: "orch-1",
        enabled: true,
        cronExpression: "0 9 * * mon-fri",
        timezone: "Asia/Shanghai",
        taskTemplate: {
          prompt: "Check the release branch.",
          executor: "codex",
          model: "gpt-5.3-codex",
          executionMode: "full-access",
          effort: "medium",
        },
      }),
    ).resolves.toMatchObject({
      id: "orch-1",
      schedule: {
        enabled: true,
        cronExpression: "0 9 * * mon-fri",
        timezone: "Asia/Shanghai",
        taskTemplate: {
          executionMode: "full-access",
        },
      },
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "http://executor.example.com/v1/orchestrations/orch-1/schedule",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          enabled: true,
          cronExpression: "0 9 * * mon-fri",
          timezone: "Asia/Shanghai",
          concurrencyPolicy: "skip",
          taskTemplate: {
            prompt: "Check the release branch.",
            executor: "codex",
            model: "gpt-5.3-codex",
            executionMode: "full-access",
            effort: "medium",
          },
        }),
      }),
    )
  })
})
