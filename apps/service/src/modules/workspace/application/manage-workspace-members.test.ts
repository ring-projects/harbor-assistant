import { describe, expect, it, vi } from "vitest"

import {
  addWorkspaceMemberUseCase,
  listWorkspaceMembersForUserUseCase,
  removeWorkspaceMemberUseCase,
} from "./manage-workspace-members"
import type { WorkspaceRepository } from "./workspace-repository"
import type { UserDirectory } from "../../user"
import { createWorkspace } from "../domain/workspace"
import { WORKSPACE_ERROR_CODES, WorkspaceError } from "../errors"

describe("workspace member management use cases", () => {
  function createRepository(
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

  function createUserDirectory(
    overrides: Partial<UserDirectory> = {},
  ): UserDirectory {
    return {
      findByGithubLogin: vi.fn().mockResolvedValue(null),
      findById: vi.fn().mockResolvedValue(null),
      ...overrides,
    }
  }

  it("allows an owner to add an existing Harbor user to a team workspace", async () => {
    const workspace = createWorkspace({
      id: "ws-1",
      name: "Harbor Team",
      type: "team",
      createdByUserId: "user-1",
    })
    const repository = createRepository({
      findById: vi.fn().mockResolvedValue(workspace),
    })
    const userDirectory = createUserDirectory({
      findByGithubLogin: vi.fn().mockResolvedValue({
        id: "user-2",
        githubLogin: "octocat",
        name: "Octocat",
      }),
    })

    const result = await addWorkspaceMemberUseCase(
      {
        workspaceRepository: repository,
        userDirectory,
      },
      {
        workspaceId: "ws-1",
        actorUserId: "user-1",
        githubLogin: "octocat",
        now: new Date("2026-04-10T01:00:00.000Z"),
      },
    )

    expect(repository.save).toHaveBeenCalledOnce()
    expect(result.membership).toMatchObject({
      userId: "user-2",
      role: "member",
      status: "active",
    })
    expect(
      result.workspace.memberships.some(
        (membership) => membership.userId === "user-2",
      ),
    ).toBe(true)
  })

  it("rejects adding members when the actor is not an owner", async () => {
    const workspace = {
      ...createWorkspace({
        id: "ws-1",
        name: "Harbor Team",
        type: "team",
        createdByUserId: "user-1",
      }),
      memberships: [
        {
          workspaceId: "ws-1",
          userId: "user-1",
          role: "owner" as const,
          status: "active" as const,
          createdAt: new Date("2026-04-10T00:00:00.000Z"),
          updatedAt: new Date("2026-04-10T00:00:00.000Z"),
        },
        {
          workspaceId: "ws-1",
          userId: "user-2",
          role: "member" as const,
          status: "active" as const,
          createdAt: new Date("2026-04-10T00:00:00.000Z"),
          updatedAt: new Date("2026-04-10T00:00:00.000Z"),
        },
      ],
    }
    const repository = createRepository({
      findById: vi.fn().mockResolvedValue(workspace),
    })

    await expect(
      addWorkspaceMemberUseCase(
        {
          workspaceRepository: repository,
          userDirectory: createUserDirectory({
            findByGithubLogin: vi.fn().mockResolvedValue({
              id: "user-3",
              githubLogin: "new-user",
              name: null,
            }),
          }),
        },
        {
          workspaceId: "ws-1",
          actorUserId: "user-2",
          githubLogin: "new-user",
        },
      ),
    ).rejects.toMatchObject({
      code: WORKSPACE_ERROR_CODES.INVALID_STATE,
    } satisfies Partial<WorkspaceError>)
  })

  it("allows an owner to remove a non-owner member", async () => {
    const workspace = {
      ...createWorkspace({
        id: "ws-1",
        name: "Harbor Team",
        type: "team",
        createdByUserId: "user-1",
      }),
      memberships: [
        {
          workspaceId: "ws-1",
          userId: "user-1",
          role: "owner" as const,
          status: "active" as const,
          createdAt: new Date("2026-04-10T00:00:00.000Z"),
          updatedAt: new Date("2026-04-10T00:00:00.000Z"),
        },
        {
          workspaceId: "ws-1",
          userId: "user-2",
          role: "member" as const,
          status: "active" as const,
          createdAt: new Date("2026-04-10T00:00:00.000Z"),
          updatedAt: new Date("2026-04-10T00:00:00.000Z"),
        },
      ],
    }
    const repository = createRepository({
      findById: vi.fn().mockResolvedValue(workspace),
    })

    const result = await removeWorkspaceMemberUseCase(
      {
        workspaceRepository: repository,
      },
      {
        workspaceId: "ws-1",
        actorUserId: "user-1",
        memberUserId: "user-2",
        now: new Date("2026-04-10T02:00:00.000Z"),
      },
    )

    expect(result.membership).toMatchObject({
      userId: "user-2",
      status: "removed",
    })
  })

  it("rejects member listing for outsiders", async () => {
    const repository = createRepository({
      findById: vi.fn().mockResolvedValue(
        createWorkspace({
          id: "ws-1",
          name: "Harbor Team",
          type: "team",
          createdByUserId: "user-1",
        }),
      ),
    })

    await expect(
      listWorkspaceMembersForUserUseCase(repository, {
        workspaceId: "ws-1",
        actorUserId: "user-2",
      }),
    ).rejects.toMatchObject({
      code: WORKSPACE_ERROR_CODES.NOT_FOUND,
    } satisfies Partial<WorkspaceError>)
  })
})
