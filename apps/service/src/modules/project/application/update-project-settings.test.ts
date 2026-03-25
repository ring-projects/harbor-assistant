import { describe, expect, it, vi } from "vitest"

import { createProject } from "../domain/project"
import { PROJECT_ERROR_CODES, ProjectError } from "../errors"
import { updateProjectSettingsUseCase } from "./update-project-settings"
import type { ProjectRepository } from "./project-repository"

describe("updateProjectSettingsUseCase", () => {
  it("updates project settings through the aggregate", async () => {
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

    const updated = await updateProjectSettingsUseCase(repository, {
      projectId: "project-1",
      changes: {
        execution: {
          maxConcurrentTasks: 3,
          defaultExecutionMode: "connected",
        },
      },
    })

    expect(repository.findById).toHaveBeenCalledWith("project-1")
    expect(repository.save).toHaveBeenCalledOnce()
    expect(updated.settings.execution.maxConcurrentTasks).toBe(3)
    expect(updated.settings.execution.defaultExecutionMode).toBe("connected")
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
      updateProjectSettingsUseCase(repository, {
        projectId: "missing",
        changes: {
          execution: {
            maxConcurrentTasks: 2,
          },
        },
      }),
    ).rejects.toMatchObject({
      code: PROJECT_ERROR_CODES.NOT_FOUND,
    } satisfies Partial<ProjectError>)

    expect(repository.save).not.toHaveBeenCalled()
  })
})
