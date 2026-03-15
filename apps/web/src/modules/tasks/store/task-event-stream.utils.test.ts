import { describe, expect, it } from "vitest"

import type { TaskAgentEventStream } from "@/modules/tasks/contracts"

import {
  mergeTaskAgentEvent,
  mergeTaskEventStreams,
} from "./task-event-stream.utils"

function buildStream(
  overrides: Partial<TaskAgentEventStream> = {},
): TaskAgentEventStream {
  return {
    taskId: "task-1",
    items: [
      {
        id: "event-1",
        taskId: "task-1",
        sequence: 1,
        eventType: "message",
        payload: {
          type: "message",
          role: "user",
          content: "hello",
        },
        createdAt: "2026-03-13T00:00:00.000Z",
      },
    ],
    nextSequence: 1,
    ...overrides,
  }
}

describe("task-event-stream.utils", () => {
  it("merges fetched history with newer socket events already in state", () => {
    const current = mergeTaskAgentEvent(buildStream(), {
      id: "event-2",
      taskId: "task-1",
      sequence: 2,
      eventType: "message",
      payload: {
        type: "message",
        role: "assistant",
        content: "live reply",
      },
      createdAt: "2026-03-13T00:00:01.000Z",
    })

    const merged = mergeTaskEventStreams(
      current,
      buildStream({
        items: [buildStream().items[0]],
        nextSequence: 1,
      }),
    )

    expect(merged).toEqual({
      taskId: "task-1",
      items: [current.items[0], current.items[1]],
      nextSequence: 2,
    })
  })

  it("deduplicates identical events by id", () => {
    const base = buildStream()
    const merged = mergeTaskEventStreams(base, base)

    expect(merged).toEqual(base)
  })
})
