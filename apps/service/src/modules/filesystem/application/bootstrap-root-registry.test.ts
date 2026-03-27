import { describe, expect, it } from "vitest"

import type { FileSystemRepository } from "./filesystem-repository"
import { createBootstrapRootRegistry } from "./bootstrap-root-registry"
import { FILESYSTEM_ERROR_CODES, type FileSystemError } from "../errors"

function createRepositoryStub(
  overrides: Partial<FileSystemRepository> = {},
): FileSystemRepository {
  return {
    resolveRealPath: async (targetPath) => targetPath,
    statPath: async () => ({
      kind: "directory",
      size: null,
      mtime: new Date("2026-03-26T00:00:00.000Z"),
    }),
    lstatPath: async () => ({
      kind: "directory",
      size: null,
      mtime: new Date("2026-03-26T00:00:00.000Z"),
    }),
    readDirectory: async () => [],
    readTextFile: async () => "",
    createDirectory: async () => undefined,
    writeTextFile: async () => undefined,
    ...overrides,
  }
}

describe("createBootstrapRootRegistry", () => {
  it("loads configured roots and assigns a default root", async () => {
    const registry = createBootstrapRootRegistry(createRepositoryStub(), [
      {
        id: "default",
        label: "Local Files",
        path: "/workspace",
      },
    ])

    await expect(registry.listRoots()).resolves.toEqual([
      {
        id: "default",
        label: "Local Files",
        path: "/workspace",
        isDefault: true,
      },
    ])
  })

  it("rejects duplicate root ids", async () => {
    const registry = createBootstrapRootRegistry(createRepositoryStub(), [
      {
        id: "default",
        label: "Local Files",
        path: "/workspace",
      },
      {
        id: "default",
        label: "Workspace",
        path: "/workspace/projects",
      },
    ])

    await expect(registry.listRoots()).rejects.toMatchObject({
      code: FILESYSTEM_ERROR_CODES.INVALID_INPUT,
    } satisfies Partial<FileSystemError>)
  })

  it("fails when bootstrap filesystem roots are disabled", async () => {
    const registry = createBootstrapRootRegistry(createRepositoryStub(), [])

    await expect(registry.listRoots()).rejects.toMatchObject({
      code: FILESYSTEM_ERROR_CODES.BOOTSTRAP_FILESYSTEM_DISABLED,
    } satisfies Partial<FileSystemError>)
  })

  it("returns structured root-not-found for missing root ids", async () => {
    const registry = createBootstrapRootRegistry(createRepositoryStub(), [
      {
        id: "default",
        label: "Local Files",
        path: "/workspace",
        isDefault: true,
      },
    ])

    await expect(registry.getRoot("missing")).rejects.toMatchObject({
      code: FILESYSTEM_ERROR_CODES.FILESYSTEM_ROOT_NOT_FOUND,
    } satisfies Partial<FileSystemError>)
  })
})
