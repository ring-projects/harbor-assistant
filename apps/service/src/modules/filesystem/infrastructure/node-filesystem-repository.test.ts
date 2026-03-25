import { mkdtemp, mkdir, readlink, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { listDirectoryUseCase } from "../application/list-directory"
import { readTextFileUseCase } from "../application/read-text-file"
import { statPathUseCase } from "../application/stat-path"
import { writeTextFileUseCase } from "../application/write-text-file"
import { createDirectoryUseCase } from "../application/create-directory"
import { FILESYSTEM_ERROR_CODES } from "../errors"
import { createNodeFileSystemRepository } from "./node-filesystem-repository"

describe("createNodeFileSystemRepository", () => {
  const roots: string[] = []

  afterEach(async () => {
    await Promise.all(
      roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
    )
  })

  it("lists directories, stats files, reads text files and blocks symlink escape", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harbor-filesystem-module-"))
    roots.push(root)

    await mkdir(path.join(root, "src"), { recursive: true })
    await writeFile(path.join(root, "README.md"), "hello\n", "utf8")
    await writeFile(path.join(root, "src/index.ts"), "export const value = 1\n", "utf8")

    const outsideRoot = await mkdtemp(path.join(tmpdir(), "harbor-filesystem-outside-"))
    roots.push(outsideRoot)
    await writeFile(path.join(outsideRoot, "secret.txt"), "secret\n", "utf8")

    await symlink(
      path.join(outsideRoot, "secret.txt"),
      path.join(root, "escape-link"),
    )
    await readlink(path.join(root, "escape-link"))

    const repository = createNodeFileSystemRepository()

    await expect(
      listDirectoryUseCase(repository, {
        rootPath: root,
        path: ".",
      }),
    ).resolves.toMatchObject({
      path: expect.stringContaining(path.basename(root)),
      entries: expect.arrayContaining([
        expect.objectContaining({
          name: "src",
          type: "directory",
        }),
        expect.objectContaining({
          name: "README.md",
          type: "file",
        }),
      ]),
    })

    await expect(
      statPathUseCase(repository, {
        rootPath: root,
        path: "src/index.ts",
      }),
    ).resolves.toMatchObject({
      path: expect.stringContaining("/src/index.ts"),
      type: "file",
    })

    await expect(
      readTextFileUseCase(repository, {
        rootPath: root,
        path: "src/index.ts",
      }),
    ).resolves.toMatchObject({
      content: "export const value = 1\n",
    })

    await expect(
      statPathUseCase(repository, {
        rootPath: root,
        path: "escape-link",
      }),
    ).rejects.toMatchObject({
      code: FILESYSTEM_ERROR_CODES.PATH_OUTSIDE_ALLOWED_ROOT,
    })
  })

  it("creates directories and writes files in a real temporary directory", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harbor-filesystem-module-"))
    roots.push(root)

    const repository = createNodeFileSystemRepository()

    await expect(
      createDirectoryUseCase(repository, {
        rootPath: root,
        path: "generated/output",
      }),
    ).resolves.toMatchObject({
      path: expect.stringContaining("/generated/output"),
      type: "directory",
    })

    await expect(
      writeTextFileUseCase(repository, {
        rootPath: root,
        path: "generated/output/file.txt",
        content: "hello wrapper\n",
      }),
    ).resolves.toMatchObject({
      path: expect.stringContaining("/generated/output/file.txt"),
      content: "hello wrapper\n",
    })

    await expect(
      readTextFileUseCase(repository, {
        rootPath: root,
        path: "generated/output/file.txt",
      }),
    ).resolves.toMatchObject({
      content: "hello wrapper\n",
    })
  })
})
