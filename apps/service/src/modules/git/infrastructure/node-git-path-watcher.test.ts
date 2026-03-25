import { EventEmitter } from "node:events"

import { describe, expect, it, vi } from "vitest"

import { createNodeGitPathWatcher } from "./node-git-path-watcher"

class FakeFsWatcher extends EventEmitter {
  close = vi.fn()
}

describe("createNodeGitPathWatcher", () => {
  it("shares one filesystem watcher per path and broadcasts debounced changes", async () => {
    const created: FakeFsWatcher[] = []
    const createFsWatcher = vi.fn(
      (
        _path: string,
        _options: { persistent?: boolean; recursive?: boolean },
        listener: (eventType: string, filename: string | Buffer | null) => void,
      ) => {
        const watcher = new FakeFsWatcher()
        watcher.on("change", listener)
        created.push(watcher)
        return watcher as never
      },
    )

    const watcher = createNodeGitPathWatcher({
      createFsWatcher,
      debounceMs: 0,
      now: () => new Date("2026-03-25T00:00:00.000Z"),
    })

    const firstListener = vi.fn()
    const secondListener = vi.fn()
    const stopFirst = await watcher.subscribe("/tmp/project", firstListener)
    const stopSecond = await watcher.subscribe("/tmp/project", secondListener)

    expect(createFsWatcher).toHaveBeenCalledTimes(1)

    created[0]?.emit("change", "change", "file.txt")

    expect(firstListener).toHaveBeenCalledWith({
      path: "/tmp/project",
      changedAt: "2026-03-25T00:00:00.000Z",
    })
    expect(secondListener).toHaveBeenCalledWith({
      path: "/tmp/project",
      changedAt: "2026-03-25T00:00:00.000Z",
    })

    await stopFirst()
    expect(created[0]?.close).not.toHaveBeenCalled()

    await stopSecond()
    expect(created[0]?.close).toHaveBeenCalledTimes(1)
  })

  it("closes all active watchers on lifecycle shutdown", async () => {
    const created: FakeFsWatcher[] = []
    const createFsWatcher = vi.fn(
      (
        _path: string,
        _options: { persistent?: boolean; recursive?: boolean },
        listener: (eventType: string, filename: string | Buffer | null) => void,
      ) => {
        const watcher = new FakeFsWatcher()
        watcher.on("change", listener)
        created.push(watcher)
        return watcher as never
      },
    )

    const watcher = createNodeGitPathWatcher({
      createFsWatcher,
    })

    await watcher.subscribe("/tmp/project-a", vi.fn())
    await watcher.subscribe("/tmp/project-b", vi.fn())

    await watcher.close?.()

    expect(created).toHaveLength(2)
    expect(created[0]?.close).toHaveBeenCalledTimes(1)
    expect(created[1]?.close).toHaveBeenCalledTimes(1)
  })
})
