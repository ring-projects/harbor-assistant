import { afterEach, describe, expect, it, vi } from "vitest"

import {
  cancelTask,
  createTask,
  deleteTask,
  resumeTask,
  uploadTaskInputImage,
} from "./task-api-client"

const originalHarborApiBaseUrl = process.env.VITE_HARBOR_API_BASE_URL

describe("task-api-client", () => {
  afterEach(() => {
    if (originalHarborApiBaseUrl === undefined) {
      delete process.env.VITE_HARBOR_API_BASE_URL
    } else {
      process.env.VITE_HARBOR_API_BASE_URL = originalHarborApiBaseUrl
    }

    vi.restoreAllMocks()
  })

  it("sends structured task input on create", async () => {
    process.env.VITE_HARBOR_API_BASE_URL = "http://executor.example.com"

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        ok: true,
        task: {
          id: "task-1",
          projectId: "project-1",
          orchestrationId: "orch-1",
          prompt: "Review this screenshot",
          title: "Review this screenshot",
          status: "queued",
          createdAt: "2026-03-28T00:00:00.000Z",
        },
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await createTask({
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

    expect(result.id).toBe("task-1")

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
    process.env.VITE_HARBOR_API_BASE_URL = "http://executor.example.com"

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        task: {
          id: "task-1",
          projectId: "project-1",
          orchestrationId: "orch-1",
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

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      items: [
        {
          type: "local_image",
          path: ".harbor/task-input-images/example.png",
        },
      ],
    })
  })

  it("serializes resume runtime overrides including explicit null resets", async () => {
    process.env.VITE_HARBOR_API_BASE_URL = "http://executor.example.com"

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        task: {
          id: "task-1",
          projectId: "project-1",
          orchestrationId: "orch-1",
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

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      prompt: "Continue with runtime defaults.",
      model: null,
      effort: null,
    })
  })

  it("calls the cancel endpoint and returns the updated task", async () => {
    process.env.VITE_HARBOR_API_BASE_URL = "http://executor.example.com"

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        task: {
          id: "task-1",
          projectId: "project-1",
          orchestrationId: "orch-1",
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

  it("uploads a task input attachment as base64 payload", async () => {
    process.env.VITE_HARBOR_API_BASE_URL = "http://executor.example.com"

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
    expect(fetchMock).toHaveBeenCalledWith(
      "http://executor.example.com/v1/projects/project-1/task-input-files",
      expect.any(Object),
    )
  })

  it("infers media type for markdown attachments from file extension", async () => {
    process.env.VITE_HARBOR_API_BASE_URL = "http://executor.example.com"

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        path: ".harbor/task-input-files/spec.md",
        mediaType: "text/markdown",
        name: "spec.md",
        size: 11,
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const file = new File(["hello world"], "spec.md")

    await uploadTaskInputImage("project-1", {
      file,
    })

    expect(
      JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)),
    ).toMatchObject({
      name: "spec.md",
      mediaType: "text/markdown",
    })
  })

  it("rejects unsupported task input attachment types before uploading", async () => {
    process.env.VITE_HARBOR_API_BASE_URL = "http://executor.example.com"

    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const file = new File(["svg"], "example.svg", {
      type: "image/svg+xml",
    })

    await expect(
      uploadTaskInputImage("project-1", {
        file,
      }),
    ).rejects.toMatchObject({
      message:
        "Only PNG, JPEG, WebP, GIF, PDF, TXT, Markdown, CSV, JSON, and YAML files are supported.",
      status: 400,
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects task input attachments larger than 10MB before uploading", async () => {
    process.env.VITE_HARBOR_API_BASE_URL = "http://executor.example.com"

    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.png", {
      type: "image/png",
    })

    await expect(
      uploadTaskInputImage("project-1", {
        file,
      }),
    ).rejects.toMatchObject({
      message: "File payload exceeds 10MB limit.",
      status: 400,
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("deletes a task and returns task/project ids", async () => {
    process.env.VITE_HARBOR_API_BASE_URL = "http://executor.example.com"

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
