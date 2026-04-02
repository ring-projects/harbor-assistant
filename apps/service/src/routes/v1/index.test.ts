import Fastify from "fastify"
import { afterEach, describe, expect, it } from "vitest"

import type { ServiceConfig } from "../../config"
import errorHandlerPlugin from "../../plugins/error-handler"
import prismaPlugin from "../../plugins/prisma"
import { createAuthSessionCookie } from "../../../test/helpers/auth-session"
import { createTestDatabase, type TestDatabase } from "../../../test/helpers/test-database"
import { registerV1Routes } from "."

function createConfig(): ServiceConfig {
  return {
    port: 3400,
    host: "127.0.0.1",
    serviceName: "harbor",
    database: "https://example.com/db",
    fileBrowserRootDirectory: "/tmp",
    nodeEnv: "test",
    isProduction: false,
    harborConfigPath: "/tmp/harbor/config.json",
    harborHomeDirectory: "/tmp/harbor",
    taskDatabaseFile: "/tmp/harbor/task.db",
    allowedGitHubUsers: [],
    allowedGitHubOrgs: [],
  }
}

describe("registerV1Routes", () => {
  let testDatabase: TestDatabase | null = null

  afterEach(async () => {
    await testDatabase?.cleanup()
    testDatabase = null
  })

  it("shares the new project and task wiring through the v1 composition root", async () => {
    testDatabase = await createTestDatabase()
    const session = await createAuthSessionCookie(testDatabase.prisma)
    const app = Fastify({ logger: false })
    await app.register(errorHandlerPlugin)
    await app.register(prismaPlugin, {
      datasourceUrl: testDatabase.databaseUrl,
      log: [],
    })
    await app.register(
      async (instance) => {
        await registerV1Routes(instance, createConfig())
      },
      { prefix: "/v1" },
    )
    await app.ready()

    const createdProject = await app.inject({
      method: "POST",
      url: "/v1/projects",
      headers: {
        cookie: session.cookie,
      },
      payload: {
        id: "project-1",
        name: "Harbor Assistant",
        source: {
          type: "rootPath",
          rootPath: "/tmp/harbor-assistant",
        },
      },
    })

    expect(createdProject.statusCode).toBe(201)

    const createdOrchestration = await app.inject({
      method: "POST",
      url: "/v1/orchestrations",
      headers: {
        cookie: session.cookie,
      },
      payload: {
        projectId: "project-1",
        title: "Runtime cleanup",
      },
    })

    expect(createdOrchestration.statusCode).toBe(201)
    const orchestrationId = createdOrchestration.json().orchestration.id

    const bootstrapped = await app.inject({
      method: "POST",
      url: "/v1/orchestrations/bootstrap",
      headers: {
        cookie: session.cookie,
      },
      payload: {
        projectId: "project-1",
        orchestration: {
          title: "Bootstrap runtime cleanup",
          description: "Create first task in one request",
        },
        initialTask: {
          prompt: "Investigate runtime drift",
          executor: "codex",
          model: "gpt-5.3-codex",
          executionMode: "safe",
          effort: "medium",
        },
      },
    })

    expect(bootstrapped.statusCode).toBe(201)
    expect(bootstrapped.json()).toMatchObject({
      ok: true,
      orchestration: {
        projectId: "project-1",
        title: "Bootstrap runtime cleanup",
      },
      task: {
        projectId: "project-1",
        prompt: "Investigate runtime drift",
      },
      bootstrap: {
        runtimeStarted: true,
        warning: null,
      },
    })

    const createdTask = await app.inject({
      method: "POST",
      url: `/v1/orchestrations/${orchestrationId}/tasks`,
      headers: {
        cookie: session.cookie,
      },
      payload: {
        prompt: "Investigate runtime drift",
        executor: "codex",
        model: "gpt-5.3-codex",
        executionMode: "safe",
        effort: "medium",
      },
    })

    expect(createdTask.statusCode).toBe(201)
    expect(createdTask.json()).toMatchObject({
      ok: true,
      task: {
        projectId: "project-1",
        orchestrationId,
        title: "Investigate runtime drift",
        executor: "codex",
        model: "gpt-5.3-codex",
        executionMode: "safe",
        effort: "medium",
        status: "queued",
      },
    })

    const orchestrationTasks = await app.inject({
      method: "GET",
      url: `/v1/orchestrations/${orchestrationId}/tasks`,
      headers: {
        cookie: session.cookie,
      },
    })

    expect(orchestrationTasks.statusCode).toBe(200)
    expect(orchestrationTasks.json()).toEqual({
      ok: true,
      tasks: [
        expect.objectContaining({
          projectId: "project-1",
          orchestrationId,
          title: "Investigate runtime drift",
        }),
      ],
    })

    const projectOrchestrations = await app.inject({
      method: "GET",
      url: "/v1/projects/project-1/orchestrations",
      headers: {
        cookie: session.cookie,
      },
    })

    expect(projectOrchestrations.statusCode).toBe(200)
    expect(projectOrchestrations.json()).toMatchObject({
      ok: true,
      orchestrations: expect.arrayContaining([
        expect.objectContaining({
          id: orchestrationId,
          projectId: "project-1",
        }),
        expect.objectContaining({
          title: "Bootstrap runtime cleanup",
          projectId: "project-1",
        }),
      ]),
    })

    await app.close()
  })

  it("fails fast when prisma is not registered", async () => {
    const app = Fastify({ logger: false })
    await app.register(errorHandlerPlugin)

    await expect(
      app.register(
        async (instance) => {
          await registerV1Routes(instance, createConfig())
        },
        { prefix: "/v1" },
      ),
    ).rejects.toThrow("registerV1Routes requires app.prisma to be registered")
  })
})
