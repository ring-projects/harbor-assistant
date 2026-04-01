import { afterEach, describe, expect, it, vi } from "vitest"

import {
  cancelTask,
  createTask,
  deleteTask,
  resumeTask,
  uploadTaskInputImage,
} from "./task-api-client"

const originalExecutorApiBaseUrl = process.env.NEXT_PUBLIC_EXECUTOR_API_BASE_URL

describe("task-api-client", () => {
  afterEach(() => {
    if (originalExecutorApiBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_EXECUTOR_API_BASE_URL
    } else {
      process.env.NEXT_PUBLIC_EXECUTOR_API_BASE_URL = originalExecutorApiBaseUrl
    }

    vi.restoreAllMocks()
  })

  it("sends structured task input on create", async () => {
    process.env.NEXT_PUBLIC_EXECUTOR_API_BASE_URL = "http://executor.example.com"

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        ok: true,
        task: {
          id: "task-1",
          projectId: "project-1",
          prompt: "Review this screenshot",
          title: "Review this screenshot",
          status: "queued",
          createdAt: "2026-03-28T00:00:00.000Z",
        },
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await createTask({
      projectId: "project-1",
      orchestrationId: "orch-1",
      input: {
        items: [
          {
            type: "text",
            text: "Review this screenshot",
          },
          {
            type: "local_image",
            path: ".harbor/task-input-images/example.png",
          },
        ],
        executor: "codex",
        model: "gpt-5.3-codex",
        executionMode: "connected",
        effort: "medium",
      },
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
    })
    expect(
      JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)),
    ).toMatchObject({
      projectId: "project-1",
      orchestrationId: "orch-1",
      items: [
        {
          type: "text",
          text: "Review this screenshot",
        },
        {
          type: "local_image",
          path: ".harbor/task-input-images/example.png",
        },
      ],
      executor: "codex",
      model: "gpt-5.3-codex",
      executionMode: "connected",
      effort: "medium",
    })
  })

  it("sends structured task input on resume", async () => {
    process.env.NEXT_PUBLIC_EXECUTOR_API_BASE_URL = "http://executor.example.com"

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        task: {
          id: "task-1",
          projectId: "project-1",
          prompt: "Ship it",
          title: "Ship it",
          status: "running",
          createdAt: "2026-03-28T00:00:00.000Z",
        },
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await resumeTask("task-1", {
      items: [
        {
          type: "local_image",
          path: ".harbor/task-input-images/example.png",
        },
      ],
    })

    expect(
      JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)),
    ).toEqual({
      items: [
        {
          type: "local_image",
          path: ".harbor/task-input-images/example.png",
        },
      ],
    })
  })

  it("serializes resume runtime overrides including explicit null resets", async () => {
    process.env.NEXT_PUBLIC_EXECUTOR_API_BASE_URL = "http://executor.example.com"

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        task: {
          id: "task-1",
          projectId: "project-1",
          prompt: "Ship it",
          title: "Ship it",
          status: "running",
          createdAt: "2026-03-28T00:00:00.000Z",
        },
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await resumeTask("task-1", {
      prompt: "Continue with runtime defaults.",
      model: null,
      effort: null,
    })

    expect(
      JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)),
    ).toEqual({
      prompt: "Continue with runtime defaults.",
      model: null,
      effort: null,
    })
  })

  it("calls the cancel endpoint and returns the updated task", async () => {
    process.env.NEXT_PUBLIC_EXECUTOR_API_BASE_URL = "http://executor.example.com"

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        task: {
          id: "task-1",
          projectId: "project-1",
          prompt: "Ship it",
          title: "Ship it",
          status: "cancelled",
          createdAt: "2026-03-28T00:00:00.000Z",
        },
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const task = await cancelTask("task-1", {
      reason: "User requested stop",
    })

    expect(task.status).toBe("cancelled")
    expect(fetchMock).toHaveBeenCalledWith(
      "http://executor.example.com/v1/tasks/task-1/cancel",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          reason: "User requested stop",
        }),
      }),
    )
  })

  it("uploads a task input image as base64 payload", async () => {
    process.env.NEXT_PUBLIC_EXECUTOR_API_BASE_URL = "http://executor.example.com"

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        path: ".harbor/task-input-images/example.png",
        mediaType: "image/png",
        name: "example.png",
        size: 4,
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const file = new File([new Uint8Array([1, 2, 3, 4])], "example.png", {
      type: "image/png",
    })

    const uploaded = await uploadTaskInputImage("project-1", {
      file,
    })

    expect(uploaded).toEqual({
      path: ".harbor/task-input-images/example.png",
      mediaType: "image/png",
      name: "example.png",
      size: 4,
    })
    expect(
      JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)),
    ).toMatchObject({
      name: "example.png",
      mediaType: "image/png",
      dataBase64: "AQIDBA==",
    })
  })

  it("deletes a task and returns task/project ids", async () => {
    process.env.NEXT_PUBLIC_EXECUTOR_API_BASE_URL = "http://executor.example.com"

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        taskId: "task-1",
        projectId: "project-1",
        orchestrationId: "orch-1",
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await deleteTask("task-1")

    expect(result).toEqual({
      taskId: "task-1",
      projectId: "project-1",
      orchestrationId: "orch-1",
    })
    expect(fetchMock).toHaveBeenCalledWith(
      "http://executor.example.com/v1/tasks/task-1",
      expect.objectContaining({
        method: "DELETE",
      }),
    )
  })
})
