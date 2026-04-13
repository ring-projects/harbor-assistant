import { describe, expect, it } from "vitest"

import { ensureWorkspaceInstallationAccess } from "./ensure-workspace-installation-access"
import { InMemoryGitHubInstallationRepository } from "../infrastructure/in-memory-github-installation-repository"
import { InMemoryWorkspaceInstallationRepository } from "../infrastructure/in-memory-workspace-installation-repository"

describe("ensureWorkspaceInstallationAccess", () => {
  it("allows an already linked installation", async () => {
    const installationRepository = new InMemoryGitHubInstallationRepository()
    const workspaceInstallationRepository =
      new InMemoryWorkspaceInstallationRepository()

    await installationRepository.save({
      id: "12345",
      accountType: "organization",
      accountLogin: "acme",
      targetType: "selected",
      status: "active",
      installedByUserId: "user-1",
      createdAt: new Date("2026-04-06T00:00:00.000Z"),
      updatedAt: new Date("2026-04-06T00:00:00.000Z"),
      lastValidatedAt: null,
    })
    await workspaceInstallationRepository.saveLink({
      workspaceId: "ws-1",
      installationId: "12345",
      linkedByUserId: "user-1",
      createdAt: new Date("2026-04-06T00:00:00.000Z"),
      updatedAt: new Date("2026-04-06T00:00:00.000Z"),
    })

    const installation = await ensureWorkspaceInstallationAccess(
      {
        installationRepository,
        workspaceInstallationRepository,
      },
      {
        workspaceId: "ws-1",
        installationId: "12345",
        actorUserId: "user-2",
      },
    )

    expect(installation.id).toBe("12345")
  })

  it("auto-links an actor-owned installation into the workspace", async () => {
    const installationRepository = new InMemoryGitHubInstallationRepository()
    const workspaceInstallationRepository =
      new InMemoryWorkspaceInstallationRepository()

    await installationRepository.save({
      id: "12345",
      accountType: "organization",
      accountLogin: "acme",
      targetType: "selected",
      status: "active",
      installedByUserId: "user-1",
      createdAt: new Date("2026-04-06T00:00:00.000Z"),
      updatedAt: new Date("2026-04-06T00:00:00.000Z"),
      lastValidatedAt: null,
    })

    await ensureWorkspaceInstallationAccess(
      {
        installationRepository,
        workspaceInstallationRepository,
      },
      {
        workspaceId: "ws-1",
        installationId: "12345",
        actorUserId: "user-1",
        now: new Date("2026-04-06T00:00:00.000Z"),
      },
    )

    await expect(
      workspaceInstallationRepository.findLink("ws-1", "12345"),
    ).resolves.toEqual(
      expect.objectContaining({
        workspaceId: "ws-1",
        installationId: "12345",
        linkedByUserId: "user-1",
      }),
    )
  })
})
