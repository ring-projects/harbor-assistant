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

  it("creates and saves a fresh project aggregate", async () => {
    const repository: ProjectRepository = {
      findById: vi.fn().mockResolvedValue(null),
      findByNormalizedPath: vi.fn().mockResolvedValue(null),
      findBySlug: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    }
    const pathPolicy = createPathPolicy()

    const project = await createProjectUseCase(repository, pathPolicy, {
      id: "project-1",
      name: "Harbor Assistant",
      rootPath: "~/harbor-assistant",
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
    expect(project.settings.execution.defaultExecutor).toBe("codex")
  })

  it("rejects duplicate normalized path", async () => {
    const repository: ProjectRepository = {
      findById: vi.fn().mockResolvedValue(null),
      findByNormalizedPath: vi.fn().mockResolvedValue({
        id: "existing",
        slug: "existing",
        name: "Existing",
        description: null,
        rootPath: "/tmp/harbor-assistant",
        normalizedPath: "/tmp/harbor-assistant",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
        archivedAt: null,
        lastOpenedAt: null,
        settings: {
          execution: {
            defaultExecutor: "codex",
            defaultModel: null,
            defaultExecutionMode: "safe",
            maxConcurrentTasks: 1,
          },
          retention: {
            logRetentionDays: 30,
            eventRetentionDays: 7,
          },
          skills: {
            harborSkillsEnabled: false,
            harborSkillProfile: "default",
          },
        },
      }),
      findBySlug: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    }
    const pathPolicy = createPathPolicy()

    await expect(
      createProjectUseCase(repository, pathPolicy, {
        id: "project-1",
        name: "Harbor Assistant",
        rootPath: "/tmp/harbor-assistant",
      }),
    ).rejects.toMatchObject({
      code: PROJECT_ERROR_CODES.DUPLICATE_PATH,
    } satisfies Partial<ProjectError>)

    expect(repository.save).not.toHaveBeenCalled()
  })

  it("canonicalizes rootPath when it is provided explicitly", async () => {
    const repository: ProjectRepository = {
      findById: vi.fn().mockResolvedValue(null),
      findByNormalizedPath: vi.fn().mockResolvedValue(null),
      findBySlug: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    }
    const pathPolicy = createPathPolicy()

    const project = await createProjectUseCase(repository, pathPolicy, {
      id: "project-1",
      name: "Harbor Assistant",
      rootPath: "~/workspace/harbor-assistant",
    })

    expect(pathPolicy.canonicalizeProjectRoot).toHaveBeenCalledWith(
      "~/workspace/harbor-assistant",
    )
    expect(project.normalizedPath).toBe("/resolved/workspace/harbor-assistant")
    expect(project.rootPath).toBe("/resolved/workspace/harbor-assistant")
  })
})
