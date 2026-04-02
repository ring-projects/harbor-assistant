import Fastify from "fastify"
import { describe, expect, it } from "vitest"

import { registerGitModuleRoutes } from "."
import errorHandlerPlugin from "../../../plugins/error-handler"
import { createProject } from "../../project/domain/project"
import { InMemoryProjectRepository } from "../../project/infrastructure/in-memory-project-repository"
import type { GitRepository } from "../application/git-repository"

async function createApp(args?: {
  projectRepository?: InMemoryProjectRepository
  gitRepository?: GitRepository
}) {
  const projectRepository = args?.projectRepository ?? new InMemoryProjectRepository()
  const gitRepository = args?.gitRepository ?? createGitRepositoryStub()
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
      await registerGitModuleRoutes(instance, {
        projectRepository,
        gitRepository,
      })
    },
    { prefix: "/v1" },
  )
  await app.ready()
  return app
}

function createGitRepositoryStub(
  overrides: Partial<GitRepository> = {},
): GitRepository {
  return {
    getRepositoryRoot: async () => ({
      stdout: "/workspace/project\n",
      stderr: "",
      exitCode: 0,
    }),
    getCurrentBranch: async () => ({
      stdout: "main\n",
      stderr: "",
      exitCode: 0,
    }),
    getStatus: async () => ({
      stdout: "## main\n",
      stderr: "",
      exitCode: 0,
    }),
    listBranches: async () => ({
      stdout: "main\nfeature/refactor\n",
      stderr: "",
      exitCode: 0,
    }),
    getDiff: async () => ({
      stdout: "",
      stderr: "",
      exitCode: 0,
    }),
    checkoutBranch: async () => ({
      stdout: "",
      stderr: "",
      exitCode: 0,
    }),
    createBranch: async () => ({
      stdout: "",
      stderr: "",
      exitCode: 0,
    }),
    ...overrides,
  }
}

describe("project git routes", () => {
  it("resolves project root and returns git repository summary", async () => {
    const projectRepository = new InMemoryProjectRepository()
    await projectRepository.save(
      createProject({
        id: "project-1",
        name: "Harbor",
        normalizedPath: "/workspace/project",
      }),
    )

    const app = await createApp({
      projectRepository,
      gitRepository: createGitRepositoryStub(),
    })

    const response = await app.inject({
      method: "GET",
      url: "/v1/projects/project-1/git",
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      ok: true,
      repository: {
        path: "/workspace/project",
        repositoryRoot: "/workspace/project",
        currentBranch: "main",
        detached: false,
        dirty: false,
      },
    })
  })

  it("returns structured project-not-found when route cannot resolve project", async () => {
    const app = await createApp({
      projectRepository: new InMemoryProjectRepository(),
      gitRepository: createGitRepositoryStub(),
    })

    const response = await app.inject({
      method: "GET",
      url: "/v1/projects/missing/git",
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "PROJECT_NOT_FOUND",
      },
    })
  })

  it("keeps git errors in the git boundary after project resolution", async () => {
    const projectRepository = new InMemoryProjectRepository()
    await projectRepository.save(
      createProject({
        id: "project-1",
        name: "Harbor",
        normalizedPath: "/workspace/project",
      }),
    )

    const app = await createApp({
      projectRepository,
      gitRepository: createGitRepositoryStub({
        getRepositoryRoot: async () => ({
          stdout: "",
          stderr: "fatal: not a git repository (or any of the parent directories): .git",
          exitCode: 128,
        }),
      }),
    })

    const response = await app.inject({
      method: "GET",
      url: "/v1/projects/project-1/git",
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "GIT_REPOSITORY_NOT_FOUND",
      },
    })
  })

  it("returns invalid project state for git projects without a local workspace", async () => {
    const projectRepository = new InMemoryProjectRepository()
    await projectRepository.save(
      createProject({
        id: "project-1",
        name: "Harbor",
        source: {
          type: "git",
          repositoryUrl: "https://github.com/acme/harbor.git",
        },
      }),
    )

    const app = await createApp({
      projectRepository,
      gitRepository: createGitRepositoryStub(),
    })

    const response = await app.inject({
      method: "GET",
      url: "/v1/projects/project-1/git",
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_PROJECT_STATE",
      },
    })
  })
})
