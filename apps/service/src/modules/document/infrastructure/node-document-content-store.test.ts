import { mkdtemp, readFile, rm, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { DOCUMENT_ERROR_CODES } from "../errors"
import { createNodeDocumentWorkspacePolicy } from "./node-document-workspace-policy"
import { createNodeDocumentContentStore } from "./node-document-content-store"

describe("createNodeDocumentContentStore", () => {
  const roots: string[] = []

  afterEach(async () => {
    await Promise.all(
      roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
    )
  })

  it("creates project-local directories and writes markdown content", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harbor-document-store-"))
    roots.push(root)

    const store = createNodeDocumentContentStore(
      createNodeDocumentWorkspacePolicy(),
    )

    await store.write({
      projectRootPath: root,
      path: ".harbor/docs/requirements/requirements-doc-1.md",
      format: "markdown",
      content: "# Runtime Drift\n\nCapture requirements.",
    })

    const content = await readFile(
      path.join(root, ".harbor/docs/requirements/requirements-doc-1.md"),
      "utf8",
    )
    expect(content).toBe("# Runtime Drift\n\nCapture requirements.")
  })

  it("reads json content from the project-local path", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harbor-document-store-"))
    roots.push(root)

    const store = createNodeDocumentContentStore(
      createNodeDocumentWorkspacePolicy(),
    )

    await store.write({
      projectRootPath: root,
      path: ".harbor/docs/bundles/bundle-doc-1.json",
      format: "json",
      content: '{"goal":"investigate drift"}',
    })

    await expect(
      store.read({
        projectRootPath: root,
        path: ".harbor/docs/bundles/bundle-doc-1.json",
      }),
    ).resolves.toMatchObject({
      path: ".harbor/docs/bundles/bundle-doc-1.json",
      format: "json",
      content: '{"goal":"investigate drift"}',
    })
  })

  it("rejects symlink escape when writing content", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harbor-document-store-"))
    const outside = await mkdtemp(
      path.join(tmpdir(), "harbor-document-outside-"),
    )
    roots.push(root, outside)

    await symlink(outside, path.join(root, ".harbor"))

    const store = createNodeDocumentContentStore(
      createNodeDocumentWorkspacePolicy(),
    )

    await expect(
      store.write({
        projectRootPath: root,
        path: ".harbor/docs/requirements/requirements-doc-1.md",
        format: "markdown",
        content: "# Runtime Drift",
      }),
    ).rejects.toMatchObject({
      code: DOCUMENT_ERROR_CODES.INVALID_PATH,
    })
  })
})
