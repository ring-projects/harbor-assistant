import { describe, expect, it, vi } from "vitest"

import { createProjectGitWatcher } from "./project-git-watcher.service"

function createProject(projectPath: string) {
  return {
    id: "project-1",
    name: "Project 1",
    slug: "project-1",
    rootPath: projectPath,
    normalizedPath: projectPath,
    description: null,
    status: "active" as const,
    lastOpenedAt: null,
    createdAt: new Date("2026-03-12T00:00:00.000Z"),
    updatedAt: new Date("2026-03-12T00:00:00.000Z"),
    archivedAt: null,
    path: projectPath,
  }
}

function createFakeWatcher() {
  const listeners = new Map<string, Set<() => void>>()
  const fakeWatcher = {
    on: vi.fn((eventName: string, listener: () => void) => {
      const existing = listeners.get(eventName) ?? new Set<() => void>()
      existing.add(listener)
      listeners.set(eventName, existing)
      return fakeWatcher as never
    }),
    close: vi.fn(async () => {}),
    emit(eventName: string) {
      for (const listener of listeners.get(eventName) ?? []) {
        listener()
      }
    },
  }

  return fakeWatcher
}

describe("createProjectGitWatcher", () => {
  it("emits a debounced project change event when the workspace changes", async () => {
    vi.useFakeTimers()

    const watcher = createFakeWatcher()
    const watchFactory = vi.fn(() => watcher as never)
    const listener = vi.fn()
    const projectRepository = {
      getProjectById: vi.fn(async () => createProject("/tmp/project-1")),
    }

    const projectGitWatcher = createProjectGitWatcher({
      projectRepository,
      watchFactory,
    })

    await projectGitWatcher.subscribe("project-1", listener)

    watcher.emit("change")
    watcher.emit("change")

    vi.advanceTimersByTime(249)
    expect(listener).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project-1",
      }),
    )

    vi.useRealTimers()
  })

  it("closes the watcher after the last subscriber unsubscribes", async () => {
    const watcher = createFakeWatcher()
    const watchFactory = vi.fn(() => watcher as never)
    const projectRepository = {
      getProjectById: vi.fn(async () => createProject("/tmp/project-1")),
    }

    const projectGitWatcher = createProjectGitWatcher({
      projectRepository,
      watchFactory,
    })

    const unsubscribe = await projectGitWatcher.subscribe("project-1", vi.fn())
    await unsubscribe()

    expect(watcher.close).toHaveBeenCalledTimes(1)
  })
})
