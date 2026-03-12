import { describe, expect, it, vi } from "vitest"

import { handleProjectGitSubscription } from "./task-socket.gateway"

describe("handleProjectGitSubscription", () => {
  it("registers project git subscriptions and forwards watcher events", async () => {
    const emit = vi.fn()
    const unsubscribeProjectGitById = new Map<string, () => void>()
    const listenerRef: {
      current: ((event: { projectId: string; changedAt: string }) => void) | null
    } = {
      current: null,
    }

    await handleProjectGitSubscription({
      socket: {
        emit,
      },
      payload: {
        projectId: "project-1",
      },
      unsubscribeProjectGitById,
      projectGitWatcher: {
        subscribe: vi.fn(async (_projectId, listener) => {
          listenerRef.current = listener
          return async () => {}
        }),
      },
    })

    expect(emit).toHaveBeenCalledWith("project-git:ready", {
      projectId: "project-1",
    })

    if (!listenerRef.current) {
      throw new Error("Expected project git listener to be registered")
    }

    listenerRef.current({
      projectId: "project-1",
      changedAt: "2026-03-12T04:32:44.092Z",
    })

    expect(emit).toHaveBeenCalledWith("project:git_changed", {
      projectId: "project-1",
      changedAt: "2026-03-12T04:32:44.092Z",
    })
    expect(unsubscribeProjectGitById.has("project-1")).toBe(true)
  })
})
