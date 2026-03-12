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
  it("hides lifecycle events from the chat stream", () => {
    const blocks = toConversationBlocks([
      buildTaskAgentEvent({
        id: "turn-started-1",
        eventType: "turn.started",
        payload: {
          type: "turn.started",
          timestamp: "2026-03-11T00:00:00.000Z",
        },
      }),
      buildTaskAgentEvent({
        id: "turn-completed-1",
        eventType: "turn.completed",
        payload: {
          type: "turn.completed",
          timestamp: "2026-03-11T00:00:01.000Z",
        },
      }),
      buildTaskAgentEvent({
        id: "session-completed-1",
        eventType: "session.completed",
        payload: {
          type: "session.completed",
          timestamp: "2026-03-11T00:00:02.000Z",
        },
      }),
    ])

    expect(blocks).toEqual([])
  })

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

  it("maps command output into command group blocks", () => {
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
      type: "command-group",
      commandId: "command-1",
      output: "bun test\nok",
      status: "running",
    })
  })

  it("maps command completion into command group blocks", () => {
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
      type: "command-group",
      commandId: "command-1",
      command: "Command command-1",
      output: "",
      startedAt: null,
      completedAt: "2026-03-11T00:00:00.000Z",
      timestamp: "2026-03-11T00:00:00.000Z",
      status: "success",
      exitCode: 0,
    })
  })

  it("maps web search into execution blocks", () => {
    const [block] = toConversationBlocks([
      buildTaskAgentEvent({
        id: "search-1",
        eventType: "web_search.started",
        payload: {
          type: "web_search.started",
          searchId: "search-1",
          query: "codex sdk events",
          timestamp: "2026-03-11T00:00:00.000Z",
        },
      }),
    ])

    expect(block).toMatchObject({
      id: "search-1",
      type: "execution",
      label: "web_search.started",
      content: "codex sdk events",
      source: "search-1",
      tone: "neutral",
    })
  })

  it("maps file changes and MCP tool calls into execution blocks", () => {
    const blocks = toConversationBlocks([
      buildTaskAgentEvent({
        id: "file-change-1",
        eventType: "file_change",
        payload: {
          type: "file_change",
          changeId: "patch-1",
          status: "success",
          changes: [
            {
              path: "src/app.ts",
              kind: "update",
            },
          ],
          timestamp: "2026-03-11T00:00:00.000Z",
        },
      }),
      buildTaskAgentEvent({
        id: "mcp-1",
        eventType: "mcp_tool_call.completed",
        payload: {
          type: "mcp_tool_call.completed",
          callId: "mcp-1",
          server: "context7",
          tool: "query-docs",
          status: "failed",
          arguments: {
            libraryId: "/openai/codex",
          },
          error: "tool failed",
          timestamp: "2026-03-11T00:00:01.000Z",
        },
      }),
    ])

    expect(blocks[0]).toMatchObject({
      id: "file-change-1",
      type: "execution",
      label: "file_change",
      source: "patch-1",
      tone: "success",
    })
    expect(blocks[1]).toMatchObject({
      id: "mcp-1",
      type: "execution",
      label: "mcp_tool_call.completed",
      source: "context7.query-docs",
      tone: "error",
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
