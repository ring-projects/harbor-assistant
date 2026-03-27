import { describe, expect, it } from "vitest"

import type { FileSystemRepository } from "./filesystem-repository"
import { listBootstrapDirectoryUseCase } from "./list-bootstrap-directory"
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
    readDirectory: async () => [
      { name: "apps", kind: "directory" },
      { name: "README.md", kind: "file" },
    ],
    readTextFile: async () => "",
    createDirectory: async () => undefined,
    writeTextFile: async () => undefined,
    ...overrides,
  }
}

describe("listBootstrapDirectoryUseCase", () => {
  it("lists directories inside the configured bootstrap root", async () => {
    const repository = createRepositoryStub()

    await expect(
      listBootstrapDirectoryUseCase(
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
          path: ".",
          directoriesOnly: true,
        },
      ),
    ).resolves.toEqual({
      rootId: "default",
      rootPath: "/workspace",
      path: null,
      absolutePath: "/workspace",
      parentPath: null,
      entries: [
        {
          name: "apps",
          path: "apps",
          absolutePath: "/workspace/apps",
          type: "directory",
          isHidden: false,
          isSymlink: false,
          size: null,
          mtime: "2026-03-26T00:00:00.000Z",
        },
      ],
      nextCursor: null,
      truncated: false,
    })
  })

  it("returns structured root-not-found when root id is unknown", async () => {
    const repository = createRepositoryStub()

    await expect(
      listBootstrapDirectoryUseCase(
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
