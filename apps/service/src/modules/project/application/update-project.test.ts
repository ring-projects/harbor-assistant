import { describe, expect, it, vi } from "vitest"

import { createProject } from "../domain/project"
import { createProjectError } from "../errors"
import { InMemoryProjectRepository } from "../infrastructure/in-memory-project-repository"
import type { ProjectPathPolicy } from "./project-path-policy"
import { updateProjectUseCase } from "./update-project"

describe("updateProjectUseCase", () => {
  it("updates profile and root path in one save", async () => {
    const repository = new InMemoryProjectRepository()
    const project = createProject({
      id: "project-1",
      name: "Harbor Assistant",
      normalizedPath: "/workspace/harbor-assistant",
    })
    await repository.save(project)

    const pathPolicy: ProjectPathPolicy = {
      canonicalizeProjectRoot: vi.fn(async (rawPath: string) =>
        rawPath.replace(/^~\//, "/resolved/"),
      ),
    }

    const updated = await updateProjectUseCase(repository, pathPolicy, {
      projectId: "project-1",
      changes: {
        name: "Harbor Service",
        description: "Core service workspace",
        rootPath: "~/workspace/harbor-service",
      },
    })

    expect(updated).toMatchObject({
      id: "project-1",
      name: "Harbor Service",
      slug: "harbor-service",
      description: "Core service workspace",
      normalizedPath: "/resolved/workspace/harbor-service",
      rootPath: "/resolved/workspace/harbor-service",
    })
    expect(pathPolicy.canonicalizeProjectRoot).toHaveBeenCalledWith(
      "~/workspace/harbor-service",
    )
  })

  it("does not partially save when root path conflicts", async () => {
    const repository = new InMemoryProjectRepository()
    const project = createProject({
      id: "project-1",
      name: "Harbor Assistant",
      normalizedPath: "/workspace/harbor-assistant",
    })
    const duplicate = createProject({
      id: "project-2",
      name: "Harbor Service",
      normalizedPath: "/resolved/workspace/harbor-service",
    })
    await repository.save(project)
    await repository.save(duplicate)

    const pathPolicy: ProjectPathPolicy = {
      canonicalizeProjectRoot: vi
        .fn()
        .mockResolvedValue("/resolved/workspace/harbor-service"),
    }

    await expect(
      updateProjectUseCase(repository, pathPolicy, {
        projectId: "project-1",
        changes: {
          name: "Renamed Harbor",
          rootPath: "~/workspace/harbor-service",
        },
      }),
    ).rejects.toMatchObject({
      code: createProjectError().duplicatePath().code,
    })

    const persisted = await repository.findById("project-1")
    expect(persisted).toMatchObject({
      id: "project-1",
      name: "Harbor Assistant",
      slug: "harbor-assistant",
      normalizedPath: "/workspace/harbor-assistant",
      rootPath: "/workspace/harbor-assistant",
    })
  })

  it("rejects root path relocation for git-backed projects", async () => {
    const repository = new InMemoryProjectRepository()
    const project = createProject({
      id: "project-1",
      name: "Harbor Assistant",
      source: {
        type: "git",
        repositoryUrl: "https://github.com/acme/harbor-assistant.git",
      },
    })
    await repository.save(project)

    const pathPolicy: ProjectPathPolicy = {
      canonicalizeProjectRoot: vi.fn(async (rawPath: string) =>
        rawPath.replace(/^~\//, "/resolved/"),
      ),
    }

    await expect(
      updateProjectUseCase(repository, pathPolicy, {
        projectId: "project-1",
        changes: {
          rootPath: "~/workspace/harbor-assistant",
        },
      }),
    ).rejects.toMatchObject({
      code: createProjectError().invalidState("").code,
    })
  })
})
