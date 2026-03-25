import { describe, expect, it } from "vitest"

import { readTextFileUseCase } from "./read-text-file"
import { FILESYSTEM_ERROR_CODES, FileSystemError } from "../errors"
import type { FileSystemRepository } from "./filesystem-repository"

function createRepositoryStub(
  overrides: Partial<FileSystemRepository> = {},
): FileSystemRepository {
  return {
    resolveRealPath: async (targetPath) => targetPath,
    statPath: async (targetPath) => ({
      kind: targetPath.endsWith(".ts") ? "file" : "directory",
      size: targetPath.endsWith(".ts") ? 24 : null,
      mtime: new Date("2026-03-24T00:00:00.000Z"),
    }),
    lstatPath: async (targetPath) => ({
      kind: targetPath.endsWith(".ts") ? "file" : "directory",
      size: targetPath.endsWith(".ts") ? 24 : null,
      mtime: new Date("2026-03-24T00:00:00.000Z"),
    }),
    readDirectory: async () => [],
    readTextFile: async () => "export const value = 1\n",
    createDirectory: async () => undefined,
    writeTextFile: async () => undefined,
    ...overrides,
  }
}

describe("readTextFileUseCase", () => {
  it("reads text file content inside the allowed root", async () => {
    const repository = createRepositoryStub()

    await expect(
      readTextFileUseCase(repository, {
        rootPath: "/workspace/root",
        path: "src/index.ts",
      }),
    ).resolves.toEqual({
      path: "/workspace/root/src/index.ts",
      content: "export const value = 1\n",
      size: 24,
      mtime: "2026-03-24T00:00:00.000Z",
    })
  })

  it("rejects reading a directory as a file", async () => {
    const repository = createRepositoryStub({
      statPath: async () => ({
        kind: "directory",
        size: null,
        mtime: new Date("2026-03-24T00:00:00.000Z"),
      }),
    })

    await expect(
      readTextFileUseCase(repository, {
        rootPath: "/workspace/root",
        path: "src",
      }),
    ).rejects.toMatchObject({
      code: FILESYSTEM_ERROR_CODES.NOT_A_FILE,
    } satisfies Partial<FileSystemError>)
  })
})
