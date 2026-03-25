import { describe, expect, it, vi } from "vitest"

import { createProject } from "../domain/project"
import { PROJECT_ERROR_CODES, ProjectError } from "../errors"
import type { ProjectRepository } from "./project-repository"
import { archiveProjectUseCase } from "./archive-project"
import { restoreProjectUseCase } from "./restore-project"

describe("project lifecycle use cases", () => {
  it("archives a project through the aggregate", async () => {
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

    const archived = await archiveProjectUseCase(repository, "project-1")

    expect(archived.status).toBe("archived")
    expect(repository.save).toHaveBeenCalledOnce()
  })

  it("restores an archived project through the aggregate", async () => {
    const current = {
      ...createProject({
        id: "project-1",
        name: "Harbor Assistant",
        normalizedPath: "/tmp/harbor-assistant",
      }),
      status: "archived" as const,
      archivedAt: new Date("2026-03-25T00:00:00.000Z"),
    }

    const repository: ProjectRepository = {
      findById: vi.fn().mockResolvedValue(current),
      findByNormalizedPath: vi.fn().mockResolvedValue(null),
      findBySlug: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue([current]),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    }

    const restored = await restoreProjectUseCase(repository, "project-1")

    expect(restored.status).toBe("active")
    expect(restored.archivedAt).toBeNull()
    expect(repository.save).toHaveBeenCalledOnce()
  })

  it("fails when archiving a missing project", async () => {
    const repository: ProjectRepository = {
      findById: vi.fn().mockResolvedValue(null),
      findByNormalizedPath: vi.fn().mockResolvedValue(null),
      findBySlug: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    }

    await expect(archiveProjectUseCase(repository, "missing")).rejects.toThrow(
      expect.objectContaining({
        code: PROJECT_ERROR_CODES.NOT_FOUND,
      } satisfies Partial<ProjectError>),
    )
  })

  it("returns invalid-state for archive on archived project", async () => {
    const current = {
      ...createProject({
        id: "project-1",
        name: "Harbor Assistant",
        normalizedPath: "/tmp/harbor-assistant",
      }),
      status: "archived" as const,
      archivedAt: new Date("2026-03-25T00:00:00.000Z"),
    }

    const repository: ProjectRepository = {
      findById: vi.fn().mockResolvedValue(current),
      findByNormalizedPath: vi.fn().mockResolvedValue(null),
      findBySlug: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue([current]),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    }

    await expect(archiveProjectUseCase(repository, "project-1")).rejects.toMatchObject({
      code: PROJECT_ERROR_CODES.INVALID_STATE,
    } satisfies Partial<ProjectError>)
  })
})
