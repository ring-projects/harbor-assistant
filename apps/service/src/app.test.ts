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
    projectLocalPathRootDirectory: path.join(rootPath, "workspaces"),
    publicSkillsRootDirectory: path.join(
      rootPath,
      "skills",
      "profiles",
      "default",
    ),
    nodeEnv: "test",
    isProduction: false,
    appBaseUrl: "http://127.0.0.1:3400",
    githubAppSlug: undefined,
    githubAppId: undefined,
    githubAppPrivateKey: undefined,
    githubAppWebhookSecret: undefined,
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

  it("exposes service build metadata", async () => {
    const app = await buildServiceApp(await createConfig())

    const response = await app.inject({
      method: "GET",
      url: "/version",
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      ok: true,
      service: "harbor",
      version: expect.any(String),
      gitSha: null,
      buildTime: null,
    })

    await app.close()
  })

  it("exposes the generated openapi document as json", async () => {
    const app = await buildServiceApp(await createConfig())

    const response = await app.inject({
      method: "GET",
      url: "/openapi.json",
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers["content-type"]).toContain("application/json")

    const body = response.json()

    expect(body).toMatchObject({
      openapi: "3.0.3",
      info: {
        title: "Harbor Service API",
      },
    })
    expect(body.paths).toHaveProperty("/v1/projects")
    expect(body.paths).toHaveProperty("/v1/workspaces")
    expect(body.paths).toHaveProperty("/v1/workspaces/{id}/members")
    expect(body.paths).toHaveProperty("/v1/workspaces/{id}/invitations")
    expect(body.paths).toHaveProperty("/v1/workspace-invitations/{invitationId}/accept")
    expect(body.paths).toHaveProperty("/v1/integrations/github/app/install-url")
    expect(body.paths).toHaveProperty("/v1/integrations/github/setup")
    expect(body.paths).toHaveProperty("/v1/integrations/github/installations")
    expect(body.paths).toHaveProperty(
      "/v1/integrations/github/installations/{installationId}/repositories",
    )
    expect(body.paths).toHaveProperty("/v1/auth/session")
    expect(body.paths).toHaveProperty("/v1/auth/logout")
    expect(body.paths).toHaveProperty("/v1/auth/github/start")
    expect(body.paths).toHaveProperty("/v1/auth/github/callback")
    expect(body.paths).toHaveProperty("/v1/agents/capabilities")
    expect(body.paths).toHaveProperty("/v1/bootstrap/filesystem/roots")
    expect(body.paths).toHaveProperty("/v1/bootstrap/filesystem/list")
    expect(body.paths).toHaveProperty("/v1/bootstrap/filesystem/stat")
    expect(body.paths).toHaveProperty("/v1/projects/{projectId}/files/list")
    expect(body.paths).toHaveProperty("/v1/projects/{projectId}/git")
    expect(body.paths).toHaveProperty("/v1/orchestrations")
    expect(body.paths).toHaveProperty("/v1/orchestrations/bootstrap")
    expect(body.paths).toHaveProperty("/v1/tasks/{taskId}")
    expect(body.paths).toHaveProperty("/healthz")
    expect(body.paths).toHaveProperty("/version")
    expect(body.paths).not.toHaveProperty("/v1/projects/{projectId}/task-input-images")
    expect(body.paths["/v1/projects/{projectId}/task-input-files"].post).toMatchObject({
      operationId: "uploadTaskInputFile",
      tags: ["tasks"],
    })
    expect(body.paths["/v1/projects/{id}"].get).toMatchObject({
      operationId: "getProject",
      tags: ["projects"],
      security: [{ cookieAuth: [] }],
    })

    await app.close()
  })

  it("exposes the generated openapi document as yaml", async () => {
    const app = await buildServiceApp(await createConfig())

    const response = await app.inject({
      method: "GET",
      url: "/openapi.yaml",
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers["content-type"]).toContain("application/yaml")
    expect(response.body).toContain("openapi: 3.0.3")

    await app.close()
  })

  it("serves the scalar api reference", async () => {
    const app = await buildServiceApp(await createConfig())

    const response = await app.inject({
      method: "GET",
      url: "/reference/",
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers["content-type"]).toContain("text/html")
    expect(response.body).toContain("Scalar")

    await app.close()
  })
})
