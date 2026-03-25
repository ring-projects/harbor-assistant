import { describe, expect, it, vi } from "vitest"

import { ClaudeCodeAdapter } from "./runtime"

function buildClaudeMessages() {
  return (async function* () {
    yield {
      type: "system" as const,
      subtype: "init" as const,
      session_id: "session-123",
      uuid: "uuid-init",
      claude_code_version: "2.1.81",
      cwd: "/tmp/project",
      tools: ["Read", "Bash"],
      mcp_servers: [],
      model: "claude-sonnet-4-6",
      permissionMode: "bypassPermissions" as const,
      slash_commands: [],
      output_style: "default",
      skills: [],
      apiKeySource: "user" as const,
      plugins: [],
    }
    yield {
      type: "assistant" as const,
      session_id: "session-123",
      uuid: "uuid-assistant",
      parent_tool_use_id: null,
      message: {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "tool-1",
            name: "Bash",
            input: { command: "bun test" },
          },
          {
            type: "text",
            text: "Tests are running.",
          },
        ],
      },
    }
    yield {
      type: "user" as const,
      session_id: "session-123",
      uuid: "uuid-user",
      parent_tool_use_id: null,
      message: {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "tool-1",
            content: "ok\n",
          },
        ],
      },
    }
    yield {
      type: "result" as const,
      subtype: "success" as const,
      session_id: "session-123",
      uuid: "uuid-result",
      duration_ms: 10,
      duration_api_ms: 5,
      is_error: false,
      num_turns: 1,
      result: "Finished successfully.",
      stop_reason: null,
      total_cost_usd: 0.01,
      usage: {
        input_tokens: 1,
        output_tokens: 1,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
      modelUsage: {},
      permission_denials: [],
    }
  })()
}

function createQueryStub() {
  const close = vi.fn()
  return {
    close,
    [Symbol.asyncIterator]() {
      return buildClaudeMessages()[Symbol.asyncIterator]()
    },
  }
}

describe("ClaudeCodeAdapter", () => {
  it("emits provider-native SDK envelopes without Harbor synthetic events", async () => {
    const queryStub = createQueryStub()
    const createQuery = vi.fn(() => queryStub)

    const adapter = new ClaudeCodeAdapter(createQuery)

    const events = []
    for await (const event of adapter.startSessionAndRun(
      {
        workingDirectory: "/tmp/project",
        approvalPolicy: "never",
        networkAccessEnabled: false,
      },
      "Run tests",
    )) {
      events.push(event)
    }

    expect(createQuery).toHaveBeenCalledWith({
      prompt: "Run tests",
      options: expect.objectContaining({
        cwd: "/tmp/project",
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        disallowedTools: ["WebFetch", "WebSearch", "AskUserQuestion"],
      }),
    })

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agentType: "claude-code",
          event: expect.objectContaining({
            type: "system",
            subtype: "init",
            session_id: "session-123",
          }),
        }),
        expect.objectContaining({
          agentType: "claude-code",
          event: expect.objectContaining({
            type: "assistant",
            message: expect.objectContaining({
              role: "assistant",
            }),
          }),
        }),
        expect.objectContaining({
          agentType: "claude-code",
          event: expect.objectContaining({
            type: "user",
            message: expect.objectContaining({
              role: "user",
            }),
          }),
        }),
        expect.objectContaining({
          agentType: "claude-code",
          event: expect.objectContaining({
            type: "result",
            result: "Finished successfully.",
          }),
        }),
      ]),
    )

    expect(
      events.some(
        (event) =>
          typeof event.event === "object" &&
          event.event !== null &&
          "type" in event.event &&
          event.event.type === "harbor.user_prompt",
      ),
    ).toBe(false)

    expect(queryStub.close).toHaveBeenCalledTimes(1)
  })

  it("maps modelId and effort into SDK query options", async () => {
    const queryStub = createQueryStub()
    const createQuery = vi.fn(() => queryStub)

    const adapter = new ClaudeCodeAdapter(createQuery)

    for await (const _event of adapter.startSessionAndRun(
      {
        workingDirectory: "/tmp/project",
        modelId: "claude-opus-4-6",
        effort: "xhigh",
        approvalPolicy: "never",
      },
      "Review this change",
    )) {
      // drain
    }

    expect(createQuery).toHaveBeenCalledWith({
      prompt: "Review this change",
      options: expect.objectContaining({
        model: "claude-opus-4-6",
        effort: "max",
      }),
    })
  })
})
