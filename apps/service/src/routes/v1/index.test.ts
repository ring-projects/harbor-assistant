import Fastify from "fastify"
import { describe, expect, it } from "vitest"

import type { ServiceConfig } from "../../config"
import errorHandlerPlugin from "../../plugins/error-handler"
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
  }
}

describe("registerV1Routes", () => {
  it("shares the new project and task wiring through the v1 composition root", async () => {
    const app = Fastify({ logger: false })
    await app.register(errorHandlerPlugin)
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
      payload: {
        id: "project-1",
        name: "Harbor Assistant",
        rootPath: "/tmp/harbor-assistant",
      },
    })

    expect(createdProject.statusCode).toBe(201)

    const createdTask = await app.inject({
      method: "POST",
      url: "/v1/tasks",
      payload: {
        projectId: "project-1",
        prompt: "Investigate runtime drift",
      },
    })

    expect(createdTask.statusCode).toBe(201)
    expect(createdTask.json()).toMatchObject({
      ok: true,
      task: {
        projectId: "project-1",
        title: "Investigate runtime drift",
        status: "queued",
      },
    })

    const projectTasks = await app.inject({
      method: "GET",
      url: "/v1/projects/project-1/tasks",
    })

    expect(projectTasks.statusCode).toBe(200)
    expect(projectTasks.json()).toEqual({
      ok: true,
      tasks: [
        expect.objectContaining({
          projectId: "project-1",
          title: "Investigate runtime drift",
        }),
      ],
    })

    await app.close()
  })
})
