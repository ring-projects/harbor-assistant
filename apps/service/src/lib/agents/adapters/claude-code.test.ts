import { EventEmitter } from "node:events"
import { PassThrough } from "node:stream"

import { afterEach, describe, expect, it, vi } from "vitest"

function createMockChild() {
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  const child = new EventEmitter() as EventEmitter & {
    stdout: PassThrough
    stderr: PassThrough
    kill: ReturnType<typeof vi.fn>
  }

  child.stdout = stdout
  child.stderr = stderr
  child.kill = vi.fn(() => true)

  return child
}

describe("ClaudeCodeAdapter", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("maps Claude stream-json output into unified agent events", async () => {
    const child = createMockChild()

    const module = await import("./claude-code")
    const spawnMock = vi
      .spyOn(module.claudeCodeProcess, "spawn")
      .mockReturnValue(child as never)
    vi.spyOn(module.claudeCodeProcess, "findInstalledCommand").mockResolvedValue(
      "claude",
    )

    const { ClaudeCodeAdapter } = module
    const adapter = new ClaudeCodeAdapter()

    const eventsPromise = (async () => {
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

      return events
    })()

    await Promise.resolve()
    await Promise.resolve()
    expect(spawnMock).toHaveBeenCalledTimes(1)

    child.stdout.write(
      `${JSON.stringify({
        type: "system",
        subtype: "init",
        session_id: "session-123",
      })}\n`,
    )
    child.stdout.write(
      `${JSON.stringify({
        type: "assistant",
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
      })}\n`,
    )
    child.stdout.write(
      `${JSON.stringify({
        type: "user",
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
      })}\n`,
    )
    child.stdout.write(
      `${JSON.stringify({
        type: "system",
        subtype: "result",
        result: "Finished successfully.",
      })}\n`,
    )
    child.stdout.end()
    child.emit("close", 0, null)

    const events = await eventsPromise

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "session.started",
          sessionId: "session-123",
        }),
        expect.objectContaining({
          type: "message",
          role: "user",
          content: "Run tests",
        }),
        expect.objectContaining({
          type: "turn.started",
        }),
        expect.objectContaining({
          type: "command.started",
          commandId: "tool-1",
          command: expect.stringContaining("Bash"),
        }),
        expect.objectContaining({
          type: "command.output",
          commandId: "tool-1",
          output: "ok\n",
        }),
        expect.objectContaining({
          type: "command.completed",
          commandId: "tool-1",
          status: "success",
        }),
        expect.objectContaining({
          type: "message",
          role: "assistant",
          content: "Tests are running.",
        }),
        expect.objectContaining({
          type: "turn.completed",
        }),
        expect.objectContaining({
          type: "session.completed",
        }),
      ]),
    )
  })
})
