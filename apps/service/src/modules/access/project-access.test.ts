import { describe, expect, it, vi } from "vitest"

import { createAccessibleProjectRepository } from "./project-access"
import type { ProjectRepository } from "../project/application/project-repository"
import { createProject } from "../project/domain/project"
import { createWorkspace, type WorkspaceRepository } from "../workspace"

describe("createAccessibleProjectRepository", () => {
  function createProjectRepository(
    overrides: Partial<ProjectRepository> = {},
  ): ProjectRepository {
    return {
      findById: vi.fn().mockResolvedValue(null),
      findByNormalizedPath: vi.fn().mockResolvedValue(null),
      findBySlug: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    }
  }

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

  it("allows access to projects in a workspace where the user is an active member", async () => {
    const workspace = createWorkspace({
      id: "ws_1",
      name: "Harbor",
      type: "team",
      createdByUserId: "user-1",
    })
    const project = {
      ...createProject({
        id: "project-1",
        name: "Harbor Assistant",
        normalizedPath: "/tmp/harbor-assistant",
        ownerUserId: "user-1",
      }),
      workspaceId: "ws_1",
    }
    const repository = createAccessibleProjectRepository(
      createProjectRepository({
        findById: vi.fn().mockResolvedValue(project),
      }),
      createWorkspaceRepository({
        findById: vi.fn().mockResolvedValue(workspace),
      }),
      "user-1",
    )

    await expect(repository.findById("project-1")).resolves.toEqual(project)
  })

  it("rejects projects in workspaces where the user is not a member", async () => {
    const workspace = createWorkspace({
      id: "ws_1",
      name: "Harbor",
      type: "team",
      createdByUserId: "user-2",
    })
    const project = {
      ...createProject({
        id: "project-1",
        name: "Harbor Assistant",
        normalizedPath: "/tmp/harbor-assistant",
        ownerUserId: "user-2",
      }),
      workspaceId: "ws_1",
    }
    const repository = createAccessibleProjectRepository(
      createProjectRepository({
        findById: vi.fn().mockResolvedValue(project),
      }),
      createWorkspaceRepository({
        findById: vi.fn().mockResolvedValue(workspace),
      }),
      "user-1",
    )

    await expect(repository.findById("project-1")).resolves.toBeNull()
  })

  it("keeps owner fallback for projects that are not migrated to a workspace yet", async () => {
    const legacyProject = createProject({
      id: "project-1",
      name: "Legacy Project",
      normalizedPath: "/tmp/legacy-project",
      ownerUserId: "user-1",
    })
    const repository = createAccessibleProjectRepository(
      createProjectRepository({
        findById: vi.fn().mockResolvedValue(legacyProject),
      }),
      createWorkspaceRepository(),
      "user-1",
    )

    await expect(repository.findById("project-1")).resolves.toEqual(legacyProject)
  })
})
