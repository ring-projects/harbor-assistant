import { describe, expect, it, vi } from "vitest"

import { provisionSandboxUseCase } from "./provision-sandbox"
import { InMemorySandboxRegistry } from "../infrastructure/in-memory-sandbox-registry"
import type { SandboxProvisioningPort } from "./sandbox-provider"

describe("provisionSandboxUseCase", () => {
  it("provisions and stores a sandbox using mode presets", async () => {
    const provider: SandboxProvisioningPort = {
      provider: "docker",
      createSandbox: vi.fn(async () => ({
        providerSandboxId: "vsb_1",
        workingDirectory: "/workspace",
        previewBaseUrl: "https://preview.example.com",
      })),
      destroySandbox: vi.fn(async () => {}),
      createSnapshot: vi.fn(async () => ({ providerSnapshotId: "snap_1" })),
      writeFiles: vi.fn(async () => {}),
      readFile: vi.fn(async () => new Uint8Array()),
      runCommand: vi.fn(async () => ({
        providerCommandId: "cmd_1",
        command: "pwd",
        cwd: "/workspace",
        detached: false,
        startedAt: new Date("2026-01-01T00:00:00.000Z"),
      })),
      getCommand: vi.fn(async () => null),
      resolvePreviewUrl: vi.fn(async () => "https://preview.example.com"),
    }
    const registry = new InMemorySandboxRegistry()

    const sandbox = await provisionSandboxUseCase(
      {
        provider,
        registry,
        idGenerator: () => "sandbox-record-1",
      },
      {
        mode: "connected",
        source: {
          type: "git",
          repositoryUrl: "https://github.com/acme/harbor.git",
          ref: "main",
        },
        projectId: "project-1",
        taskId: "task-1",
        purpose: "task-run",
      },
    )

    expect(provider.createSandbox).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: expect.objectContaining({
          vcpuCount: 2,
          memoryMb: 4096,
        }),
        networkPolicy: {
          outboundMode: "allow-list",
          allowedHosts: [],
        },
      }),
    )
    expect(sandbox.id).toBe("sandbox-record-1")
    expect(sandbox.providerSandboxId).toBe("vsb_1")
    expect(sandbox.status).toBe("ready")
    expect(sandbox.metadata.projectId).toBe("project-1")
    await expect(registry.findSandboxById("sandbox-record-1")).resolves.toEqual(
      sandbox,
    )
  })
})
