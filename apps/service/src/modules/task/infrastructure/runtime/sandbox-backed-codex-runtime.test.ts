import { describe, expect, it, vi } from "vitest"

import type {
  SandboxCommandHandle,
  SandboxProvisioningPort,
} from "../../../sandbox"
import { SandboxBackedCodexRuntime } from "./sandbox-backed-codex-runtime"

function createHandle(lines: string[], exitCode = 0): SandboxCommandHandle {
  return {
    providerCommandId: "command-1",
    async *logs() {
      for (const line of lines) {
        yield line
      }
    },
    wait: vi.fn(async () => ({ exitCode })),
    kill: vi.fn(async () => {}),
  }
}

describe("SandboxBackedCodexRuntime", () => {
  it("runs codex inside the sandbox and emits parsed provider events", async () => {
    const handle = createHandle([
      JSON.stringify({
        kind: "event",
        createdAt: "2026-04-20T00:00:00.000Z",
        event: {
          type: "thread.started",
          thread_id: "thread-1",
        },
      }),
    ])
    const provider: SandboxProvisioningPort = {
      provider: "docker",
      createSandbox: vi.fn(),
      destroySandbox: vi.fn(),
      createSnapshot: vi.fn(),
      writeFiles: vi.fn(async () => {}),
      readFile: vi.fn(async () => new Uint8Array()),
      runCommand: vi.fn(async () => ({
        providerCommandId: "command-1",
        command: "runner",
        cwd: null,
        detached: false,
        startedAt: new Date("2026-04-20T00:00:00.000Z"),
      })),
      getCommand: vi.fn(async () => handle),
      resolvePreviewUrl: vi.fn(async () => "http://127.0.0.1:3000"),
    }

    const runtime = new SandboxBackedCodexRuntime(
      provider,
      "provider-sandbox-1",
      "/tmp/sandboxes/provider-sandbox-1/workspace",
    )
    const events = []
    for await (const event of runtime.startSessionAndRun(
      {
        workingDirectory: "/tmp/project",
        approvalPolicy: "never",
      },
      "Inspect the repo",
    )) {
      events.push(event)
    }

    expect(provider.writeFiles).toHaveBeenCalledWith(
      "provider-sandbox-1",
      expect.arrayContaining([
        expect.objectContaining({
          path: expect.stringMatching(
            /^\.harbor\/runtime\/codex-sandbox-runner\/.+\.json$/,
          ),
          content: expect.any(Uint8Array),
        }),
      ]),
    )
    expect(provider.runCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        providerSandboxId: "provider-sandbox-1",
        env: expect.objectContaining({
          HARBOR_CODEX_RUNNER_PAYLOAD_PATH: expect.stringMatching(
            /^\/tmp\/sandboxes\/provider-sandbox-1\/workspace\/\.harbor\/runtime\/codex-sandbox-runner\/.+\.json$/,
          ),
        }),
      }),
    )
    expect(events).toEqual([
      {
        agentType: "codex",
        event: {
          type: "thread.started",
          thread_id: "thread-1",
        },
        createdAt: new Date("2026-04-20T00:00:00.000Z"),
      },
    ])
  })

  it("propagates sandbox runner errors", async () => {
    const handle = createHandle(
      [
        JSON.stringify({
          kind: "error",
          message: "runner exploded",
        }),
      ],
      1,
    )
    const provider: SandboxProvisioningPort = {
      provider: "docker",
      createSandbox: vi.fn(),
      destroySandbox: vi.fn(),
      createSnapshot: vi.fn(),
      writeFiles: vi.fn(async () => {}),
      readFile: vi.fn(async () => new Uint8Array()),
      runCommand: vi.fn(async () => ({
        providerCommandId: "command-1",
        command: "runner",
        cwd: null,
        detached: false,
        startedAt: new Date(),
      })),
      getCommand: vi.fn(async () => handle),
      resolvePreviewUrl: vi.fn(async () => "http://127.0.0.1:3000"),
    }

    const runtime = new SandboxBackedCodexRuntime(
      provider,
      "provider-sandbox-1",
      "/tmp/sandboxes/provider-sandbox-1/workspace",
    )

    await expect(async () => {
      for await (const _event of runtime.startSessionAndRun(
        {
          workingDirectory: "/tmp/project",
        },
        "Inspect the repo",
      )) {
        // no-op
      }
    }).rejects.toThrow("runner exploded")
  })
})
