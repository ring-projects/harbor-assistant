import { afterEach, describe, expect, it } from "vitest"

import {
  createSandboxEnvironment,
  createSandboxSnapshotRecord,
  createSandboxCommandRecord,
  markSandboxCommandCompleted,
  markSandboxCommandRunning,
} from "../.."
import {
  createTestDatabase,
  type TestDatabase,
} from "../../../../../test/helpers/test-database"
import { PrismaSandboxRegistry } from "./prisma-sandbox-registry"

describe("PrismaSandboxRegistry", () => {
  let testDatabase: TestDatabase | null = null

  afterEach(async () => {
    await testDatabase?.cleanup()
    testDatabase = null
  })

  it("persists sandboxes, commands, and snapshots across registry instances", async () => {
    testDatabase = await createTestDatabase()

    const createdAt = new Date("2026-04-20T00:00:00.000Z")
    const sandbox = createSandboxEnvironment({
      id: "sandbox-1",
      provider: "docker",
      providerSandboxId: "provider-sandbox-1",
      mode: "connected",
      source: {
        type: "git",
        repositoryUrl: "https://github.com/acme/harbor.git",
        ref: "main",
      },
      workingDirectory: "/workspace",
      profile: {
        vcpuCount: 2,
        memoryMb: 4096,
        idleTimeoutSeconds: 300,
        maxDurationSeconds: 1800,
      },
      networkPolicy: {
        outboundMode: "allow-list",
        allowedHosts: ["registry.npmjs.org"],
      },
      metadata: {
        workspaceId: "workspace-1",
        projectId: "project-1",
        taskId: "task-1",
        purpose: "task-run",
        labels: {
          branch: "main",
        },
      },
      previewBaseUrl: "https://preview.example.com",
      createdAt,
    })

    const runningCommand = markSandboxCommandRunning(
      createSandboxCommandRecord({
        id: "command-1",
        sandboxId: sandbox.id,
        providerCommandId: "provider-command-1",
        command: "pnpm test",
        cwd: "/workspace/apps/service",
        createdAt,
      }),
      createdAt,
    )
    const completedCommand = markSandboxCommandCompleted(runningCommand, {
      exitCode: 0,
      finishedAt: new Date("2026-04-20T00:01:00.000Z"),
    })
    const snapshot = createSandboxSnapshotRecord({
      id: "snapshot-1",
      sandboxId: sandbox.id,
      providerSnapshotId: "provider-snapshot-1",
      providerSnapshotRef: "harbor/sandbox:snapshot_1",
      createdAt,
    })

    const writer = new PrismaSandboxRegistry(testDatabase.prisma)
    await writer.saveSandbox(sandbox)
    await writer.saveCommand(completedCommand)
    await writer.saveSnapshot(snapshot)

    const reader = new PrismaSandboxRegistry(testDatabase.prisma)

    await expect(reader.findSandboxById("sandbox-1")).resolves.toEqual(sandbox)
    await expect(
      reader.findSandboxByProviderId("provider-sandbox-1"),
    ).resolves.toEqual(sandbox)
    await expect(reader.findCommandById("command-1")).resolves.toEqual(
      completedCommand,
    )
    await expect(reader.findSnapshotById("snapshot-1")).resolves.toEqual(
      snapshot,
    )
  })
})
