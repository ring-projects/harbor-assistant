import { afterEach, describe, expect, it } from "vitest"

import {
  acceptWorkspaceInvitation,
  createWorkspace,
  createWorkspaceInvitation,
} from "../../domain/workspace"
import { PrismaWorkspaceInvitationRepository } from "./prisma-workspace-invitation-repository"
import {
  createTestDatabase,
  type TestDatabase,
} from "../../../../../test/helpers/test-database"

describe("PrismaWorkspaceInvitationRepository", () => {
  let testDatabase: TestDatabase | null = null

  afterEach(async () => {
    await testDatabase?.cleanup()
    testDatabase = null
  })

  it("saves and reloads invitations by workspace and github login", async () => {
    testDatabase = await createTestDatabase()
    await testDatabase.prisma.user.create({
      data: {
        id: "owner-1",
        githubLogin: "owner",
      },
    })
    await testDatabase.prisma.workspace.create({
      data: {
        id: "ws-1",
        slug: "harbor-team",
        name: "Harbor Team",
        type: "team",
        status: "active",
        createdByUserId: "owner-1",
        memberships: {
          create: {
            userId: "owner-1",
            role: "owner",
            status: "active",
          },
        },
      },
    })
    const repository = new PrismaWorkspaceInvitationRepository(
      testDatabase.prisma,
    )

    const invitation = createWorkspaceInvitation(
      createWorkspace({
        id: "ws-1",
        name: "Harbor Team",
        type: "team",
        createdByUserId: "owner-1",
      }),
      {
        id: "invite-1",
        inviteeGithubLogin: "octocat",
        invitedByUserId: "owner-1",
        now: new Date("2026-04-10T00:00:00.000Z"),
      },
    )

    await repository.save(invitation)

    await expect(repository.findById("invite-1")).resolves.toEqual(invitation)
    await expect(
      repository.findPendingByWorkspaceIdAndGithubLogin("ws-1", "octocat"),
    ).resolves.toEqual(invitation)
    await expect(repository.listByWorkspaceId("ws-1")).resolves.toEqual([
      invitation,
    ])
  })

  it("persists accepted invitation state", async () => {
    testDatabase = await createTestDatabase()
    await testDatabase.prisma.user.createMany({
      data: [
        {
          id: "owner-1",
          githubLogin: "owner",
        },
        {
          id: "user-2",
          githubLogin: "octocat",
        },
      ],
    })
    await testDatabase.prisma.workspace.create({
      data: {
        id: "ws-1",
        slug: "harbor-team",
        name: "Harbor Team",
        type: "team",
        status: "active",
        createdByUserId: "owner-1",
        memberships: {
          create: {
            userId: "owner-1",
            role: "owner",
            status: "active",
          },
        },
      },
    })
    const repository = new PrismaWorkspaceInvitationRepository(
      testDatabase.prisma,
    )
    const invitation = createWorkspaceInvitation(
      createWorkspace({
        id: "ws-1",
        name: "Harbor Team",
        type: "team",
        createdByUserId: "owner-1",
      }),
      {
        id: "invite-1",
        inviteeGithubLogin: "octocat",
        invitedByUserId: "owner-1",
      },
    )
    await repository.save(invitation)

    await repository.save(
      acceptWorkspaceInvitation(
        invitation,
        {
          acceptedByUserId: "user-2",
        },
        new Date("2026-04-10T01:00:00.000Z"),
      ),
    )

    await expect(repository.findById("invite-1")).resolves.toEqual(
      expect.objectContaining({
        status: "accepted",
        acceptedByUserId: "user-2",
      }),
    )
  })
})
