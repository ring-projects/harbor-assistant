import { QueryClient } from "@tanstack/react-query"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import { useTasksSessionStore } from "@/modules/tasks/store"
import { gitQueryKeys } from "@/modules/git"

import { TaskSocketManager } from "./task-socket-manager"

const originalExecutorApiBaseUrl = process.env.NEXT_PUBLIC_EXECUTOR_API_BASE_URL
const handlers = new Map<string, (payload: unknown) => void>()
const emit = vi.fn()
const socket = {
  emit,
  on: vi.fn((eventName: string, handler: (payload: unknown) => void) => {
    handlers.set(eventName, handler)
  }),
}

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => socket),
}))

describe("TaskSocketManager", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_EXECUTOR_API_BASE_URL = "http://127.0.0.1:3400"
    handlers.clear()
    emit.mockClear()
    socket.on.mockClear()
    useTasksSessionStore.setState({
      tasksById: {},
      taskIdsByOrchestration: {},
      eventStreamsByTaskId: {},
      chatUiByTaskId: {},
    })
  })

  afterAll(() => {
    if (originalExecutorApiBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_EXECUTOR_API_BASE_URL
      return
    }

    process.env.NEXT_PUBLIC_EXECUTOR_API_BASE_URL = originalExecutorApiBaseUrl
  })

  it("invalidates project git queries when a project git change event arrives", async () => {
    const manager = new TaskSocketManager()
    const queryClient = new QueryClient()
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries")

    manager.bindQueryClient(queryClient)
    manager.subscribeProjectGit("project-1")

    const handler = handlers.get("interaction:message")
    if (!handler) {
      throw new Error("interaction:message handler was not registered")
    }

    handler({
      topic: {
        kind: "project-git",
        id: "project-1",
      },
      message: {
        kind: "event",
        name: "project_git_changed",
        data: {
          projectId: "project-1",
          changedAt: "2026-03-12T04:32:44.092Z",
        },
      },
    })

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: gitQueryKeys.byProject("project-1"),
    })
  })

  it("removes a task from store when a task deletion event arrives", async () => {
    useTasksSessionStore.getState().hydrateOrchestrationTasks("orch-1", [
      {
        taskId: "task-1",
        projectId: "project-1",
        orchestrationId: "orch-1",
        prompt: "Delete me",
        title: "Delete me",
        titleSource: "prompt",
        model: null,
        executor: "codex",
        executionMode: "connected",
        effort: null,
        status: "completed",
        archivedAt: null,
        createdAt: "2026-03-18T00:00:00.000Z",
        startedAt: null,
        finishedAt: "2026-03-18T00:01:00.000Z",
      },
    ])

    const manager = new TaskSocketManager()
    manager.bindQueryClient(new QueryClient())

    const handler = handlers.get("interaction:message")
    if (!handler) {
      throw new Error("interaction:message handler was not registered")
    }

    handler({
      topic: {
        kind: "task",
        id: "task-1",
      },
      message: {
        kind: "event",
        name: "task_deleted",
        data: {
          orchestrationId: "orch-1",
          taskId: "task-1",
        },
      },
    })

    expect(useTasksSessionStore.getState().taskIdsByOrchestration["orch-1"]).toEqual([])
    expect(useTasksSessionStore.getState().tasksById["task-1"]).toBeUndefined()
  })

  it("replays task event subscriptions with the last seen sequence on reconnect", () => {
    useTasksSessionStore.getState().hydrateTaskEvents("task-1", {
      taskId: "task-1",
      items: [
        {
          id: "event-1",
          taskId: "task-1",
          sequence: 42,
          eventType: "turn.started",
          createdAt: "2026-03-18T00:00:00.000Z",
          payload: {},
        },
      ],
      nextSequence: 42,
    })

    const manager = new TaskSocketManager()
    manager.bindQueryClient(new QueryClient())
    manager.subscribeTaskEvents("task-1")

    emit.mockClear()

    const connectHandler = handlers.get("connect")
    if (!connectHandler) {
      throw new Error("connect handler was not registered")
    }

    connectHandler({})

    expect(emit).toHaveBeenCalledWith("interaction:subscribe", {
      topic: {
        kind: "task-events",
        id: "task-1",
      },
      afterSequence: 42,
      limit: 500,
    })
  })
})
