import { describe, expect, it, vi } from "vitest"

import { ensurePersonalWorkspaceUseCase } from "./ensure-personal-workspace"
import type { WorkspaceRepository } from "./workspace-repository"
import { createWorkspace } from "../domain/workspace"

describe("ensurePersonalWorkspaceUseCase", () => {
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

  it("creates a personal workspace on first use", async () => {
    const repository = createRepository()

    const workspace = await ensurePersonalWorkspaceUseCase(repository, {
      userId: "user-1",
      fallbackName: "Octocat",
      now: new Date("2026-04-06T00:00:00.000Z"),
    })

    expect(repository.findPersonalByUserId).toHaveBeenCalledWith("user-1")
    expect(repository.save).toHaveBeenCalledOnce()
    expect(workspace.type).toBe("personal")
    expect(workspace.memberships).toEqual([
      expect.objectContaining({
        workspaceId: workspace.id,
        userId: "user-1",
        role: "owner",
      }),
    ])
  })

  it("reuses the existing personal workspace", async () => {
    const existingWorkspace = createWorkspace({
      id: "ws_existing",
      name: "Octocat",
      type: "personal",
      createdByUserId: "user-1",
      now: new Date("2026-04-05T00:00:00.000Z"),
    })
    const repository = createRepository({
      findPersonalByUserId: vi.fn().mockResolvedValue(existingWorkspace),
    })

    const workspace = await ensurePersonalWorkspaceUseCase(repository, {
      userId: "user-1",
      fallbackName: "Ignored",
    })

    expect(repository.save).not.toHaveBeenCalled()
    expect(workspace).toBe(existingWorkspace)
  })
})
