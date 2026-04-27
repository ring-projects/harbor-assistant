import { describe, expect, it, vi } from "vitest"

import { PROJECT_ERROR_CODES, ProjectError } from "../errors"
import { createProject } from "../domain/project"
import type { ProjectRepository } from "./project-repository"
import { deleteProjectUseCase } from "./delete-project"

describe("deleteProjectUseCase", () => {
  it("deletes an existing project", async () => {
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

    const result = await deleteProjectUseCase(repository, "project-1")

    expect(repository.delete).toHaveBeenCalledWith("project-1")
    expect(result).toEqual({
      projectId: "project-1",
    })
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
      deleteProjectUseCase(repository, "missing"),
    ).rejects.toMatchObject({
      code: PROJECT_ERROR_CODES.NOT_FOUND,
    } satisfies Partial<ProjectError>)

    expect(repository.delete).not.toHaveBeenCalled()
  })
})
