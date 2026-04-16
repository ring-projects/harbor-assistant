import Fastify from "fastify"
import { describe, expect, it } from "vitest"

import { registerFileSystemModuleRoutes } from "."
import {
  createDefaultAuthorizationService,
  createRepositoryAuthorizationOrchestrationQuery,
  createRepositoryAuthorizationProjectQuery,
  createRepositoryAuthorizationTaskQuery,
  createRepositoryAuthorizationWorkspaceQuery,
} from "../../authorization"
import { InMemoryOrchestrationRepository } from "../../orchestration/infrastructure/in-memory-orchestration-repository"
import errorHandlerPlugin from "../../../plugins/error-handler"
import { createProject } from "../../project/domain/project"
import { InMemoryProjectRepository } from "../../project/infrastructure/in-memory-project-repository"
import { InMemoryTaskRepository } from "../../task/infrastructure/in-memory-task-repository"
import { createWorkspace } from "../../workspace/domain/workspace"
import { InMemoryWorkspaceRepository } from "../../workspace/infrastructure/in-memory-workspace-repository"
import type { FileSystemRepository } from "../application/filesystem-repository"

async function createApp(args?: {
  projectRepository?: InMemoryProjectRepository
  workspaceRepository?: InMemoryWorkspaceRepository
  fileSystemRepository?: FileSystemRepository
}) {
  const projectRepository = args?.projectRepository ?? new InMemoryProjectRepository()
  const workspaceRepository =
    args?.workspaceRepository ?? new InMemoryWorkspaceRepository()
  const fileSystemRepository =
    args?.fileSystemRepository ?? createFileSystemRepositoryStub()
  const app = Fastify({ logger: false })
  const authorization = createDefaultAuthorizationService({
    workspaceQuery: createRepositoryAuthorizationWorkspaceQuery(
      workspaceRepository,
    ),
    projectQuery: createRepositoryAuthorizationProjectQuery(projectRepository),
    taskQuery: createRepositoryAuthorizationTaskQuery(new InMemoryTaskRepository()),
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
      await registerFileSystemModuleRoutes(instance, {
        authorization,
        projectRepository,
        workspaceRepository,
        fileSystemRepository,
      })
    },
    { prefix: "/v1" },
  )
  await app.ready()
  return app
}

function createFileSystemRepositoryStub(
  overrides: Partial<FileSystemRepository> = {},
): FileSystemRepository {
  return {
    resolveRealPath: async (targetPath) => targetPath,
    statPath: async (targetPath) => ({
      kind: targetPath.endsWith(".ts") || targetPath.endsWith(".md") ? "file" : "directory",
      size: targetPath.endsWith(".ts") || targetPath.endsWith(".md") ? 24 : null,
      mtime: new Date("2026-03-24T00:00:00.000Z"),
    }),
    lstatPath: async (targetPath) => ({
      kind: targetPath.endsWith(".ts") || targetPath.endsWith(".md") ? "file" : "directory",
      size: targetPath.endsWith(".ts") || targetPath.endsWith(".md") ? 24 : null,
      mtime: new Date("2026-03-24T00:00:00.000Z"),
    }),
    readDirectory: async () => [
      { name: "src", kind: "directory" },
      { name: "README.md", kind: "file" },
    ],
    readTextFile: async () => "hello\n",
    createDirectory: async () => undefined,
    writeTextFile: async () => undefined,
    ...overrides,
  }
}

describe("project filesystem routes", () => {
  it("resolves project root and lists project files", async () => {
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
      fileSystemRepository: createFileSystemRepositoryStub(),
    })

    const response = await app.inject({
      method: "POST",
      url: "/v1/projects/project-1/files/list",
      payload: {
        path: ".",
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      ok: true,
      listing: {
        path: "/workspace/project",
        entries: [
          { name: "src", type: "directory", size: null },
          { name: "README.md", type: "file", size: 24 },
        ],
      },
    })
  })

  it("writes a project file through the route adapter", async () => {
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
      fileSystemRepository: createFileSystemRepositoryStub({
        writeTextFile: async () => undefined,
        readTextFile: async () => "export const value = 1\n",
      }),
    })

    const response = await app.inject({
      method: "POST",
      url: "/v1/projects/project-1/files/text",
      payload: {
        path: "src/index.ts",
        content: "export const value = 1\n",
        createParents: true,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      ok: true,
      file: {
        path: "/workspace/project/src/index.ts",
        content: "export const value = 1\n",
      },
    })
  })

  it("returns structured project-not-found for missing project", async () => {
    const app = await createApp({
      projectRepository: new InMemoryProjectRepository(),
      fileSystemRepository: createFileSystemRepositoryStub(),
    })

    const response = await app.inject({
      method: "POST",
      url: "/v1/projects/missing/files/list",
      payload: {},
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "NOT_FOUND",
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
      fileSystemRepository: createFileSystemRepositoryStub(),
    })

    const response = await app.inject({
      method: "POST",
      url: "/v1/projects/project-1/files/list",
      payload: {},
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_PROJECT_STATE",
      },
    })
  })

  it("rejects file writes by non-owner workspace members", async () => {
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
      fileSystemRepository: createFileSystemRepositoryStub(),
    })

    const response = await app.inject({
      method: "POST",
      url: "/v1/projects/project-1/files/text",
      headers: {
        "x-user-id": "user-2",
        "x-user-login": "user-2",
      },
      payload: {
        path: "src/index.ts",
        content: "export const value = 1\n",
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
