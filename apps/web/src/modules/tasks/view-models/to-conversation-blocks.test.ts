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

  it("renders user structured input with local image attachments", () => {
    const [block] = toConversationBlocks([
      buildTaskAgentEvent({
        id: "message-structured-1",
        payload: {
          type: "message",
          role: "user",
          content: "Review this screenshot",
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
          source: "user_input",
          timestamp: "2026-03-11T00:00:00.000Z",
        },
      }),
    ])

    expect(block).toEqual({
      id: "message-structured-1",
      type: "message",
      role: "user",
      content: "Review this screenshot",
      attachments: [
        {
          type: "local_image",
          path: ".harbor/task-input-images/example.png",
        },
      ],
      timestamp: "2026-03-11T00:00:00.000Z",
    })
  })

  it("renders attachment-only user input as message attachments without inline path text", () => {
    const [block] = toConversationBlocks([
      buildTaskAgentEvent({
        id: "message-structured-2",
        payload: {
          type: "message",
          role: "user",
          content: "Attached 1 image",
          input: [
            {
              type: "local_image",
              path: ".harbor/task-input-images/only-image.png",
            },
          ],
          attachments: [
            {
              type: "local_image",
              path: ".harbor/task-input-images/only-image.png",
            },
          ],
          source: "user_input",
          timestamp: "2026-03-11T00:00:00.000Z",
        },
      }),
    ])

    expect(block).toEqual({
      id: "message-structured-2",
      type: "message",
      role: "user",
      content: "Attached 1 image",
      attachments: [
        {
          type: "local_image",
          path: ".harbor/task-input-images/only-image.png",
        },
      ],
      timestamp: "2026-03-11T00:00:00.000Z",
    })
  })

  it("treats command output as the latest snapshot", () => {
    const [block] = toConversationBlocks([
      buildTaskAgentEvent({
        id: "output-1",
        sequence: 1,
        eventType: "command.output",
        payload: {
          type: "command.output",
          commandId: "command-1",
          output: "bun test",
          timestamp: "2026-03-11T00:00:00.000Z",
        },
      }),
      buildTaskAgentEvent({
        id: "output-2",
        sequence: 2,
        eventType: "command.output",
        payload: {
          type: "command.output",
          commandId: "command-1",
          output: "bun test\nok",
          timestamp: "2026-03-11T00:00:01.000Z",
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
      outputPreview: null,
      outputLineCount: 0,
      hasMoreOutput: false,
      startedAt: null,
      completedAt: "2026-03-11T00:00:00.000Z",
      timestamp: "2026-03-11T00:00:00.000Z",
      status: "success",
      exitCode: 0,
    })
  })

  it("maps web search into dedicated blocks", () => {
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
      type: "web-search",
      status: "running",
      query: "codex sdk events",
      searchId: "search-1",
    })
  })

  it("maps file changes and MCP tool calls into dedicated blocks", () => {
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
      type: "file-change",
      changeId: "patch-1",
      status: "success",
      changes: [
        {
          path: "src/app.ts",
          kind: "update",
        },
      ],
    })
    expect(blocks[1]).toMatchObject({
      id: "mcp-1",
      type: "mcp-tool-call",
      status: "failed",
      callId: "mcp-1",
      server: "context7",
      tool: "query-docs",
      errorText: "tool failed",
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

  it("aggregates todo list lifecycle events into one checklist block", () => {
    const [block] = toConversationBlocks([
      buildTaskAgentEvent({
        id: "todo-0",
        sequence: 1,
        eventType: "todo_list.started",
        payload: {
          type: "todo_list.started",
          todoListId: "todo-list-1",
          items: [{ text: "Investigate", completed: false }],
          timestamp: "2026-03-11T00:00:00.000Z",
        },
      }),
      buildTaskAgentEvent({
        id: "todo-1",
        sequence: 2,
        eventType: "todo_list.updated",
        payload: {
          type: "todo_list.updated",
          todoListId: "todo-list-1",
          items: [
            { text: "Investigate", completed: true },
            { text: "Patch", completed: false },
          ],
          timestamp: "2026-03-11T00:00:00.000Z",
        },
      }),
      buildTaskAgentEvent({
        id: "todo-2",
        sequence: 3,
        eventType: "todo_list.completed",
        payload: {
          type: "todo_list.completed",
          todoListId: "todo-list-1",
          items: [
            { text: "Investigate", completed: true },
            { text: "Patch", completed: true },
          ],
          timestamp: "2026-03-11T00:00:03.000Z",
        },
      }),
    ])

    expect(block).toEqual({
      id: "todo-0",
      type: "todo-list",
      todoListId: "todo-list-1",
      items: [
        { text: "Investigate", completed: true },
        { text: "Patch", completed: true },
      ],
      startedAt: "2026-03-11T00:00:00.000Z",
      updatedAt: "2026-03-11T00:00:03.000Z",
      completedAt: "2026-03-11T00:00:03.000Z",
      timestamp: "2026-03-11T00:00:03.000Z",
      status: "completed",
    })
  })

  it("keeps compatibility with legacy todo_list snapshots", () => {
    const [block] = toConversationBlocks([
      buildTaskAgentEvent({
        id: "todo-legacy",
        eventType: "todo_list",
        payload: {
          type: "todo_list",
          items: [
            { text: "Legacy A", completed: true },
            { text: "Legacy B", completed: false },
          ],
          timestamp: "2026-03-11T00:00:00.000Z",
        },
      }),
    ])

    expect(block).toEqual({
      id: "todo-legacy",
      type: "todo-list",
      todoListId: "todo-legacy",
      items: [
        { text: "Legacy A", completed: true },
        { text: "Legacy B", completed: false },
      ],
      startedAt: "2026-03-11T00:00:00.000Z",
      updatedAt: "2026-03-11T00:00:00.000Z",
      completedAt: null,
      timestamp: "2026-03-11T00:00:00.000Z",
      status: "running",
    })
  })
})
