import Fastify from "fastify"
import { describe, expect, it } from "vitest"

import errorHandlerPlugin from "../../../plugins/error-handler"
import { InMemoryUserDirectory } from "../../user"
import { registerWorkspaceModuleRoutes } from "."
import { InMemoryWorkspaceRepository } from "../infrastructure/in-memory-workspace-repository"
import { createWorkspace } from "../domain/workspace"
import { InMemoryWorkspaceInvitationRepository } from "../infrastructure/in-memory-workspace-invitation-repository"

async function createApp() {
  const app = Fastify({ logger: false })
  const repository = new InMemoryWorkspaceRepository()
  const invitationRepository = new InMemoryWorkspaceInvitationRepository()
  const userDirectory = new InMemoryUserDirectory([
    {
      id: "user-1",
      githubLogin: "octocat",
      name: "Octocat",
    },
    {
      id: "user-2",
      githubLogin: "teammate",
      name: "Teammate",
    },
    {
      id: "user-3",
      githubLogin: "outsider",
      name: "Outsider",
    },
  ])
  app.decorateRequest("auth", null)
  app.addHook("onRequest", async (request) => {
    const userId = String(request.headers["x-user-id"] ?? "user-1")
    const githubLogin = String(request.headers["x-user-login"] ?? "octocat")
    request.auth = {
      sessionId: "session-1",
      userId,
      user: {
        id: userId,
        githubLogin,
        name: "Octocat",
        email: "octocat@example.com",
        avatarUrl: null,
        status: "active",
        lastLoginAt: null,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      },
    }
  })
  await app.register(errorHandlerPlugin)
  await app.register(
    async (instance) => {
      await registerWorkspaceModuleRoutes(instance, {
        repository,
        invitationRepository,
        userDirectory,
      })
    },
    { prefix: "/v1" },
  )
  await app.ready()
  return {
    app,
    repository,
    invitationRepository,
  }
}

