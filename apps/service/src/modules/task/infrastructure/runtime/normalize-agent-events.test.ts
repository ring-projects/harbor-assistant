import { describe, expect, it } from "vitest"

import {
  applyNormalizedTaskEvents,
  createSyntheticCancelledEvent,
  createSyntheticCancelRequestedEvent,
  createSyntheticUserInputEvent,
  createTaskRunEventState,
  normalizeRawAgentEvent,
} from "./normalize-agent-events"

describe("normalizeRawAgentEvent", () => {
  it("normalizes codex command execution and session events", () => {
    const state = createTaskRunEventState()

    const sessionEvents = normalizeRawAgentEvent({
      envelope: {
        agentType: "codex",
        createdAt: new Date("2026-03-25T00:00:00.000Z"),
        event: {
          type: "thread.started",
          thread_id: "session-1",
        },
      },
      state,
    })
    expect(sessionEvents).toEqual([
      {
        eventType: "session.started",
        payload: {
          sessionId: "session-1",
          timestamp: "2026-03-25T00:00:00.000Z",
        },
        createdAt: new Date("2026-03-25T00:00:00.000Z"),
      },
    ])

    const commandEvents = normalizeRawAgentEvent({
      envelope: {
        agentType: "codex",
        createdAt: new Date("2026-03-25T00:00:01.000Z"),
        event: {
          type: "item.completed",
          item: {
            type: "command_execution",
            id: "cmd-1",
            command: "ls",
            aggregated_output: "file-a\n",
            status: "completed",
            exit_code: 0,
          },
        },
      },
      state,
    })

    expect(commandEvents).toEqual([
      {
        eventType: "command.output",
        payload: {
          commandId: "cmd-1",
          output: "file-a\n",
          timestamp: "2026-03-25T00:00:01.000Z",
        },
        createdAt: new Date("2026-03-25T00:00:01.000Z"),
      },
      {
        eventType: "command.completed",
        payload: {
          commandId: "cmd-1",
          exitCode: 0,
          status: "success",
          timestamp: "2026-03-25T00:00:01.000Z",
        },
        createdAt: new Date("2026-03-25T00:00:01.000Z"),
      },
    ])
  })

  it("keeps codex command output as the provider snapshot", () => {
    const firstEvents = normalizeRawAgentEvent({
      envelope: {
        agentType: "codex",
        createdAt: new Date("2026-03-25T00:00:01.000Z"),
        event: {
          type: "item.updated",
          item: {
            type: "command_execution",
            id: "cmd-1",
            command: "ls",
            aggregated_output: "file-a\n",
            status: "in_progress",
          },
        },
      },
      state: createTaskRunEventState(),
    })

    const secondEvents = normalizeRawAgentEvent({
      envelope: {
        agentType: "codex",
        createdAt: new Date("2026-03-25T00:00:02.000Z"),
        event: {
          type: "item.updated",
          item: {
            type: "command_execution",
            id: "cmd-1",
            command: "ls",
            aggregated_output: "file-a\nfile-b\n",
            status: "in_progress",
          },
        },
      },
      state: createTaskRunEventState(),
    })

    expect(firstEvents).toEqual([
      {
        eventType: "command.output",
        payload: {
          commandId: "cmd-1",
          output: "file-a\n",
          timestamp: "2026-03-25T00:00:01.000Z",
        },
        createdAt: new Date("2026-03-25T00:00:01.000Z"),
      },
    ])
    expect(secondEvents).toEqual([
      {
        eventType: "command.output",
        payload: {
          commandId: "cmd-1",
          output: "file-a\nfile-b\n",
          timestamp: "2026-03-25T00:00:02.000Z",
        },
        createdAt: new Date("2026-03-25T00:00:02.000Z"),
      },
    ])
  })

  it("preserves codex todo list lifecycle events", () => {
    const startedEvents = normalizeRawAgentEvent({
      envelope: {
        agentType: "codex",
        createdAt: new Date("2026-03-25T00:00:03.000Z"),
        event: {
          type: "item.started",
          item: {
            type: "todo_list",
            id: "todo-1",
            items: [{ text: "A", completed: false }],
          },
        },
      },
      state: createTaskRunEventState(),
    })

    const updatedEvents = normalizeRawAgentEvent({
      envelope: {
        agentType: "codex",
        createdAt: new Date("2026-03-25T00:00:04.000Z"),
        event: {
          type: "item.updated",
          item: {
            type: "todo_list",
            id: "todo-1",
            items: [
              { text: "A", completed: true },
              { text: "B", completed: false },
            ],
          },
        },
      },
      state: createTaskRunEventState(),
    })

    const completedEvents = normalizeRawAgentEvent({
      envelope: {
        agentType: "codex",
        createdAt: new Date("2026-03-25T00:00:05.000Z"),
        event: {
          type: "item.completed",
          item: {
            type: "todo_list",
            id: "todo-1",
            items: [
              { text: "A", completed: true },
              { text: "B", completed: true },
            ],
          },
        },
      },
      state: createTaskRunEventState(),
    })

    expect(startedEvents).toEqual([
      {
        eventType: "todo_list.started",
        payload: {
          todoListId: "todo-1",
          items: [{ text: "A", completed: false }],
          timestamp: "2026-03-25T00:00:03.000Z",
        },
        createdAt: new Date("2026-03-25T00:00:03.000Z"),
      },
    ])
    expect(updatedEvents).toEqual([
      {
        eventType: "todo_list.updated",
        payload: {
          todoListId: "todo-1",
          items: [
            { text: "A", completed: true },
            { text: "B", completed: false },
          ],
          timestamp: "2026-03-25T00:00:04.000Z",
        },
        createdAt: new Date("2026-03-25T00:00:04.000Z"),
      },
    ])
    expect(completedEvents).toEqual([
      {
        eventType: "todo_list.completed",
        payload: {
          todoListId: "todo-1",
          items: [
            { text: "A", completed: true },
            { text: "B", completed: true },
          ],
          timestamp: "2026-03-25T00:00:05.000Z",
        },
        createdAt: new Date("2026-03-25T00:00:05.000Z"),
      },
    ])
  })

  it("normalizes claude assistant/tool events", () => {
    const events = normalizeRawAgentEvent({
      envelope: {
        agentType: "claude-code",
        createdAt: new Date("2026-03-25T00:00:00.000Z"),
        event: {
          type: "assistant",
          message: {
            content: [
              {
                type: "thinking",
                thinking: "first think",
              },
              {
                type: "tool_use",
                id: "tool-1",
                name: "bash",
                input: {
                  command: "pwd",
                },
              },
              {
                type: "tool_result",
                tool_use_id: "tool-1",
                content: "workspace\n",
                is_error: false,
              },
              {
                type: "text",
                text: "done",
              },
            ],
          },
        },
      },
      state: createTaskRunEventState(),
    })

    expect(events.map((event) => event.eventType)).toEqual([
      "reasoning",
      "command.started",
      "command.output",
      "command.completed",
      "message",
    ])
  })

  it("creates synthetic cancel events with stable payloads", () => {
    const requestedAt = new Date("2026-03-29T00:00:00.000Z")
    const cancelledAt = new Date("2026-03-29T00:00:01.000Z")

    expect(
      createSyntheticCancelRequestedEvent({
        reason: "User requested stop",
        createdAt: requestedAt,
      }),
    ).toEqual({
      eventType: "harbor.cancel_requested",
      payload: {
        reason: "User requested stop",
        requestedBy: "user",
        timestamp: "2026-03-29T00:00:00.000Z",
      },
      createdAt: requestedAt,
    })

    expect(
      createSyntheticCancelledEvent({
        reason: "User requested stop",
        forced: true,
        createdAt: cancelledAt,
      }),
    ).toEqual({
      eventType: "harbor.cancelled",
      payload: {
        reason: "User requested stop",
        requestedBy: "user",
        forced: true,
        timestamp: "2026-03-29T00:00:01.000Z",
      },
      createdAt: cancelledAt,
    })
  })
})

