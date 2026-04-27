import { describe, expect, it, vi } from "vitest"

import { createProjectUseCase } from "./create-project"
import { PROJECT_ERROR_CODES, ProjectError } from "../errors"
import type { ProjectRepository } from "./project-repository"
import type { ProjectPathPolicy } from "./project-path-policy"

describe("createProjectUseCase", () => {
  function createPathPolicy(): ProjectPathPolicy {
    return {
      canonicalizeProjectRoot: vi.fn(async (rawPath: string) =>
        rawPath.trim().replace(/^~\//, "/resolved/"),
      ),
    }
  }

  function createRepository(
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

  it("creates and saves a fresh rootPath project aggregate", async () => {
    const repository = createRepository()
    const pathPolicy = createPathPolicy()

    const project = await createProjectUseCase(repository, pathPolicy, {
      id: "project-1",
      name: "Harbor Assistant",
      source: {
        type: "rootPath",
        rootPath: "~/harbor-assistant",
      },
    })

    expect(pathPolicy.canonicalizeProjectRoot).toHaveBeenCalledWith(
      "~/harbor-assistant",
    )
    expect(repository.findByNormalizedPath).toHaveBeenCalledWith(
      "/resolved/harbor-assistant",
    )
    expect(repository.save).toHaveBeenCalledOnce()
    expect(project.name).toBe("Harbor Assistant")
    expect(project.normalizedPath).toBe("/resolved/harbor-assistant")
    expect(project.rootPath).toBe("/resolved/harbor-assistant")
    expect(project.source).toEqual({
      type: "rootPath",
      rootPath: "/resolved/harbor-assistant",
      normalizedPath: "/resolved/harbor-assistant",
    })
    expect(project.settings.retention.logRetentionDays).toBe(30)
  })

  it("creates a git project without canonicalizing a local path", async () => {
    const repository = createRepository()
    const pathPolicy = createPathPolicy()

    const project = await createProjectUseCase(repository, pathPolicy, {
      id: "project-1",
      name: "Harbor Assistant",
      source: {
        type: "git",
        repositoryUrl: "https://github.com/acme/harbor-assistant.git",
        branch: "main",
      },
    })

    expect(pathPolicy.canonicalizeProjectRoot).not.toHaveBeenCalled()
    expect(repository.findByNormalizedPath).not.toHaveBeenCalled()
    expect(project.rootPath).toBeNull()
    expect(project.normalizedPath).toBeNull()
    expect(project.source).toEqual({
      type: "git",
      repositoryUrl: "https://github.com/acme/harbor-assistant.git",
      branch: "main",
    })
  })

  it("rejects duplicate normalized path", async () => {
    const repository = createRepository({
      findByNormalizedPath: vi.fn().mockResolvedValue({
        id: "existing",
        ownerUserId: null,
        slug: "existing",
        name: "Existing",
        description: null,
        source: {
          type: "rootPath",
          rootPath: "/tmp/harbor-assistant",
          normalizedPath: "/tmp/harbor-assistant",
        },
        rootPath: "/tmp/harbor-assistant",
        normalizedPath: "/tmp/harbor-assistant",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
        archivedAt: null,
        lastOpenedAt: null,
        settings: {
          retention: {
            logRetentionDays: 30,
            eventRetentionDays: 7,
          },
        },
      }),
    })
    const pathPolicy = createPathPolicy()

    await expect(
      createProjectUseCase(repository, pathPolicy, {
        id: "project-1",
        name: "Harbor Assistant",
        source: {
          type: "rootPath",
          rootPath: "/tmp/harbor-assistant",
        },
      }),
    ).rejects.toMatchObject({
      code: PROJECT_ERROR_CODES.DUPLICATE_PATH,
    } satisfies Partial<ProjectError>)

    expect(repository.save).not.toHaveBeenCalled()
  })

  it("canonicalizes rootPath when it is provided explicitly", async () => {
    const repository = createRepository()
    const pathPolicy = createPathPolicy()

    const project = await createProjectUseCase(repository, pathPolicy, {
      id: "project-1",
      name: "Harbor Assistant",
      source: {
        type: "rootPath",
        rootPath: "~/workspace/harbor-assistant",
      },
    })

    expect(pathPolicy.canonicalizeProjectRoot).toHaveBeenCalledWith(
      "~/workspace/harbor-assistant",
    )
    expect(project.normalizedPath).toBe("/resolved/workspace/harbor-assistant")
    expect(project.rootPath).toBe("/resolved/workspace/harbor-assistant")
  })
})