describe("workspace routes", () => {
  it("lists the current user's personal workspace", async () => {
    const { app } = await createApp()

    const response = await app.inject({
      method: "GET",
      url: "/v1/workspaces",
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      ok: true,
      workspaces: [
        {
          type: "personal",
          memberships: [
            {
              userId: "user-1",
              role: "owner",
            },
          ],
        },
      ],
    })
  })

  it("creates a new team workspace", async () => {
    const { app } = await createApp()

    const response = await app.inject({
      method: "POST",
      url: "/v1/workspaces",
      payload: {
        id: "ws_team",
        name: "Harbor Team",
      },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({
      ok: true,
      workspace: {
        id: "ws_team",
        name: "Harbor Team",
        type: "team",
      },
    })
  })

  it("allows an owner to add a member to a team workspace", async () => {
    const { app, repository } = await createApp()
    await repository.save(
      createWorkspace({
        id: "ws-team",
        name: "Harbor Team",
        type: "team",
        createdByUserId: "user-1",
      }),
    )

    const response = await app.inject({
      method: "POST",
      url: "/v1/workspaces/ws-team/members",
      payload: {
        githubLogin: "teammate",
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      ok: true,
      membership: {
        workspaceId: "ws-team",
        userId: "user-2",
        role: "member",
        status: "active",
      },
    })
  })

  it("returns the membership that was actually added", async () => {
    const { app, repository } = await createApp()
    const workspace = createWorkspace({
      id: "ws-team",
      name: "Harbor Team",
      type: "team",
      createdByUserId: "user-1",
    })
    await repository.save({
      ...workspace,
      memberships: [
        ...workspace.memberships,
        {
          workspaceId: "ws-team",
          userId: "user-2",
          role: "member",
          status: "active",
          createdAt: new Date("2026-04-10T00:00:00.000Z"),
          updatedAt: new Date("2026-04-10T00:00:00.000Z"),
        },
      ],
    })

    const response = await app.inject({
      method: "POST",
      url: "/v1/workspaces/ws-team/members",
      payload: {
        githubLogin: "outsider",
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      ok: true,
      membership: {
        workspaceId: "ws-team",
        userId: "user-3",
        role: "member",
        status: "active",
      },
    })
  })

  it("rejects member addition by a non-owner member", async () => {
    const { app, repository } = await createApp()
    const workspace = createWorkspace({
      id: "ws-team",
      name: "Harbor Team",
      type: "team",
      createdByUserId: "user-1",
    })
    await repository.save({
      ...workspace,
      memberships: [
        ...workspace.memberships,
        {
          workspaceId: "ws-team",
          userId: "user-2",
          role: "member",
          status: "active",
          createdAt: new Date("2026-04-10T00:00:00.000Z"),
          updatedAt: new Date("2026-04-10T00:00:00.000Z"),
        },
      ],
    })

    const response = await app.inject({
      method: "POST",
      url: "/v1/workspaces/ws-team/members",
      headers: {
        "x-user-id": "user-2",
        "x-user-login": "teammate",
      },
      payload: {
        githubLogin: "outsider",
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_WORKSPACE_STATE",
      },
    })
  })

  it("allows an active member to list workspace members", async () => {
    const { app, repository } = await createApp()
    const workspace = createWorkspace({
      id: "ws-team",
      name: "Harbor Team",
      type: "team",
      createdByUserId: "user-1",
    })
    await repository.save({
      ...workspace,
      memberships: [
        ...workspace.memberships,
        {
          workspaceId: "ws-team",
          userId: "user-2",
          role: "member",
          status: "active",
          createdAt: new Date("2026-04-10T00:00:00.000Z"),
          updatedAt: new Date("2026-04-10T00:00:00.000Z"),
        },
      ],
    })

    const response = await app.inject({
      method: "GET",
      url: "/v1/workspaces/ws-team/members",
      headers: {
        "x-user-id": "user-2",
        "x-user-login": "teammate",
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      ok: true,
      memberships: [
        expect.objectContaining({
          userId: "user-1",
          role: "owner",
        }),
        expect.objectContaining({
          userId: "user-2",
          role: "member",
        }),
      ],
    })
  })

  it("allows an owner to remove a normal member", async () => {
    const { app, repository } = await createApp()
    const workspace = createWorkspace({
      id: "ws-team",
      name: "Harbor Team",
      type: "team",
      createdByUserId: "user-1",
    })
    await repository.save({
      ...workspace,
      memberships: [
        ...workspace.memberships,
        {
          workspaceId: "ws-team",
          userId: "user-2",
          role: "member",
          status: "active",
          createdAt: new Date("2026-04-10T00:00:00.000Z"),
          updatedAt: new Date("2026-04-10T00:00:00.000Z"),
        },
      ],
    })

    const response = await app.inject({
      method: "DELETE",
      url: "/v1/workspaces/ws-team/members/user-2",
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      ok: true,
      membership: {
        workspaceId: "ws-team",
        userId: "user-2",
        status: "removed",
      },
    })
  })

  it("allows an owner to create an invitation", async () => {
    const { app, repository } = await createApp()
    await repository.save(
      createWorkspace({
        id: "ws-team",
        name: "Harbor Team",
        type: "team",
        createdByUserId: "user-1",
      }),
    )

    const response = await app.inject({
      method: "POST",
      url: "/v1/workspaces/ws-team/invitations",
      payload: {
        githubLogin: "future-user",
      },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({
      ok: true,
      invitation: {
        workspaceId: "ws-team",
        inviteeGithubLogin: "future-user",
        status: "pending",
      },
    })
  })

  it("lists invitations for an owner", async () => {
    const { app, repository, invitationRepository } = await createApp()
    await repository.save(
      createWorkspace({
        id: "ws-team",
        name: "Harbor Team",
        type: "team",
        createdByUserId: "user-1",
      }),
    )
    await invitationRepository.save({
      id: "invite-1",
      workspaceId: "ws-team",
      inviteeGithubLogin: "future-user",
      role: "member",
      status: "pending",
      invitedByUserId: "user-1",
      acceptedByUserId: null,
      createdAt: new Date("2026-04-10T00:00:00.000Z"),
      updatedAt: new Date("2026-04-10T00:00:00.000Z"),
      acceptedAt: null,
    })

    const response = await app.inject({
      method: "GET",
      url: "/v1/workspaces/ws-team/invitations",
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      ok: true,
      invitations: [
        expect.objectContaining({
          id: "invite-1",
          inviteeGithubLogin: "future-user",
        }),
      ],
    })
  })

  it("allows the invitee to accept an invitation", async () => {
    const { app, repository, invitationRepository } = await createApp()
    await repository.save(
      createWorkspace({
        id: "ws-team",
        name: "Harbor Team",
        type: "team",
        createdByUserId: "user-1",
      }),
    )
    await invitationRepository.save({
      id: "invite-1",
      workspaceId: "ws-team",
      inviteeGithubLogin: "teammate",
      role: "member",
      status: "pending",
      invitedByUserId: "user-1",
      acceptedByUserId: null,
      createdAt: new Date("2026-04-10T00:00:00.000Z"),
      updatedAt: new Date("2026-04-10T00:00:00.000Z"),
      acceptedAt: null,
    })

    const response = await app.inject({
      method: "POST",
      url: "/v1/workspace-invitations/invite-1/accept",
      headers: {
        "x-user-id": "user-2",
        "x-user-login": "teammate",
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      ok: true,
      invitation: {
        id: "invite-1",
        status: "accepted",
        acceptedByUserId: "user-2",
      },
      membership: {
        workspaceId: "ws-team",
        userId: "user-2",
        status: "active",
      },
    })
  })
})
