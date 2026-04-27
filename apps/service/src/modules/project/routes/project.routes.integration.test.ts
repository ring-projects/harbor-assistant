import { afterEach, describe, expect, it } from "vitest"

import { createAuthSessionCookie } from "../../../../test/helpers/auth-session"
import { createProjectTestApp } from "../../../../test/helpers/project-test-app"
import {
  createTestDatabase,
  type TestDatabase,
} from "../../../../test/helpers/test-database"

function rootPathSource(rootPath: string) {
  return {
    type: "rootPath" as const,
    rootPath,
  }
}

describe("project routes integration", () => {
  let testDatabase: TestDatabase | null = null

  afterEach(async () => {
    await testDatabase?.cleanup()
    testDatabase = null
  })

  it("requires authentication for project routes", async () => {
    testDatabase = await createTestDatabase()
    const app = await createProjectTestApp(testDatabase.prisma)

    const response = await app.inject({
      method: "GET",
      url: "/v1/projects",
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "AUTH_REQUIRED",
      },
    })

    await app.close()
  })

  it("uses the real Prisma repository when app.prisma is available", async () => {
    testDatabase = await createTestDatabase()
    const app = await createProjectTestApp(testDatabase.prisma)
    const session = await createAuthSessionCookie(testDatabase.prisma)

    const created = await app.inject({
      method: "POST",
      url: "/v1/projects",
      headers: {
        cookie: session.cookie,
      },
      payload: {
        id: "project-1",
        name: "Harbor Assistant",
        source: rootPathSource("/tmp/harbor-assistant"),
      },
    })

    expect(created.statusCode).toBe(201)

    const listed = await app.inject({
      method: "GET",
      url: "/v1/projects",
      headers: {
        cookie: session.cookie,
      },
    })

    expect(listed.statusCode).toBe(200)
    expect(listed.json()).toMatchObject({
      ok: true,
      projects: [
        {
          id: "project-1",
          name: "Harbor Assistant",
          normalizedPath: "/tmp/harbor-assistant",
          source: {
            type: "rootPath",
          },
        },
      ],
    })

    await app.close()
  })

  it("stores canonicalized create path through the real route stack", async () => {
    testDatabase = await createTestDatabase()
    const app = await createProjectTestApp(testDatabase.prisma)
    const session = await createAuthSessionCookie(testDatabase.prisma)

    const created = await app.inject({
      method: "POST",
      url: "/v1/projects",
      headers: {
        cookie: session.cookie,
      },
      payload: {
        id: "project-1",
        name: "Harbor Assistant",
        source: rootPathSource("~/workspace/harbor-assistant"),
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

  it("persists git source projects without a local path", async () => {
    testDatabase = await createTestDatabase()
    const app = await createProjectTestApp(testDatabase.prisma)
    const session = await createAuthSessionCookie(testDatabase.prisma)

    const created = await app.inject({
      method: "POST",
      url: "/v1/projects",
      headers: {
        cookie: session.cookie,
      },
      payload: {
        id: "project-1",
        name: "Harbor Assistant",
        source: {
          type: "git",
          repositoryUrl: "https://github.com/acme/harbor-assistant.git",
          branch: "main",
        },
      },
    })

    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({
      ok: true,
      project: {
        id: "project-1",
        rootPath: null,
        normalizedPath: null,
        source: {
          type: "git",
          repositoryUrl: "https://github.com/acme/harbor-assistant.git",
          branch: "main",
        },
      },
    })

    await app.close()
  })

  it("deletes a project through the real Prisma repository", async () => {
    testDatabase = await createTestDatabase()
    const app = await createProjectTestApp(testDatabase.prisma)
    const session = await createAuthSessionCookie(testDatabase.prisma)

    await app.inject({
      method: "POST",
      url: "/v1/projects",
      headers: {
        cookie: session.cookie,
      },
      payload: {
        id: "project-1",
        name: "Harbor Assistant",
        source: rootPathSource("/tmp/harbor-assistant"),
      },
    })

    const deleted = await app.inject({
      method: "DELETE",
      url: "/v1/projects/project-1",
      headers: {
        cookie: session.cookie,
      },
    })

    expect(deleted.statusCode).toBe(200)
    expect(deleted.json()).toEqual({
      ok: true,
      projectId: "project-1",
    })

    const listed = await app.inject({
      method: "GET",
      url: "/v1/projects",
      headers: {
        cookie: session.cookie,
      },
    })

    expect(listed.statusCode).toBe(200)
    expect(listed.json()).toEqual({
      ok: true,
      projects: [],
    })

    await app.close()
  })

  it("returns only projects owned by the current user", async () => {
    testDatabase = await createTestDatabase()
    const app = await createProjectTestApp(testDatabase.prisma)
    const sessionOne = await createAuthSessionCookie(testDatabase.prisma, {
      githubLogin: "owner-one",
    })
    const sessionTwo = await createAuthSessionCookie(testDatabase.prisma, {
      githubLogin: "owner-two",
    })

    await app.inject({
      method: "POST",
      url: "/v1/projects",
      headers: {
        cookie: sessionOne.cookie,
      },
      payload: {
        id: "project-1",
        name: "Owned By One",
        source: rootPathSource("/tmp/owner-one"),
      },
    })

    await app.inject({
      method: "POST",
      url: "/v1/projects",
      headers: {
        cookie: sessionTwo.cookie,
      },
      payload: {
        id: "project-2",
        name: "Owned By Two",
        source: rootPathSource("/tmp/owner-two"),
      },
    })

    const listed = await app.inject({
      method: "GET",
      url: "/v1/projects",
      headers: {
        cookie: sessionOne.cookie,
      },
    })

    expect(listed.statusCode).toBe(200)
    expect(listed.json()).toMatchObject({
      ok: true,
      projects: [
        {
          id: "project-1",
          name: "Owned By One",
        },
      ],
    })

    await app.close()
  })
})