describe("task run event state", () => {
  it("tracks session id and terminal errors from normalized events", () => {
    const state = applyNormalizedTaskEvents(createTaskRunEventState(), [
      {
        eventType: "session.started",
        payload: {
          sessionId: "session-1",
        },
        createdAt: new Date("2026-03-25T00:00:00.000Z"),
      },
      {
        eventType: "turn.failed",
        payload: {
          error: "boom",
        },
        createdAt: new Date("2026-03-25T00:00:02.000Z"),
      },
    ])

    expect(state.sessionId).toBe("session-1")
    expect(state.terminalError).toBe("boom")
    expect(state.hasTerminalErrorEvent).toBe(true)
  })

  it("creates a synthetic user input event", () => {
    expect(
      createSyntheticUserInputEvent({
        input: "Investigate runtime drift",
        createdAt: new Date("2026-03-25T00:00:00.000Z"),
      }),
    ).toEqual({
      eventType: "message",
      payload: {
        role: "user",
        content: "Investigate runtime drift",
        summary: "Investigate runtime drift",
        input: "Investigate runtime drift",
        source: "user_input",
        timestamp: "2026-03-25T00:00:00.000Z",
      },
      createdAt: new Date("2026-03-25T00:00:00.000Z"),
    })
  })

  it("creates a structured user input event with attachments", () => {
    expect(
      createSyntheticUserInputEvent({
        input: [
          {
            type: "text",
            text: "Review this screenshot",
          },
          {
            type: "local_image",
            path: ".harbor/task-input-images/example.png",
          },
        ],
        createdAt: new Date("2026-03-25T00:00:00.000Z"),
      }),
    ).toEqual({
      eventType: "message",
      payload: {
        role: "user",
        content: "Review this screenshot",
        summary: "Review this screenshot",
        input: [
          {
            type: "text",
            text: "Review this screenshot",
          },
          {
            type: "local_image",
            path: ".harbor/task-input-images/example.png",
          },
        ],
        attachments: [
          {
            type: "local_image",
            path: ".harbor/task-input-images/example.png",
          },
        ],
        source: "user_input",
        timestamp: "2026-03-25T00:00:00.000Z",
      },
      createdAt: new Date("2026-03-25T00:00:00.000Z"),
    })
  })
})
