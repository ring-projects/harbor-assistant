import { describe, expect, it } from "vitest"

import { CodexAdapter } from "./codex"

function buildCodexEvents() {
  return (async function* () {
    yield {
      type: "thread.started" as const,
      thread_id: "thread-1",
    }
    yield {
      type: "turn.started" as const,
    }
    yield {
      type: "item.started" as const,
      item: {
        id: "search-1",
        type: "web_search" as const,
        query: "latest frontend design trends",
      },
    }
    yield {
      type: "item.completed" as const,
      item: {
        id: "search-1",
        type: "web_search" as const,
        query: "latest frontend design trends",
      },
    }
    yield {
      type: "item.completed" as const,
      item: {
        id: "patch-1",
        type: "file_change" as const,
        status: "completed" as const,
        changes: [
          {
            path: "src/app.ts",
            kind: "update" as const,
          },
          {
            path: "src/new.ts",
            kind: "add" as const,
          },
        ],
      },
    }
    yield {
      type: "item.started" as const,
      item: {
        id: "mcp-1",
        type: "mcp_tool_call" as const,
        server: "context7",
        tool: "query-docs",
        arguments: {
          libraryId: "/openai/codex",
        },
        status: "in_progress" as const,
      },
    }
    yield {
      type: "item.completed" as const,
      item: {
        id: "mcp-1",
        type: "mcp_tool_call" as const,
        server: "context7",
        tool: "query-docs",
        arguments: {
          libraryId: "/openai/codex",
        },
        result: {
          content: [],
          structured_content: {
            hits: 3,
          },
        },
        status: "completed" as const,
      },
    }
    yield {
      type: "turn.completed" as const,
      usage: {
        input_tokens: 1,
        cached_input_tokens: 0,
        output_tokens: 1,
      },
    }
  })()
}

describe("CodexAdapter", () => {
  it("maps web search, file change, and MCP tool items into agent events", async () => {
    const adapter = new CodexAdapter(() => ({
      startThread: () => ({
        runStreamed: async () => ({
          events: buildCodexEvents(),
        }),
      }) as never,
      resumeThread: () => {
        throw new Error("resumeThread should not be called in this test")
      },
    }))

    const events = []
    for await (const event of adapter.startSessionAndRun(
      {
        workingDirectory: "/tmp/project",
        approvalPolicy: "never",
      },
      "Research this topic",
    )) {
      events.push(event)
    }

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "web_search.started",
          searchId: "search-1",
          query: "latest frontend design trends",
        }),
        expect.objectContaining({
          type: "web_search.completed",
          searchId: "search-1",
          query: "latest frontend design trends",
        }),
        expect.objectContaining({
          type: "file_change",
          changeId: "patch-1",
          status: "success",
          changes: [
            { path: "src/app.ts", kind: "update" },
            { path: "src/new.ts", kind: "add" },
          ],
        }),
        expect.objectContaining({
          type: "mcp_tool_call.started",
          callId: "mcp-1",
          server: "context7",
          tool: "query-docs",
        }),
        expect.objectContaining({
          type: "mcp_tool_call.completed",
          callId: "mcp-1",
          server: "context7",
          tool: "query-docs",
          status: "success",
          result: {
            content: [],
            structured_content: {
              hits: 3,
            },
          },
        }),
      ]),
    )
  })
})
