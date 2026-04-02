import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import type { ServiceConfig } from "./config"
import { buildServiceApp } from "./app"
import { ensureServiceDatabaseInitialized } from "./lib/database-init"

const tempRoots = new Set<string>()

async function createConfig(): Promise<ServiceConfig> {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), "harbor-service-app-"))
  tempRoots.add(rootPath)

  const databaseUrl = `file:${path.join(rootPath, "service.db")}`
  await ensureServiceDatabaseInitialized({
    databaseUrl,
  })

  return {
    port: 3400,
    host: "127.0.0.1",
    serviceName: "harbor",
    database: databaseUrl,
    fileBrowserRootDirectory: rootPath,
    nodeEnv: "test",
    isProduction: false,
    harborConfigPath: path.join(rootPath, "harbor-config.json"),
    harborHomeDirectory: path.join(rootPath, ".harbor"),
    taskDatabaseFile: path.join(rootPath, "task.db"),
    allowedGitHubUsers: [],
    allowedGitHubOrgs: [],
  }
}

describe("buildServiceApp", () => {
  afterEach(async () => {
    for (const rootPath of tempRoots) {
      await rm(rootPath, { recursive: true, force: true })
      tempRoots.delete(rootPath)
    }
  })

  it("allows delete in cors preflight responses", async () => {
    const app = await buildServiceApp(await createConfig())

    const response = await app.inject({
      method: "OPTIONS",
      url: "/v1/tasks/task-1",
      headers: {
        origin: "http://localhost:3000",
        "access-control-request-method": "DELETE",
      },
    })

    expect(response.statusCode).toBe(204)
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    )
    expect(response.headers["access-control-allow-methods"]).toContain("DELETE")

    await app.close()
  })
})
