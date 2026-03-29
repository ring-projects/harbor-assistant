import { describe, expect, it } from "vitest"

import {
  extractSingleTask,
  extractTaskEvents,
  extractTaskList,
} from "./task-payload"

describe("task-payload", () => {
  it("extracts task lists from envelope variants", () => {
    const tasks = extractTaskList({
      data: [
        {
          task_id: "task-1",
          project_id: "project-1",
          prompt: "Ship it",
          title: "Ship it",
          status: "running",
          createdAt: "2026-03-18T10:00:00.000Z",
        },
      ],
    })

    expect(tasks).toEqual([
      {
        taskId: "task-1",
        projectId: "project-1",
        prompt: "Ship it",
        title: "Ship it",
        titleSource: "prompt",
        model: null,
        executor: null,
        executionMode: null,
        effort: null,
        status: "running",
        archivedAt: null,
        createdAt: "2026-03-18T10:00:00.000Z",
        startedAt: null,
        finishedAt: null,
      },
    ])
  })

  it("extracts task effort when present", () => {
    const task = extractSingleTask({
      task: {
        id: "task-2",
        projectId: "project-2",
        prompt: "Hello",
        title: "Hello",
        effort: "high",
        status: "queued",
        createdAt: "2026-03-18T10:00:00.000Z",
      },
    })

    expect(task?.effort).toBe("high")
  })

  it("extracts a single task from task envelopes", () => {
    const task = extractSingleTask({
      task: {
        id: "task-2",
        projectId: "project-2",
        prompt: "Hello",
        title: "Hello",
        status: "queued",
        createdAt: "2026-03-18T10:00:00.000Z",
      },
    })

    expect(task?.taskId).toBe("task-2")
    expect(task?.projectId).toBe("project-2")
    expect(task?.status).toBe("queued")
  })

  it("extracts normalized task event streams with fallback task ids", () => {
    const stream = extractTaskEvents(
      {
        events: {
          items: [
            {
              id: "event-1",
              sequence: 1,
              eventType: "message",
              payload: {
                role: "assistant",
                content: "Done",
              },
              createdAt: "2026-03-18T10:05:00.000Z",
            },
          ],
        },
      },
      {
        fallbackTaskId: "task-3",
      },
    )

    expect(stream).toEqual({
      taskId: "task-3",
      items: [
        {
          id: "event-1",
          taskId: "task-3",
          sequence: 1,
          eventType: "message",
          payload: {
            role: "assistant",
            content: "Done",
          },
          createdAt: "2026-03-18T10:05:00.000Z",
        },
      ],
      nextSequence: 1,
    })
  })
})
