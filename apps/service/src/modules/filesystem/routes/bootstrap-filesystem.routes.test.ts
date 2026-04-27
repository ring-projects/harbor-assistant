import Fastify from "fastify"
import { describe, expect, it } from "vitest"

import {
  createDefaultAuthorizationService,
  createRepositoryAuthorizationOrchestrationQuery,
  createRepositoryAuthorizationProjectQuery,
  createRepositoryAuthorizationTaskQuery,
  createRepositoryAuthorizationWorkspaceQuery,
} from "../../authorization"
import { InMemoryOrchestrationRepository } from "../../orchestration/infrastructure/in-memory-orchestration-repository"
import { InMemoryTaskRepository } from "../../task/infrastructure/in-memory-task-repository"
import { InMemoryWorkspaceRepository } from "../../workspace/infrastructure/in-memory-workspace-repository"
import errorHandlerPlugin from "../../../plugins/error-handler"
import type { FileSystemRepository } from "../application/filesystem-repository"
import { FILESYSTEM_ERROR_CODES } from "../errors"
import { registerFileSystemModuleRoutes } from "."

async function createApp(args?: {
  fileSystemRepository?: FileSystemRepository
  bootstrapRoots?: Array<{
    id: string
    label: string
    path: string
    isDefault?: boolean
  }>
}) {
  const fileSystemRepository =
    args?.fileSystemRepository ?? createFileSystemRepositoryStub()
  const app = Fastify({ logger: false })
  const projectRepository = {
    findById: async () => null,
  }
  const authorization = createDefaultAuthorizationService({
    workspaceQuery: createRepositoryAuthorizationWorkspaceQuery(
      new InMemoryWorkspaceRepository(),
    ),
    projectQuery: createRepositoryAuthorizationProjectQuery(projectRepository),
    taskQuery: createRepositoryAuthorizationTaskQuery(
      new InMemoryTaskRepository(),
    ),
    orchestrationQuery: createRepositoryAuthorizationOrchestrationQuery(
      new InMemoryOrchestrationRepository(),
    ),
  })
  await app.register(errorHandlerPlugin)
  await app.register(
    async (instance) => {
      await registerFileSystemModuleRoutes(instance, {
        authorization,
        projectRepository,
        fileSystemRepository,
        bootstrapRoots: args?.bootstrapRoots ?? [
          {
            id: "default",
            label: "Local Files",
            path: "/workspace",
            isDefault: true,
          },
        ],
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
      kind: targetPath.endsWith(".md") ? "file" : "directory",
      size: targetPath.endsWith(".md") ? 24 : null,
      mtime: new Date("2026-03-26T00:00:00.000Z"),
    }),
    lstatPath: async (targetPath) => ({
      kind: targetPath.endsWith(".md") ? "file" : "directory",
      size: targetPath.endsWith(".md") ? 24 : null,
      mtime: new Date("2026-03-26T00:00:00.000Z"),
    }),
    readDirectory: async () => [
      { name: "apps", kind: "directory" },
      { name: "README.md", kind: "file" },
    ],
    readTextFile: async () => "hello\n",
    createDirectory: async () => undefined,
    writeTextFile: async () => undefined,
    ...overrides,
  }
}

describe("bootstrap filesystem routes", () => {
  it("lists configured bootstrap roots", async () => {
    const app = await createApp()

    const response = await app.inject({
      method: "GET",
      url: "/v1/bootstrap/filesystem/roots",
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      ok: true,
      roots: [
        {
          id: "default",
          label: "Local Files",
          path: "/workspace",
          isDefault: true,
        },
      ],
    })
  })

  it("lists directories inside a bootstrap root", async () => {
    const app = await createApp()

    const response = await app.inject({
      method: "POST",
      url: "/v1/bootstrap/filesystem/list",
      payload: {
        rootId: "default",
        path: ".",
        directoriesOnly: true,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      ok: true,
      listing: {
        rootId: "default",
        rootPath: "/workspace",
        path: null,
        absolutePath: "/workspace",
        entries: [
          {
            name: "apps",
            path: "apps",
            absolutePath: "/workspace/apps",
            type: "directory",
          },
        ],
      },
    })
  })

  it("stats a path inside a bootstrap root", async () => {
    const app = await createApp()

    const response = await app.inject({
      method: "GET",
      url: "/v1/bootstrap/filesystem/stat?rootId=default&path=README.md",
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      ok: true,
      pathInfo: {
        rootId: "default",
        rootPath: "/workspace",
        path: "README.md",
        absolutePath: "/workspace/README.md",
        type: "file",
      },
    })
  })

  it("returns structured root-not-found for unknown roots", async () => {
    const app = await createApp()

    const response = await app.inject({
      method: "POST",
      url: "/v1/bootstrap/filesystem/list",
      payload: {
        rootId: "missing",
      },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: FILESYSTEM_ERROR_CODES.FILESYSTEM_ROOT_NOT_FOUND,
      },
    })
  })

  it("returns service unavailable when bootstrap roots are disabled", async () => {
    const app = await createApp({
      bootstrapRoots: [],
    })

    const response = await app.inject({
      method: "GET",
      url: "/v1/bootstrap/filesystem/roots",
    })

    expect(response.statusCode).toBe(503)
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: FILESYSTEM_ERROR_CODES.BOOTSTRAP_FILESYSTEM_DISABLED,
      },
    })
  })
})
