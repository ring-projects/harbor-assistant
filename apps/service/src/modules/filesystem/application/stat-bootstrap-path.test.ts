import { describe, expect, it } from "vitest"

import type { FileSystemRepository } from "./filesystem-repository"
import { statBootstrapPathUseCase } from "./stat-bootstrap-path"
import { FILESYSTEM_ERROR_CODES, type FileSystemError } from "../errors"

function createRepositoryStub(
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
    readDirectory: async () => [],
    readTextFile: async () => "",
    createDirectory: async () => undefined,
    writeTextFile: async () => undefined,
    ...overrides,
  }
}

describe("statBootstrapPathUseCase", () => {
  it("stats a path inside the configured bootstrap root", async () => {
    const repository = createRepositoryStub()

    await expect(
      statBootstrapPathUseCase(
        repository,
        [
          {
            id: "default",
            label: "Local Files",
            path: "/workspace",
            isDefault: true,
          },
        ],
        {
          rootId: "default",
          path: "README.md",
        },
      ),
    ).resolves.toEqual({
      rootId: "default",
      rootPath: "/workspace",
      path: "README.md",
      absolutePath: "/workspace/README.md",
      type: "file",
      isHidden: false,
      isSymlink: false,
      size: 24,
      mtime: "2026-03-26T00:00:00.000Z",
    })
  })

  it("returns structured root-not-found when root id is unknown", async () => {
    const repository = createRepositoryStub()

    await expect(
      statBootstrapPathUseCase(
        repository,
        [
          {
            id: "default",
            label: "Local Files",
            path: "/workspace",
            isDefault: true,
          },
        ],
        {
          rootId: "missing",
        },
      ),
    ).rejects.toMatchObject({
      code: FILESYSTEM_ERROR_CODES.FILESYSTEM_ROOT_NOT_FOUND,
    } satisfies Partial<FileSystemError>)
  })
})
