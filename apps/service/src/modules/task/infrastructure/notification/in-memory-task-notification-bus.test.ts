import { describe, expect, it, vi } from "vitest"

import { createInMemoryTaskNotificationBus } from "./in-memory-task-notification-bus"

describe("in-memory task notification bus", () => {
  it("publishes notifications to project and task subscribers", async () => {
    const bus = createInMemoryTaskNotificationBus()
    const projectListener = vi.fn()
    const taskListener = vi.fn()

    const unsubscribeProject = bus.subscriber.subscribe({
      projectId: "project-1",
      listener: projectListener,
    })
    const unsubscribeTask = bus.subscriber.subscribe({
      taskId: "task-1",
      listener: taskListener,
    })

    await bus.publisher.publish({
      type: "task_upserted",
      projectId: "project-1",
      task: {
        id: "task-1",
        projectId: "project-1",
        title: "Investigate runtime drift",
        status: "queued",
        archivedAt: null,
        createdAt: new Date("2026-03-25T00:00:00.000Z"),
        updatedAt: new Date("2026-03-25T00:00:00.000Z"),
        startedAt: null,
        finishedAt: null,
      },
    })

    expect(projectListener).toHaveBeenCalledOnce()
    expect(taskListener).toHaveBeenCalledOnce()

    unsubscribeProject()
    unsubscribeTask()
  })
})
