import { describe, expect, it } from "vitest"

import { listDirectoryUseCase } from "./list-directory"
import { FILESYSTEM_ERROR_CODES, FileSystemError } from "../errors"
import type { FileSystemRepository } from "./filesystem-repository"

function createRepositoryStub(
  overrides: Partial<FileSystemRepository> = {},
): FileSystemRepository {
  return {
    resolveRealPath: async (targetPath) => targetPath,
    statPath: async (targetPath) => ({
      kind:
        targetPath.endsWith(".ts") || targetPath.endsWith(".md")
          ? "file"
          : "directory",
      size:
        targetPath.endsWith(".ts") || targetPath.endsWith(".md") ? 12 : null,
      mtime: new Date("2026-03-24T00:00:00.000Z"),
    }),
    lstatPath: async (targetPath) => ({
      kind:
        targetPath.endsWith(".ts") || targetPath.endsWith(".md")
          ? "file"
          : "directory",
      size:
        targetPath.endsWith(".ts") || targetPath.endsWith(".md") ? 12 : null,
      mtime: new Date("2026-03-24T00:00:00.000Z"),
    }),
    readDirectory: async () => [
      { name: "src", kind: "directory" },
      { name: "README.md", kind: "file" },
      { name: ".env", kind: "file" },
      { name: "node_modules", kind: "directory" },
    ],
    readTextFile: async () => "hello world\n",
    createDirectory: async () => undefined,
    writeTextFile: async () => undefined,
    ...overrides,
  }
}

describe("listDirectoryUseCase", () => {
  it("lists a directory inside the allowed root", async () => {
    const repository = createRepositoryStub()

    await expect(
      listDirectoryUseCase(repository, {
        rootPath: "/workspace/root",
        path: "src",
      }),
    ).resolves.toEqual({
      path: "/workspace/root/src",
      parentPath: "/workspace/root",
      entries: [
        {
          name: "src",
          path: "/workspace/root/src/src",
          type: "directory",
          isHidden: false,
          isSymlink: false,
          size: null,
          mtime: "2026-03-24T00:00:00.000Z",
        },
        {
          name: "README.md",
          path: "/workspace/root/src/README.md",
          type: "file",
          isHidden: false,
          isSymlink: false,
          size: 12,
          mtime: "2026-03-24T00:00:00.000Z",
        },
      ],
      nextCursor: null,
      truncated: false,
    })
  })

  it("maps missing paths to structured filesystem error", async () => {
    const repository = createRepositoryStub({
      resolveRealPath: async () => {
        const error = new Error("missing")
        ;(error as Error & { code?: string }).code = "ENOENT"
        throw error
      },
    })

    await expect(
      listDirectoryUseCase(repository, {
        rootPath: "/workspace/root",
        path: "missing",
      }),
    ).rejects.toMatchObject({
      code: FILESYSTEM_ERROR_CODES.PATH_NOT_FOUND,
    } satisfies Partial<FileSystemError>)
  })

  it("rejects paths outside the allowed root", async () => {
    const repository = createRepositoryStub({
      resolveRealPath: async (targetPath) => {
        if (targetPath === "/workspace/root") {
          return targetPath
        }

        return "/workspace/other/file.ts"
      },
    })

    await expect(
      listDirectoryUseCase(repository, {
        rootPath: "/workspace/root",
        path: "escape",
      }),
    ).rejects.toMatchObject({
      code: FILESYSTEM_ERROR_CODES.PATH_OUTSIDE_ALLOWED_ROOT,
    } satisfies Partial<FileSystemError>)
  })
})
