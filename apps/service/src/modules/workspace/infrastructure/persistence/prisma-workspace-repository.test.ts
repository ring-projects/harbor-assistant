import { afterEach, describe, expect, it } from "vitest"

import {
  addWorkspaceMember,
  createWorkspace,
  removeWorkspaceMember,
  updateWorkspaceSettings,
} from "../../domain/workspace"
import { PrismaWorkspaceRepository } from "./prisma-workspace-repository"
import {
  createTestDatabase,
  type TestDatabase,
} from "../../../../../test/helpers/test-database"

describe("PrismaWorkspaceRepository", () => {
  let testDatabase: TestDatabase | null = null

  afterEach(async () => {
    await testDatabase?.cleanup()
    testDatabase = null
  })

  it("saves and reloads a workspace with memberships", async () => {
    testDatabase = await createTestDatabase()
    await testDatabase.prisma.user.createMany({
      data: [
        {
          id: "user-1",
          githubLogin: "owner",
        },
        {
          id: "user-2",
          githubLogin: "member",
        },
      ],
    })
    const repository = new PrismaWorkspaceRepository(testDatabase.prisma)

    const workspace = addWorkspaceMember(
      createWorkspace({
        id: "ws-1",
        name: "Harbor Team",
        type: "team",
        createdByUserId: "user-1",
        now: new Date("2026-04-10T00:00:00.000Z"),
      }),
      {
        userId: "user-2",
      },
      new Date("2026-04-10T01:00:00.000Z"),
    )

    await repository.save(workspace)

    const loaded = await repository.findById("ws-1")

    expect(loaded).not.toBeNull()
    expect(loaded?.settings.codex).toEqual({
      baseUrl: null,
      apiKey: null,
    })
    expect(loaded?.memberships).toEqual([
      expect.objectContaining({
        userId: "user-1",
        role: "owner",
        status: "active",
      }),
      expect.objectContaining({
        userId: "user-2",
        role: "member",
        status: "active",
      }),
    ])
  })

  it("saves and reloads codex settings", async () => {
    testDatabase = await createTestDatabase()
    await testDatabase.prisma.user.create({
      data: {
        id: "user-1",
        githubLogin: "owner",
      },
    })
    const repository = new PrismaWorkspaceRepository(testDatabase.prisma)
    const workspace = updateWorkspaceSettings(
      createWorkspace({
        id: "ws-1",
        name: "Harbor Team",
        type: "team",
        createdByUserId: "user-1",
      }),
      {
        codex: {
          baseUrl: "https://gateway.example.com/v1",
          apiKey: "token-1",
        },
      },
    )

    await repository.save(workspace)

    const loaded = await repository.findById("ws-1")

    expect(loaded?.settings.codex).toEqual({
      baseUrl: "https://gateway.example.com/v1",
      apiKey: "token-1",
    })
  })

  it("persists member removal state", async () => {
    testDatabase = await createTestDatabase()
    await testDatabase.prisma.user.createMany({
      data: [
        {
          id: "user-1",
          githubLogin: "owner",
        },
        {
          id: "user-2",
          githubLogin: "member",
        },
      ],
    })
    const repository = new PrismaWorkspaceRepository(testDatabase.prisma)

    const activeWorkspace = addWorkspaceMember(
      createWorkspace({
        id: "ws-1",
        name: "Harbor Team",
        type: "team",
        createdByUserId: "user-1",
      }),
      {
        userId: "user-2",
      },
    )
    await repository.save(activeWorkspace)

    await repository.save(
      removeWorkspaceMember(
        activeWorkspace,
        "user-2",
        new Date("2026-04-10T02:00:00.000Z"),
      ),
    )

    const loaded = await repository.findById("ws-1")

    expect(
      loaded?.memberships.find((membership) => membership.userId === "user-2"),
    ).toEqual(
      expect.objectContaining({
        userId: "user-2",
        status: "removed",
      }),
    )
  })
})
