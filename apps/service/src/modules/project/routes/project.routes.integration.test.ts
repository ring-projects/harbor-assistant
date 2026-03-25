import { afterEach, describe, expect, it } from "vitest"

import { createProjectTestApp } from "../../../../test/helpers/project-test-app"
import { createTestDatabase, type TestDatabase } from "../../../../test/helpers/test-database"

describe("project routes integration", () => {
  let testDatabase: TestDatabase | null = null

  afterEach(async () => {
    await testDatabase?.cleanup()
    testDatabase = null
  })

  it("uses the real Prisma repository when app.prisma is available", async () => {
    testDatabase = await createTestDatabase()
    const app = await createProjectTestApp(testDatabase.prisma)

    const created = await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        id: "project-1",
        name: "Harbor Assistant",
        rootPath: "/tmp/harbor-assistant",
      },
    })

    expect(created.statusCode).toBe(201)

    const listed = await app.inject({
      method: "GET",
      url: "/v1/projects",
    })

    expect(listed.statusCode).toBe(200)
    expect(listed.json()).toMatchObject({
      ok: true,
      projects: [
        {
          id: "project-1",
          name: "Harbor Assistant",
          normalizedPath: "/tmp/harbor-assistant",
        },
      ],
    })

    await app.close()
  })

  it("stores canonicalized create path through the real route stack", async () => {
    testDatabase = await createTestDatabase()
    const app = await createProjectTestApp(testDatabase.prisma)

    const created = await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        id: "project-1",
        name: "Harbor Assistant",
        rootPath: "~/workspace/harbor-assistant",
      },
    })

    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({
      ok: true,
      project: {
        normalizedPath: "/resolved/workspace/harbor-assistant",
        rootPath: "/resolved/workspace/harbor-assistant",
      },
    })

    await app.close()
  })

  it("deletes a project through the real Prisma repository", async () => {
    testDatabase = await createTestDatabase()
    const app = await createProjectTestApp(testDatabase.prisma)

    await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        id: "project-1",
        name: "Harbor Assistant",
        rootPath: "/tmp/harbor-assistant",
      },
    })

    const deleted = await app.inject({
      method: "DELETE",
      url: "/v1/projects/project-1",
    })

    expect(deleted.statusCode).toBe(200)
    expect(deleted.json()).toEqual({
      ok: true,
      projectId: "project-1",
    })

    const listed = await app.inject({
      method: "GET",
      url: "/v1/projects",
    })

    expect(listed.statusCode).toBe(200)
    expect(listed.json()).toEqual({
      ok: true,
      projects: [],
    })

    await app.close()
  })
})
