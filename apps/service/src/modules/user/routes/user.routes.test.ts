import Fastify from "fastify"
import { describe, expect, it } from "vitest"

import errorHandlerPlugin from "../../../plugins/error-handler"
import { InMemoryUserDirectory } from "../infrastructure/in-memory-user-directory"
import { registerUserModuleRoutes } from "."

async function createApp() {
  const userDirectory = new InMemoryUserDirectory([
    {
      id: "user-1",
      githubLogin: "user-1",
      name: "User One",
      email: "user-1@example.com",
      avatarUrl: null,
      status: "active",
      lastLoginAt: null,
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    },
  ])
  const app = Fastify({ logger: false })
  app.decorateRequest("auth", null)
  app.addHook("onRequest", async (request) => {
    request.auth = {
      sessionId: "session-1",
      userId: "user-1",
      user: {
        id: "user-1",
        githubLogin: "user-1",
        name: "User One",
        email: "user-1@example.com",
        avatarUrl: null,
        status: "active",
        lastLoginAt: null,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      },
    }
  })
  await app.register(errorHandlerPlugin)
  await app.register(
    async (instance) => {
      await registerUserModuleRoutes(instance, {
        userDirectory,
      })
    },
    { prefix: "/v1" },
  )
  await app.ready()
  return app
}

describe("user routes", () => {
  it("returns the authenticated user from /me", async () => {
    const app = await createApp()

    const response = await app.inject({
      method: "GET",
      url: "/v1/me",
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      ok: true,
      user: {
        id: "user-1",
        githubLogin: "user-1",
      },
    })

    await app.close()
  })

  it("returns a user by id from /users/:userId", async () => {
    const app = await createApp()

    const response = await app.inject({
      method: "GET",
      url: "/v1/users/user-1",
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      ok: true,
      user: {
        id: "user-1",
        githubLogin: "user-1",
      },
    })

    await app.close()
  })
})
