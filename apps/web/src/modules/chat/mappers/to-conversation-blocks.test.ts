import { describe, expect, it } from "vitest"

import type { TaskAgentEvent } from "@/modules/tasks/contracts"

import { toConversationBlocks } from "./to-conversation-blocks"

function buildTaskAgentEvent(
  overrides: Partial<TaskAgentEvent> = {},
): TaskAgentEvent {
  return {
    id: "event-1",
    taskId: "task-1",
    sequence: 1,
    eventType: "message",
    payload: {
      type: "message",
      role: "assistant",
      content: "Hello from Harbor",
      source: "codex",
      timestamp: "2026-03-11T00:00:00.000Z",
    },
    createdAt: "2026-03-11T00:00:00.000Z",
    ...overrides,
  }
}

describe("toConversationBlocks", () => {
  it("maps chat messages into message blocks", () => {
    const [block] = toConversationBlocks([
      buildTaskAgentEvent({
        id: "message-1",
        payload: {
          type: "message",
          role: "user",
          content: "Ship it",
          source: "codex",
          timestamp: "2026-03-11T00:00:00.000Z",
        },
      }),
    ])

    expect(block).toEqual({
      id: "message-1",
      type: "message",
      role: "user",
      content: "Ship it",
      timestamp: "2026-03-11T00:00:00.000Z",
    })
  })

  it("maps command output into execution blocks", () => {
    const [block] = toConversationBlocks([
      buildTaskAgentEvent({
        id: "output-1",
        eventType: "command.output",
        payload: {
          type: "command.output",
          commandId: "command-1",
          output: "bun test\nok",
          timestamp: "2026-03-11T00:00:00.000Z",
        },
      }),
    ])

    expect(block).toMatchObject({
      id: "output-1",
      type: "execution",
      label: "command.output",
      content: "bun test\nok",
      source: "command-1",
      tone: "neutral",
    })
  })

  it("maps command completion into event blocks", () => {
    const [block] = toConversationBlocks([
      buildTaskAgentEvent({
        id: "completed-1",
        eventType: "command.completed",
        payload: {
          type: "command.completed",
          commandId: "command-1",
          status: "success",
          exitCode: 0,
          timestamp: "2026-03-11T00:00:00.000Z",
        },
      }),
    ])

    expect(block).toEqual({
      id: "completed-1",
      type: "event",
      label: "command.completed",
      content: "success (exit 0)",
      timestamp: "2026-03-11T00:00:00.000Z",
      tone: "neutral",
    })
  })

  it("maps errors into error-toned event blocks", () => {
    const [block] = toConversationBlocks([
      buildTaskAgentEvent({
        id: "error-1",
        eventType: "turn.failed",
        payload: {
          type: "turn.failed",
          error: "Something failed",
          timestamp: "2026-03-11T00:00:00.000Z",
        },
      }),
    ])

    expect(block).toEqual({
      id: "error-1",
      type: "event",
      label: "turn.failed",
      content: "Something failed",
      timestamp: "2026-03-11T00:00:00.000Z",
      tone: "error",
    })
  })
})
