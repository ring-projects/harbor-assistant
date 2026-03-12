import { QueryClient } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { gitQueryKeys } from "@/modules/git"

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
})
