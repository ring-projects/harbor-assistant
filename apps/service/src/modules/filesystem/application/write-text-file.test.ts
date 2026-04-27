import { describe, expect, it } from "vitest"

import { writeTextFileUseCase } from "./write-text-file"
import { FILESYSTEM_ERROR_CODES, FileSystemError } from "../errors"
import type { FileSystemRepository } from "./filesystem-repository"

function createRepositoryStub(
  overrides: Partial<FileSystemRepository> = {},
): FileSystemRepository {
  const files = new Map<string, string>()
  const directories = new Set<string>([
    "/workspace/root",
    "/workspace/root/src",
  ])

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

      return {
        kind: "file",
        size: files.get(targetPath)?.length ?? 0,
        mtime: new Date("2026-03-24T00:00:00.000Z"),
      }
    },
    lstatPath: async (targetPath) => {
      if (directories.has(targetPath)) {
        return {
          kind: "directory",
          size: null,
          mtime: new Date("2026-03-24T00:00:00.000Z"),
        }
      }

      return {
        kind: "file",
        size: files.get(targetPath)?.length ?? 0,
        mtime: new Date("2026-03-24T00:00:00.000Z"),
      }
    },
    readDirectory: async () => [],
    readTextFile: async (targetPath) => files.get(targetPath) ?? "",
    createDirectory: async (targetPath) => {
      directories.add(targetPath)
    },
    writeTextFile: async (targetPath, content) => {
      const parentPath = targetPath.split("/").slice(0, -1).join("/") || "/"
      if (!directories.has(parentPath)) {
        const error = new Error("missing parent")
        ;(error as Error & { code?: string }).code = "ENOENT"
        throw error
      }

      files.set(targetPath, content)
    },
    ...overrides,
  }
}

describe("writeTextFileUseCase", () => {
  it("writes a text file inside the allowed root", async () => {
    const repository = createRepositoryStub()

    await expect(
      writeTextFileUseCase(repository, {
        rootPath: "/workspace/root",
        path: "src/index.ts",
        content: "export const value = 2\n",
      }),
    ).resolves.toEqual({
      path: "/workspace/root/src/index.ts",
      content: "export const value = 2\n",
      size: 23,
      mtime: "2026-03-24T00:00:00.000Z",
    })
  })

  it("rejects writing outside the allowed root", async () => {
    const repository = createRepositoryStub({
      resolveRealPath: async (targetPath) => {
        if (targetPath === "/workspace/root") {
          return targetPath
        }

        return "/workspace/other/file.ts"
      },
    })

    await expect(
      writeTextFileUseCase(repository, {
        rootPath: "/workspace/root",
        path: "escape.ts",
        content: "bad\n",
      }),
    ).rejects.toMatchObject({
      code: FILESYSTEM_ERROR_CODES.PATH_OUTSIDE_ALLOWED_ROOT,
    } satisfies Partial<FileSystemError>)
  })

  it("rejects writing to a directory target", async () => {
    const repository = createRepositoryStub()

    await expect(
      writeTextFileUseCase(repository, {
        rootPath: "/workspace/root",
        path: "src",
        content: "bad\n",
      }),
    ).rejects.toMatchObject({
      code: FILESYSTEM_ERROR_CODES.NOT_A_FILE,
    } satisfies Partial<FileSystemError>)
  })

  it("does not create parent directories by default", async () => {
    const repository = createRepositoryStub()

    await expect(
      writeTextFileUseCase(repository, {
        rootPath: "/workspace/root",
        path: "generated/output/file.ts",
        content: "export const value = 3\n",
      }),
    ).rejects.toMatchObject({
      code: FILESYSTEM_ERROR_CODES.PATH_NOT_FOUND,
    } satisfies Partial<FileSystemError>)
  })

  it("creates parent directories only when createParents is enabled", async () => {
    const repository = createRepositoryStub()

    await expect(
      writeTextFileUseCase(repository, {
        rootPath: "/workspace/root",
        path: "generated/output/file.ts",
        content: "export const value = 3\n",
        createParents: true,
      }),
    ).resolves.toEqual({
      path: "/workspace/root/generated/output/file.ts",
      content: "export const value = 3\n",
      size: 23,
      mtime: "2026-03-24T00:00:00.000Z",
    })
  })
})
