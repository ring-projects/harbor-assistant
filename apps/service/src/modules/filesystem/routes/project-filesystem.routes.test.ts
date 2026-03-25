import Fastify from "fastify"
import { describe, expect, it } from "vitest"

import { registerFileSystemModuleRoutes } from "."
import errorHandlerPlugin from "../../../plugins/error-handler"
import { createProject } from "../../project/domain/project"
import { InMemoryProjectRepository } from "../../project/infrastructure/in-memory-project-repository"
import type { FileSystemRepository } from "../application/filesystem-repository"

async function createApp(args?: {
  projectRepository?: InMemoryProjectRepository
  fileSystemRepository?: FileSystemRepository
}) {
  const projectRepository = args?.projectRepository ?? new InMemoryProjectRepository()
  const fileSystemRepository =
    args?.fileSystemRepository ?? createFileSystemRepositoryStub()
  const app = Fastify({ logger: false })
  await app.register(errorHandlerPlugin)
  await app.register(
    async (instance) => {
      await registerFileSystemModuleRoutes(instance, {
        projectRepository,
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
        code: "PROJECT_NOT_FOUND",
      },
    })
  })
})
