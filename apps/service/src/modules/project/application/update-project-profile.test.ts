import { describe, expect, it, vi } from "vitest"

import { createProject } from "../domain/project"
import { PROJECT_ERROR_CODES, ProjectError } from "../errors"
import type { ProjectRepository } from "./project-repository"
import { updateProjectProfileUseCase } from "./update-project-profile"

describe("updateProjectProfileUseCase", () => {
  it("updates project name and description", async () => {
    const current = createProject({
      id: "project-1",
      name: "Harbor Assistant",
      normalizedPath: "/tmp/harbor-assistant",
    })

    const repository: ProjectRepository = {
      findById: vi.fn().mockResolvedValue(current),
      findByNormalizedPath: vi.fn().mockResolvedValue(null),
      findBySlug: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue([current]),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    }

    const updated = await updateProjectProfileUseCase(repository, {
      projectId: "project-1",
      changes: {
        name: "Harbor Service",
        description: "Core service",
      },
    })

    expect(updated.slug).toBe("harbor-service")
    expect(updated.description).toBe("Core service")
    expect(repository.save).toHaveBeenCalledOnce()
  })

  it("rejects duplicate slug", async () => {
    const current = createProject({
      id: "project-1",
      name: "Harbor Assistant",
      normalizedPath: "/tmp/harbor-assistant",
    })
    const existing = createProject({
      id: "project-2",
      name: "Harbor Service",
      normalizedPath: "/tmp/harbor-service",
    })

    const repository: ProjectRepository = {
      findById: vi.fn().mockResolvedValue(current),
      findByNormalizedPath: vi.fn().mockResolvedValue(null),
      findBySlug: vi.fn().mockResolvedValue(existing),
      list: vi.fn().mockResolvedValue([current, existing]),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    }

    await expect(
      updateProjectProfileUseCase(repository, {
        projectId: "project-1",
        changes: {
          name: "Harbor Service",
        },
      }),
    ).rejects.toMatchObject({
      code: PROJECT_ERROR_CODES.DUPLICATE_SLUG,
    } satisfies Partial<ProjectError>)
  })

  it("fails when the project does not exist", async () => {
    const repository: ProjectRepository = {
      findById: vi.fn().mockResolvedValue(null),
      findByNormalizedPath: vi.fn().mockResolvedValue(null),
      findBySlug: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    }

    await expect(
      updateProjectProfileUseCase(repository, {
        projectId: "missing",
        changes: {
          name: "Harbor Service",
        },
      }),
    ).rejects.toMatchObject({
      code: PROJECT_ERROR_CODES.NOT_FOUND,
    } satisfies Partial<ProjectError>)
  })
})
