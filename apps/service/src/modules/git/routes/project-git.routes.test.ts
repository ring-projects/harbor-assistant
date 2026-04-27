import Fastify from "fastify"
import { describe, expect, it } from "vitest"

import { registerGitModuleRoutes } from "."
import {
  createDefaultAuthorizationService,
  createRepositoryAuthorizationOrchestrationQuery,
  createRepositoryAuthorizationProjectQuery,
  createRepositoryAuthorizationTaskQuery,
  createRepositoryAuthorizationWorkspaceQuery,
} from "../../authorization"
import errorHandlerPlugin from "../../../plugins/error-handler"
import { InMemoryOrchestrationRepository } from "../../orchestration/infrastructure/in-memory-orchestration-repository"
import { createProject } from "../../project/domain/project"
import { InMemoryProjectRepository } from "../../project/infrastructure/in-memory-project-repository"
import { InMemoryTaskRepository } from "../../task/infrastructure/in-memory-task-repository"
import { createWorkspace } from "../../workspace/domain/workspace"
import { InMemoryWorkspaceRepository } from "../../workspace/infrastructure/in-memory-workspace-repository"
import type { GitRepository } from "../application/git-repository"

async function createApp(args?: {
  projectRepository?: InMemoryProjectRepository
  workspaceRepository?: InMemoryWorkspaceRepository
  gitRepository?: GitRepository
}) {
  const projectRepository =
    args?.projectRepository ?? new InMemoryProjectRepository()
  const workspaceRepository =
    args?.workspaceRepository ?? new InMemoryWorkspaceRepository()
  const gitRepository = args?.gitRepository ?? createGitRepositoryStub()
  const app = Fastify({ logger: false })
  const authorization = createDefaultAuthorizationService({
    workspaceQuery:
      createRepositoryAuthorizationWorkspaceQuery(workspaceRepository),
    projectQuery: createRepositoryAuthorizationProjectQuery(projectRepository),
    taskQuery: createRepositoryAuthorizationTaskQuery(
      new InMemoryTaskRepository(),
    ),
    orchestrationQuery: createRepositoryAuthorizationOrchestrationQuery(
      new InMemoryOrchestrationRepository(),
    ),
  })
  app.decorateRequest("auth", null)
  app.addHook("onRequest", async (request) => {
    const userId = String(request.headers["x-user-id"] ?? "user-1")
    const githubLogin = String(request.headers["x-user-login"] ?? userId)
    request.auth = {
      sessionId: "session-1",
      userId,
      user: {
        id: userId,
        githubLogin,
        name: "User One",
        email: `${githubLogin}@example.com`,
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
        authorization,
        projectRepository,
        workspaceRepository,
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
        code: "NOT_FOUND",
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
          stderr:
            "fatal: not a git repository (or any of the parent directories): .git",
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

  it("returns invalid project state for git projects without a local path", async () => {
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

  it("rejects git write operations by non-owner workspace members", async () => {
    const projectRepository = new InMemoryProjectRepository()
    const workspaceRepository = new InMemoryWorkspaceRepository()
    const workspace = createWorkspace({
      id: "ws-team",
      name: "Harbor Team",
      type: "team",
      createdByUserId: "user-1",
    })
    await workspaceRepository.save({
      ...workspace,
      memberships: [
        ...workspace.memberships,
        {
          workspaceId: "ws-team",
          userId: "user-2",
          role: "member",
          status: "active",
          createdAt: new Date("2026-04-06T00:00:00.000Z"),
          updatedAt: new Date("2026-04-06T00:00:00.000Z"),
        },
      ],
    })
    await projectRepository.save({
      ...createProject({
        id: "project-1",
        name: "Harbor",
        ownerUserId: "user-1",
        workspaceId: "ws-team",
        normalizedPath: "/workspace/project",
      }),
      workspaceId: "ws-team",
    })

    const app = await createApp({
      projectRepository,
      workspaceRepository,
      gitRepository: createGitRepositoryStub(),
    })

    const response = await app.inject({
      method: "POST",
      url: "/v1/projects/project-1/git/checkout",
      headers: {
        "x-user-id": "user-2",
        "x-user-login": "user-2",
      },
      payload: {
        branchName: "feature/refactor",
      },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "PERMISSION_DENIED",
      },
    })
  })
})
