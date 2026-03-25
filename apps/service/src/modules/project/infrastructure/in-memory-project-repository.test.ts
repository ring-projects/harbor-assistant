import { describe, expect, it } from "vitest"

import { createProject, updateProjectProfile } from "../domain/project"
import { InMemoryProjectRepository } from "./in-memory-project-repository"

describe("InMemoryProjectRepository", () => {
  it("lists projects by updatedAt descending like the Prisma repository", async () => {
    const repository = new InMemoryProjectRepository()
    const older = createProject({
      id: "project-1",
      name: "Harbor Assistant",
      normalizedPath: "/workspace/harbor-assistant",
      now: new Date("2026-03-25T00:00:00.000Z"),
    })
    const newerBase = createProject({
      id: "project-2",
      name: "Harbor Service",
      normalizedPath: "/workspace/harbor-service",
      now: new Date("2026-03-25T00:01:00.000Z"),
    })

    await repository.save(older)
    await repository.save(
      updateProjectProfile(
        newerBase,
        { description: "Recently touched" },
        new Date("2026-03-25T00:02:00.000Z"),
      ),
    )

    await expect(repository.list()).resolves.toMatchObject([
      { id: "project-2" },
      { id: "project-1" },
    ])
  })
})
