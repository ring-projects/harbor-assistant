import { QueryClient } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { gitQueryKeys } from "@/modules/git"
import { useTasksSessionStore } from "@/modules/tasks/store"

import { TaskSocketManager } from "./task-socket-manager"

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
    handlers.clear()
    emit.mockClear()
    socket.on.mockClear()
    useTasksSessionStore.setState({
      tasksById: {},
      taskIdsByProject: {},
      eventStreamsByTaskId: {},
      chatUiByTaskId: {},
    })
  })

  it("invalidates project git queries when a project git change event arrives", async () => {
    const manager = new TaskSocketManager()
    const queryClient = new QueryClient()
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries")

    manager.bindQueryClient(queryClient)
    manager.subscribeProjectGit("project-1")

    const handler = handlers.get("project:git_changed")
    if (!handler) {
      throw new Error("project:git_changed handler was not registered")
    }

    handler({
      projectId: "project-1",
      changedAt: "2026-03-12T04:32:44.092Z",
    })

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: gitQueryKeys.byProject("project-1"),
    })
  })

  it("removes a task from store when a task deletion event arrives", async () => {
    useTasksSessionStore.getState().hydrateProjectTasks("project-1", [
      {
        taskId: "task-1",
        projectId: "project-1",
        prompt: "Delete me",
        title: "Delete me",
        titleSource: "prompt",
        titleUpdatedAt: null,
        model: null,
        executor: "codex",
        executionMode: "connected",
        runtimePolicy: null,
        status: "completed",
        threadId: null,
        parentTaskId: null,
        archivedAt: null,
        createdAt: "2026-03-18T00:00:00.000Z",
        startedAt: null,
        finishedAt: "2026-03-18T00:01:00.000Z",
        exitCode: 0,
        command: [],
        stdout: "",
        stderr: "",
        error: null,
      },
    ])

    const manager = new TaskSocketManager()
    manager.bindQueryClient(new QueryClient())

    const handler = handlers.get("project:task_deleted")
    if (!handler) {
      throw new Error("project:task_deleted handler was not registered")
    }

    handler({
      projectId: "project-1",
      taskId: "task-1",
    })

    expect(useTasksSessionStore.getState().taskIdsByProject["project-1"]).toEqual([])
    expect(useTasksSessionStore.getState().tasksById["task-1"]).toBeUndefined()
  })
})
