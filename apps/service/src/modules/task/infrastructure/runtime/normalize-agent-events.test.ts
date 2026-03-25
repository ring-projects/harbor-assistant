import { describe, expect, it } from "vitest"

import {
  applyNormalizedTaskEvents,
  createSyntheticUserPromptEvent,
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
})

describe("task run event state", () => {
  it("tracks session id, stdout, and terminal errors from normalized events", () => {
    const state = applyNormalizedTaskEvents(createTaskRunEventState(), [
      {
        eventType: "session.started",
        payload: {
          sessionId: "session-1",
        },
        createdAt: new Date("2026-03-25T00:00:00.000Z"),
      },
      {
        eventType: "command.output",
        payload: {
          output: "hello\n",
        },
        createdAt: new Date("2026-03-25T00:00:01.000Z"),
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
    expect(state.stdout).toBe("hello\n")
    expect(state.terminalError).toBe("boom")
    expect(state.hasTerminalErrorEvent).toBe(true)
  })

  it("creates a synthetic user prompt event", () => {
    expect(
      createSyntheticUserPromptEvent({
        content: "Investigate runtime drift",
        createdAt: new Date("2026-03-25T00:00:00.000Z"),
      }),
    ).toEqual({
      eventType: "message",
      payload: {
        role: "user",
        content: "Investigate runtime drift",
        source: "user_prompt",
        timestamp: "2026-03-25T00:00:00.000Z",
      },
      createdAt: new Date("2026-03-25T00:00:00.000Z"),
    })
  })
})
