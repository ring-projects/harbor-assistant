import { describe, expect, it, vi } from "vitest"

import { createProject } from "../../project/domain/project"
import { InMemorySandboxRegistry } from "../infrastructure/in-memory-sandbox-registry"
import {
  bootstrapProjectSandboxTemplate,
  findLatestProjectSandboxTemplateSnapshot,
} from "./project-sandbox-template"
import type { SandboxProvisioningPort } from "./sandbox-provider"

describe("project sandbox template bootstrap", () => {
  it("provisions a bootstrap sandbox, captures a snapshot, and stops the sandbox", async () => {
    const provider: SandboxProvisioningPort = {
      provider: "docker",
      createSandbox: vi.fn(async () => ({
        providerSandboxId: "provider-sandbox-1",
        workingDirectory: "/sandboxes/provider-sandbox-1/workspace",
        previewBaseUrl: null,
      })),
      destroySandbox: vi.fn(async () => {}),
      createSnapshot: vi.fn(async () => ({
        providerSnapshotId: "provider-snapshot-1",
        providerSnapshotRef: "/sandboxes/.snapshots/provider-snapshot-1.tar",
      })),
      writeFiles: vi.fn(async () => {}),
      readFile: vi.fn(async () => new Uint8Array()),
      runCommand: vi.fn(async () => ({
        providerCommandId: "command-1",
        command: "true",
        cwd: null,
        detached: false,
        startedAt: new Date(),
      })),
      getCommand: vi.fn(async () => null),
      resolvePreviewUrl: vi.fn(async () => "http://127.0.0.1:3000"),
    }
    const registry = new InMemorySandboxRegistry()

    const snapshot = await bootstrapProjectSandboxTemplate(
      {
        provider,
        registry,
      },
      {
        project: createProject({
          id: "project-1",
          name: "Project 1",
          source: {
            type: "git",
            repositoryUrl: "https://github.com/acme/project-1.git",
            branch: "main",
          },
        }),
      },
    )

    expect(snapshot).not.toBeNull()
    expect(provider.createSandbox).toHaveBeenCalledWith(
      expect.objectContaining({
        source: {
          type: "git",
          repositoryUrl: "https://github.com/acme/project-1.git",
          ref: "main",
        },
        metadata: expect.objectContaining({
          purpose: "task-prepare",
          labels: expect.objectContaining({
            template: "project-bootstrap",
          }),
        }),
      }),
    )
    expect(provider.createSnapshot).toHaveBeenCalled()
    expect(provider.destroySandbox).toHaveBeenCalled()

    const latest = await findLatestProjectSandboxTemplateSnapshot(
      {
        registry,
      },
      {
        projectId: "project-1",
      },
    )
    expect(latest?.snapshot.providerSnapshotRef).toBe(
      "/sandboxes/.snapshots/provider-snapshot-1.tar",
    )
  })
})
