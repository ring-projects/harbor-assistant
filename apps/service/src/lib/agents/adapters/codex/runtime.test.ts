import { describe, expect, it, vi } from "vitest"

import type { AgentInput } from "../../types"

import { CodexAdapter } from "./runtime"

function buildStandardCodexEvents() {
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
        id: "patch-1",
        type: "file_change" as const,
        status: "completed" as const,
        changes: [
          {
            path: "src/app.ts",
            kind: "update" as const,
          },
        ],
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
  it("maps runtime options into Codex thread options", async () => {
    const startThread = vi.fn(() => ({
      runStreamed: async () => ({
        events: buildStandardCodexEvents(),
      }),
    }))

    const adapter = new CodexAdapter(() => ({
      startThread,
      resumeThread: () => {
        throw new Error("resumeThread should not be called in this test")
      },
    }))

    for await (const _event of adapter.startSessionAndRun(
      {
        workingDirectory: "/tmp/project",
        modelId: "gpt-5.3-codex",
        effort: "high",
        sandboxMode: "read-only",
        approvalPolicy: "on-request",
        networkAccessEnabled: true,
        webSearchMode: "live",
        additionalDirectories: ["/tmp/shared"],
      },
      "Research this topic",
    )) {
      // drain stream
    }

    expect(startThread).toHaveBeenCalledWith({
      workingDirectory: "/tmp/project",
      model: "gpt-5.3-codex",
      modelReasoningEffort: "high",
      sandboxMode: "read-only",
      approvalPolicy: "on-request",
      networkAccessEnabled: true,
      webSearchMode: "live",
      additionalDirectories: ["/tmp/shared"],
      skipGitRepoCheck: true,
    })
  })

  it("passes SDK-style local image input through to the thread", async () => {
    let receivedInput: unknown = null

    const adapter = new CodexAdapter(() => ({
      startThread: () => ({
        runStreamed: async (input: AgentInput) => {
          receivedInput = input
          return {
            events: buildStandardCodexEvents(),
          }
        },
      }) as never,
      resumeThread: () => {
        throw new Error("resumeThread should not be called in this test")
      },
    }))

    for await (const _event of adapter.startSessionAndRun(
      {
        workingDirectory: "/tmp/project",
        approvalPolicy: "never",
      },
      [
        {
          type: "text",
          text: "Review this screenshot",
        },
        {
          type: "local_image",
          path: ".harbor/task-input-images/reference.png",
        },
      ],
    )) {
      // drain stream
    }

    expect(receivedInput).toEqual([
      {
        type: "text",
        text: "Review this screenshot",
      },
      {
        type: "local_image",
        path: ".harbor/task-input-images/reference.png",
      },
    ])
  })

  it("emits provider-native codex events without Harbor prompt synthesis", async () => {
    const adapter = new CodexAdapter(() => ({
      startThread: () => ({
        runStreamed: async () => ({
          events: buildStandardCodexEvents(),
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

    expect(
      events.filter(
        (event) =>
          typeof event.event === "object" &&
          event.event !== null &&
          "type" in event.event &&
          event.event.type === "harbor.user_prompt",
      ),
    ).toHaveLength(0)
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agentType: "codex",
          event: {
            type: "thread.started",
            thread_id: "thread-1",
          },
        }),
        expect.objectContaining({
          agentType: "codex",
          event: {
            type: "item.started",
            item: {
              id: "search-1",
              type: "web_search",
              query: "latest frontend design trends",
            },
          },
        }),
        expect.objectContaining({
          agentType: "codex",
          event: expect.objectContaining({
            type: "item.completed",
            item: expect.objectContaining({
              id: "patch-1",
              type: "file_change",
              status: "completed",
            }),
          }),
        }),
        expect.objectContaining({
          agentType: "codex",
          event: expect.objectContaining({
            type: "turn.completed",
            usage: {
              input_tokens: 1,
              cached_input_tokens: 0,
              output_tokens: 1,
            },
          }),
        }),
      ]),
    )
  })

  it("preserves failure events without injecting Harbor prompt events", async () => {
    const adapter = new CodexAdapter(() => ({
      startThread: () => ({
        runStreamed: async () => ({
          events: (async function* () {
            yield {
              type: "item.started" as const,
              item: {
                id: "command-1",
                type: "command_execution" as const,
                command: "bun test",
                aggregated_output: "",
                status: "in_progress" as const,
              },
            }
            yield {
              type: "turn.failed" as const,
              error: {
                message: "Execution failed",
              },
            }
            yield {
              type: "error" as const,
              message: "fatal error",
            }
          })(),
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
      "Run tests",
    )) {
      events.push(event)
    }

    expect(
      events.some(
        (event) =>
          typeof event.event === "object" &&
          event.event !== null &&
          "type" in event.event &&
          event.event.type === "harbor.user_prompt",
      ),
    ).toBe(false)
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: expect.objectContaining({
            type: "item.started",
            item: expect.objectContaining({
              id: "command-1",
            }),
          }),
        }),
        expect.objectContaining({
          event: {
            type: "turn.failed",
            error: {
              message: "Execution failed",
            },
          },
        }),
        expect.objectContaining({
          event: {
            type: "error",
            message: "fatal error",
          },
        }),
      ]),
    )
  })
})
