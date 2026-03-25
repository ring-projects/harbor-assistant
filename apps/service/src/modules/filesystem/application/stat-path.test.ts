import { describe, expect, it } from "vitest"

import { statPathUseCase } from "./stat-path"
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
    readTextFile: async () => "",
    createDirectory: async () => undefined,
    writeTextFile: async () => undefined,
    ...overrides,
  }
}

describe("statPathUseCase", () => {
  it("returns metadata for a file inside the allowed root", async () => {
    const repository = createRepositoryStub()

    await expect(
      statPathUseCase(repository, {
        rootPath: "/workspace/root",
        path: "src/index.ts",
      }),
    ).resolves.toEqual({
      path: "/workspace/root/src/index.ts",
      type: "file",
      isHidden: false,
      isSymlink: false,
      size: 24,
      mtime: "2026-03-24T00:00:00.000Z",
    })
  })
})
