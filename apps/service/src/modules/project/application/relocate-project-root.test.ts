import { describe, expect, it, vi } from "vitest"

import { createProject } from "../domain/project"
import { PROJECT_ERROR_CODES, ProjectError } from "../errors"
import type { ProjectRepository } from "./project-repository"
import type { ProjectPathPolicy } from "./project-path-policy"
import { relocateProjectRootUseCase } from "./relocate-project-root"

describe("relocateProjectRootUseCase", () => {
  it("canonicalizes and saves the new project root", async () => {
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
    const pathPolicy: ProjectPathPolicy = {
      canonicalizeProjectRoot: vi
        .fn()
        .mockResolvedValue("/private/tmp/harbor-service"),
    }

    const relocated = await relocateProjectRootUseCase(repository, pathPolicy, {
      projectId: "project-1",
      nextPath: "~/workspace/harbor-service",
    })

    expect(pathPolicy.canonicalizeProjectRoot).toHaveBeenCalledWith(
      "~/workspace/harbor-service",
    )
    expect(relocated.normalizedPath).toBe("/private/tmp/harbor-service")
    expect(repository.save).toHaveBeenCalledOnce()
  })

  it("rejects duplicate normalized path", async () => {
    const current = createProject({
      id: "project-1",
      name: "Harbor Assistant",
      normalizedPath: "/tmp/harbor-assistant",
    })
    const existing = createProject({
      id: "project-2",
      name: "Another Project",
      normalizedPath: "/private/tmp/harbor-service",
    })

    const repository: ProjectRepository = {
      findById: vi.fn().mockResolvedValue(current),
      findByNormalizedPath: vi.fn().mockResolvedValue(existing),
      findBySlug: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue([current, existing]),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    }
    const pathPolicy: ProjectPathPolicy = {
      canonicalizeProjectRoot: vi
        .fn()
        .mockResolvedValue("/private/tmp/harbor-service"),
    }

    await expect(
      relocateProjectRootUseCase(repository, pathPolicy, {
        projectId: "project-1",
        nextPath: "~/workspace/harbor-service",
      }),
    ).rejects.toMatchObject({
      code: PROJECT_ERROR_CODES.DUPLICATE_PATH,
    } satisfies Partial<ProjectError>)

    expect(repository.save).not.toHaveBeenCalled()
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
    const pathPolicy: ProjectPathPolicy = {
      canonicalizeProjectRoot: vi
        .fn()
        .mockResolvedValue("/private/tmp/harbor-service"),
    }

    await expect(
      relocateProjectRootUseCase(repository, pathPolicy, {
        projectId: "missing",
        nextPath: "~/workspace/harbor-service",
      }),
    ).rejects.toMatchObject({
      code: PROJECT_ERROR_CODES.NOT_FOUND,
    } satisfies Partial<ProjectError>)
  })
})
