import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import type { ServiceConfig } from "./config"
import { buildServiceApp } from "./app"
import { createAuthSessionCookie } from "../test/helpers/auth-session"
import {
  createTestDatabase,
  type TestDatabase,
} from "../test/helpers/test-database"

const tempRoots = new Set<string>()
const testDatabases = new Set<TestDatabase>()

async function createConfig(): Promise<ServiceConfig> {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), "harbor-service-app-"))
  tempRoots.add(rootPath)
  const testDatabase = await createTestDatabase()
  testDatabases.add(testDatabase)

  return {
    port: 3400,
    host: "127.0.0.1",
    serviceName: "harbor",
    database: testDatabase.databaseUrl,
    fileBrowserRootDirectory: rootPath,
    projectLocalPathRootDirectory: path.join(rootPath, "workspaces"),
    sandboxRootDirectory: path.join(rootPath, "sandboxes"),
    publicSkillsRootDirectory: path.join(rootPath, "skills"),
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
    for (const testDatabase of testDatabases) {
      await testDatabase.cleanup()
      testDatabases.delete(testDatabase)
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
    expect(body.paths).toHaveProperty(
      "/v1/workspace-invitations/{invitationId}/accept",
    )
    expect(body.paths).toHaveProperty("/v1/integrations/github/app/install-url")
    expect(body.paths).toHaveProperty("/v1/integrations/github/setup")
    expect(body.paths).toHaveProperty("/v1/integrations/github/installations")
    expect(body.paths).toHaveProperty(
      "/v1/integrations/github/installations/{installationId}/repositories",
    )
    expect(body.paths).toHaveProperty("/v1/auth/session")
    expect(body.paths).toHaveProperty("/v1/auth/logout")
    expect(body.paths).toHaveProperty("/v1/auth/agent-tokens/delegate")
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
    expect(body.paths).not.toHaveProperty(
      "/v1/projects/{projectId}/task-input-images",
    )
    expect(
      body.paths["/v1/projects/{projectId}/task-input-files"].post,
    ).toMatchObject({
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

  it("allows delegated bearer tokens to update an orchestration", async () => {
    const app = await buildServiceApp(await createConfig())
    const { prisma } = app
    const { user, cookie } = await createAuthSessionCookie(prisma)

    await prisma.project.create({
      data: {
        id: "project-1",
        ownerUserId: user.id,
        name: "Project 1",
        rootPath: "/tmp/project-1",
        normalizedPath: "/tmp/project-1",
      },
    })
    await prisma.orchestration.create({
      data: {
        id: "orch-1",
        projectId: "project-1",
        title: "Initial Title",
      },
    })

    const delegated = await app.inject({
      method: "POST",
      url: "/v1/auth/agent-tokens/delegate",
      headers: {
        cookie,
      },
      payload: {
        orchestrationId: "orch-1",
        scopes: ["orchestration.update"],
      },
    })

    expect(delegated.statusCode).toBe(201)
    const agentToken = delegated.json().agentToken.token as string

    const updated = await app.inject({
      method: "PATCH",
      url: "/v1/orchestrations/orch-1",
      headers: {
        authorization: `Bearer ${agentToken}`,
      },
      payload: {
        title: "Updated By Agent",
      },
    })

    expect(updated.statusCode).toBe(200)
    expect(updated.json()).toMatchObject({
      ok: true,
      orchestration: {
        id: "orch-1",
        title: "Updated By Agent",
      },
    })

    await app.close()
  })
})
