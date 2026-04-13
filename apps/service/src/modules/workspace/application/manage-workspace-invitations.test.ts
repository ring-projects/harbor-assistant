import { describe, expect, it, vi } from "vitest"

import {
  acceptWorkspaceInvitationUseCase,
  createWorkspaceInvitationUseCase,
} from "./manage-workspace-invitations"
import type { WorkspaceRepository } from "./workspace-repository"
import type { WorkspaceInvitationRepository } from "./workspace-invitation-repository"
import { addWorkspaceMember, createWorkspace } from "../domain/workspace"
import { WORKSPACE_ERROR_CODES, WorkspaceError } from "../errors"

describe("workspace invitation use cases", () => {
  function createWorkspaceRepository(
    overrides: Partial<WorkspaceRepository> = {},
  ): WorkspaceRepository {
    return {
      findById: vi.fn().mockResolvedValue(null),
      findPersonalByUserId: vi.fn().mockResolvedValue(null),
      listByMemberUserId: vi.fn().mockResolvedValue([]),
      listMembers: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    }
  }

  function createInvitationRepository(
    overrides: Partial<WorkspaceInvitationRepository> = {},
  ): WorkspaceInvitationRepository {
    return {
      findById: vi.fn().mockResolvedValue(null),
      findPendingByWorkspaceIdAndGithubLogin: vi.fn().mockResolvedValue(null),
      listByWorkspaceId: vi.fn().mockResolvedValue([]),
      listPendingByGithubLogin: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    }
  }

  it("allows an owner to create an invitation", async () => {
    const workspace = createWorkspace({
      id: "ws-1",
      name: "Harbor Team",
      type: "team",
      createdByUserId: "user-1",
    })
    const workspaceRepository = createWorkspaceRepository({
      findById: vi.fn().mockResolvedValue(workspace),
    })
    const invitationRepository = createInvitationRepository()

    const invitation = await createWorkspaceInvitationUseCase(
      {
        workspaceRepository,
        invitationRepository,
      },
      {
        workspaceId: "ws-1",
        actorUserId: "user-1",
        inviteeGithubLogin: "octocat",
        idGenerator: () => "invite-1",
        now: new Date("2026-04-10T00:00:00.000Z"),
      },
    )

    expect(invitation.id).toBe("invite-1")
    expect(invitationRepository.save).toHaveBeenCalledOnce()
  })

  it("returns an existing pending invitation idempotently", async () => {
    const workspace = createWorkspace({
      id: "ws-1",
      name: "Harbor Team",
      type: "team",
      createdByUserId: "user-1",
    })
    const existingInvitation = {
      id: "invite-1",
      workspaceId: "ws-1",
      inviteeGithubLogin: "octocat",
      role: "member" as const,
      status: "pending" as const,
      invitedByUserId: "user-1",
      acceptedByUserId: null,
      createdAt: new Date("2026-04-10T00:00:00.000Z"),
      updatedAt: new Date("2026-04-10T00:00:00.000Z"),
      acceptedAt: null,
    }
    const workspaceRepository = createWorkspaceRepository({
      findById: vi.fn().mockResolvedValue(workspace),
    })
    const invitationRepository = createInvitationRepository({
      findPendingByWorkspaceIdAndGithubLogin: vi.fn().mockResolvedValue(
        existingInvitation,
      ),
    })

    const invitation = await createWorkspaceInvitationUseCase(
      {
        workspaceRepository,
        invitationRepository,
      },
      {
        workspaceId: "ws-1",
        actorUserId: "user-1",
        inviteeGithubLogin: "octocat",
      },
    )

    expect(invitation).toBe(existingInvitation)
    expect(invitationRepository.save).not.toHaveBeenCalled()
  })

  it("accepts an invitation and materializes membership", async () => {
    const workspace = createWorkspace({
      id: "ws-1",
      name: "Harbor Team",
      type: "team",
      createdByUserId: "user-1",
    })
    const invitation = {
      id: "invite-1",
      workspaceId: "ws-1",
      inviteeGithubLogin: "octocat",
      role: "member" as const,
      status: "pending" as const,
      invitedByUserId: "user-1",
      acceptedByUserId: null,
      createdAt: new Date("2026-04-10T00:00:00.000Z"),
      updatedAt: new Date("2026-04-10T00:00:00.000Z"),
      acceptedAt: null,
    }
    const workspaceRepository = createWorkspaceRepository({
      findById: vi.fn().mockResolvedValue(workspace),
    })
    const invitationRepository = createInvitationRepository({
      findById: vi.fn().mockResolvedValue(invitation),
    })

    const result = await acceptWorkspaceInvitationUseCase(
      {
        workspaceRepository,
        invitationRepository,
      },
      {
        invitationId: "invite-1",
        actorUserId: "user-2",
        actorGithubLogin: "octocat",
        now: new Date("2026-04-10T01:00:00.000Z"),
      },
    )

    expect(
      result.workspace.memberships.find((membership) => membership.userId === "user-2"),
    ).toEqual(
      expect.objectContaining({
        userId: "user-2",
        status: "active",
      }),
    )
    expect(result.invitation.status).toBe("accepted")
  })

  it("rejects accepting an invitation for another github login", async () => {
    const workspaceRepository = createWorkspaceRepository({
      findById: vi.fn().mockResolvedValue(
        createWorkspace({
          id: "ws-1",
          name: "Harbor Team",
          type: "team",
          createdByUserId: "user-1",
        }),
      ),
    })
    const invitationRepository = createInvitationRepository({
      findById: vi.fn().mockResolvedValue({
        id: "invite-1",
        workspaceId: "ws-1",
        inviteeGithubLogin: "octocat",
        role: "member",
        status: "pending",
        invitedByUserId: "user-1",
        acceptedByUserId: null,
        createdAt: new Date("2026-04-10T00:00:00.000Z"),
        updatedAt: new Date("2026-04-10T00:00:00.000Z"),
        acceptedAt: null,
      }),
    })

    await expect(
      acceptWorkspaceInvitationUseCase(
        {
          workspaceRepository,
          invitationRepository,
        },
        {
          invitationId: "invite-1",
          actorUserId: "user-2",
          actorGithubLogin: "someone-else",
        },
      ),
    ).rejects.toMatchObject({
      code: WORKSPACE_ERROR_CODES.INVALID_STATE,
    } satisfies Partial<WorkspaceError>)
  })
})
