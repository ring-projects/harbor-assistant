import { afterEach, describe, expect, it, vi } from "vitest"

import { AgentFactory } from "../../../lib/agents"
import { RUNTIME_POLICY_PRESETS } from "../runtime-policy"
import { createTaskAgentGateway } from "./agent.gateway"

function buildAsyncEvents() {
  return (async function* () {
    yield {
      type: "session.started" as const,
      sessionId: "session-1",
      timestamp: new Date("2026-03-11T00:00:00.000Z"),
    }
    yield {
      type: "command.started" as const,
      commandId: "command-1",
      command: "bun test",
      timestamp: new Date("2026-03-11T00:00:01.000Z"),
    }
    yield {
      type: "command.output" as const,
      commandId: "command-1",
      output: "ok\n",
      timestamp: new Date("2026-03-11T00:00:02.000Z"),
    }
    yield {
      type: "command.completed" as const,
      commandId: "command-1",
      status: "success" as const,
      exitCode: 0,
      timestamp: new Date("2026-03-11T00:00:03.000Z"),
    }
    yield {
      type: "turn.completed" as const,
      timestamp: new Date("2026-03-11T00:00:04.000Z"),
    }
    yield {
      type: "session.completed" as const,
      timestamp: new Date("2026-03-11T00:00:05.000Z"),
    }
  })()
}

describe("createTaskAgentGateway", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("persists raw agent events including command.started", async () => {
    const appendTaskAgentEvent = vi.fn(async (input) => ({
      id: `event-${input.eventType}`,
      taskId: input.taskId,
      sequence: 1,
      eventType: input.eventType,
      payload: input.payload,
      createdAt: input.createdAt ?? "2026-03-11T00:00:00.000Z",
    }))

    const gateway = createTaskAgentGateway({
      taskRepository: {
        appendTaskAgentEvent,
        setTaskThreadId: vi.fn(async () => {}),
      },
      taskEventBus: {
        publish: vi.fn(),
      },
      harborApiBaseUrl: "http://127.0.0.1:3400/v1",
    })

    const startSessionAndRun = vi.fn(() => buildAsyncEvents())

    vi.spyOn(AgentFactory, "getAgent").mockReturnValue({
      startSessionAndRun,
      resumeSessionAndRun: vi.fn(() => buildAsyncEvents()),
    } as never)

    await gateway.startSessionAndRun({
      taskId: "task-1",
      projectId: "project-1",
      projectPath: "/tmp/project-1",
      prompt: "Run tests",
      displayPrompt: "Run tests",
      model: "gpt-5",
      runtimePolicy: RUNTIME_POLICY_PRESETS.connected,
    })

    expect(startSessionAndRun).toHaveBeenCalledWith(
      expect.objectContaining({
        sandboxMode: "workspace-write",
        approvalPolicy: "never",
        networkAccessEnabled: true,
        webSearchMode: "live",
        env: {
          HARBOR_SERVICE_BASE_URL: "http://127.0.0.1:3400/v1",
          HARBOR_PROJECT_ID: "project-1",
          HARBOR_TASK_ID: "task-1",
        },
        displayPrompt: "Run tests",
      }),
      "Run tests",
      undefined,
    )

    expect(appendTaskAgentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "task-1",
        eventType: "command.started",
        payload: expect.objectContaining({
          type: "command.started",
          commandId: "command-1",
          command: "bun test",
        }),
      }),
    )
  })
})
