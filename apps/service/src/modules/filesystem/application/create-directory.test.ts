import { describe, expect, it } from "vitest"

import { createDirectoryUseCase } from "./create-directory"
import { FILESYSTEM_ERROR_CODES, FileSystemError } from "../errors"
import type { FileSystemRepository } from "./filesystem-repository"

function createRepositoryStub(
  overrides: Partial<FileSystemRepository> = {},
): FileSystemRepository {
  const directories = new Set<string>(["/workspace/root"])
  const files = new Set<string>()

  return {
    resolveRealPath: async (targetPath) => targetPath,
    statPath: async (targetPath) => {
      if (directories.has(targetPath)) {
        return {
          kind: "directory",
          size: null,
          mtime: new Date("2026-03-24T00:00:00.000Z"),
        }
      }

      if (files.has(targetPath)) {
        return {
          kind: "file",
          size: 10,
          mtime: new Date("2026-03-24T00:00:00.000Z"),
        }
      }

      const error = new Error("missing")
      ;(error as Error & { code?: string }).code = "ENOENT"
      throw error
    },
    lstatPath: async (targetPath) => {
      if (directories.has(targetPath)) {
        return {
          kind: "directory",
          size: null,
          mtime: new Date("2026-03-24T00:00:00.000Z"),
        }
      }

      if (files.has(targetPath)) {
        return {
          kind: "file",
          size: 10,
          mtime: new Date("2026-03-24T00:00:00.000Z"),
        }
      }

      return null
    },
    readDirectory: async () => [],
    readTextFile: async () => "",
    createDirectory: async (targetPath) => {
      directories.add(targetPath)
    },
    writeTextFile: async (targetPath) => {
      files.add(targetPath)
    },
    ...overrides,
  }
}

describe("createDirectoryUseCase", () => {
  it("creates a directory inside the allowed root", async () => {
    const repository = createRepositoryStub()

    await expect(
      createDirectoryUseCase(repository, {
        rootPath: "/workspace/root",
        path: "src/generated",
      }),
    ).resolves.toEqual({
      path: "/workspace/root/src/generated",
      type: "directory",
      isHidden: false,
      isSymlink: false,
      size: null,
      mtime: "2026-03-24T00:00:00.000Z",
    })
  })

  it("rejects creating a directory outside the allowed root", async () => {
    const repository = createRepositoryStub({
      resolveRealPath: async (targetPath) => {
        if (targetPath === "/workspace/root") {
          return targetPath
        }

        return "/workspace/other/dir"
      },
    })

    await expect(
      createDirectoryUseCase(repository, {
        rootPath: "/workspace/root",
        path: "escape",
      }),
    ).rejects.toMatchObject({
      code: FILESYSTEM_ERROR_CODES.PATH_OUTSIDE_ALLOWED_ROOT,
    } satisfies Partial<FileSystemError>)
  })

  it("rejects creating a directory where a file already exists", async () => {
    const repository = createRepositoryStub({
      createDirectory: async () => undefined,
      statPath: async () => ({
        kind: "file",
        size: 10,
        mtime: new Date("2026-03-24T00:00:00.000Z"),
      }),
    })

    await expect(
      createDirectoryUseCase(repository, {
        rootPath: "/workspace/root",
        path: "README.md",
      }),
    ).rejects.toMatchObject({
      code: FILESYSTEM_ERROR_CODES.NOT_A_DIRECTORY,
    } satisfies Partial<FileSystemError>)
  })
})
