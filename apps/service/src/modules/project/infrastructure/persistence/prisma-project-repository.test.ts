import { afterEach, describe, expect, it } from "vitest"

import { createProject, updateProjectSettings } from "../../domain/project"
import { PROJECT_ERROR_CODES, ProjectError } from "../../errors"
import { PrismaProjectRepository } from "./prisma-project-repository"
import {
  createTestDatabase,
  type TestDatabase,
} from "../../../../../test/helpers/test-database"

describe("PrismaProjectRepository", () => {
  let testDatabase: TestDatabase | null = null

  afterEach(async () => {
    await testDatabase?.cleanup()
    testDatabase = null
  })

  it("saves and reloads a project aggregate with settings", async () => {
    testDatabase = await createTestDatabase()
    const repository = new PrismaProjectRepository(testDatabase.prisma)

    const project = updateProjectSettings(
      createProject({
        id: "project-1",
        name: "Harbor Assistant",
        normalizedPath: "/tmp/harbor-assistant",
        now: new Date("2026-03-24T00:00:00.000Z"),
      }),
      {
        retention: {
          logRetentionDays: 14,
        },
      },
    )

    await repository.save(project)

    const loaded = await repository.findById("project-1")

    expect(loaded).not.toBeNull()
    expect(loaded?.name).toBe("Harbor Assistant")
    expect(loaded?.settings.retention.logRetentionDays).toBe(14)
    expect(loaded?.settings.skills.harborSkillsEnabled).toBe(false)
  })

  it("saves and reloads a git-backed project aggregate", async () => {
    testDatabase = await createTestDatabase()
    const repository = new PrismaProjectRepository(testDatabase.prisma)

    const project = createProject({
      id: "project-1",
      name: "Harbor Assistant",
      source: {
        type: "git",
        repositoryUrl: "https://github.com/acme/harbor-assistant.git",
        branch: "main",
      },
    })

    await repository.save(project)

    const loaded = await repository.findById("project-1")

    expect(loaded).not.toBeNull()
    expect(loaded?.source).toEqual({
      type: "git",
      repositoryUrl: "https://github.com/acme/harbor-assistant.git",
      branch: "main",
    })
    expect(loaded?.rootPath).toBeNull()
    expect(loaded?.normalizedPath).toBeNull()
  })

  it("lists projects from the real database", async () => {
    testDatabase = await createTestDatabase()
    const repository = new PrismaProjectRepository(testDatabase.prisma)

    await repository.save(
      createProject({
        id: "project-1",
        name: "First Project",
        normalizedPath: "/tmp/first-project",
        now: new Date("2026-03-24T00:00:00.000Z"),
      }),
    )
    await repository.save(
      createProject({
        id: "project-2",
        name: "Second Project",
        normalizedPath: "/tmp/second-project",
        now: new Date("2026-03-25T00:00:00.000Z"),
      }),
    )

    const projects = await repository.list()

    expect(projects.map((project) => project.id)).toEqual([
      "project-2",
      "project-1",
    ])
  })

  it("finds a project by slug from the real database", async () => {
    testDatabase = await createTestDatabase()
    const repository = new PrismaProjectRepository(testDatabase.prisma)

    await repository.save(
      createProject({
        id: "project-1",
        name: "Harbor Assistant",
        normalizedPath: "/tmp/harbor-assistant",
      }),
    )

    const project = await repository.findBySlug("harbor-assistant")

    expect(project).not.toBeNull()
    expect(project?.id).toBe("project-1")
    expect(project?.slug).toBe("harbor-assistant")
  })

  it("enforces unique normalized path in the database", async () => {
    testDatabase = await createTestDatabase()
    const repository = new PrismaProjectRepository(testDatabase.prisma)

    await repository.save(
      createProject({
        id: "project-1",
        name: "First Project",
        normalizedPath: "/tmp/first-project",
      }),
    )

    await expect(
      repository.save(
        createProject({
          id: "project-2",
          name: "Second Project",
          normalizedPath: "/tmp/first-project",
        }),
      ),
    ).rejects.toMatchObject({
      code: PROJECT_ERROR_CODES.DUPLICATE_PATH,
    } satisfies Partial<ProjectError>)
  })

  it("maps duplicate slug to a structured repository error", async () => {
    testDatabase = await createTestDatabase()
    const repository = new PrismaProjectRepository(testDatabase.prisma)

    await repository.save(
      createProject({
        id: "project-1",
        name: "First Project",
        normalizedPath: "/tmp/first-project",
      }),
    )

    await expect(
      repository.save(
        createProject({
          id: "project-2",
          name: "First Project",
          normalizedPath: "/tmp/second-project",
        }),
      ),
    ).rejects.toMatchObject({
      code: PROJECT_ERROR_CODES.DUPLICATE_SLUG,
    } satisfies Partial<ProjectError>)
  })

  it("deletes a project from the real database", async () => {
    testDatabase = await createTestDatabase()
    const repository = new PrismaProjectRepository(testDatabase.prisma)

    await repository.save(
      createProject({
        id: "project-1",
        name: "Harbor Assistant",
        normalizedPath: "/tmp/harbor-assistant",
      }),
    )

    await repository.delete("project-1")

    await expect(repository.findById("project-1")).resolves.toBeNull()
  })
})
