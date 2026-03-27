import { mkdtemp, mkdir, rm, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { DOCUMENT_ERROR_CODES } from "../errors"
import { createNodeDocumentWorkspacePolicy } from "./node-document-workspace-policy"

describe("createNodeDocumentWorkspacePolicy", () => {
  const roots: string[] = []

  afterEach(async () => {
    await Promise.all(
      roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
    )
  })

  it("resolves a document path within the project .harbor workspace", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harbor-document-workspace-"))
    roots.push(root)

    const policy = createNodeDocumentWorkspacePolicy()
    const resolved = await policy.resolveDocumentPath({
      projectRootPath: root,
      path: ".harbor/docs/requirements/requirements-doc-1.md",
    })

    expect(resolved.workspaceRootPath).toBe(path.join(root, ".harbor"))
    expect(resolved.absolutePath).toBe(
      path.join(root, ".harbor/docs/requirements/requirements-doc-1.md"),
    )
  })

  it("rejects document paths outside the project .harbor workspace", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harbor-document-workspace-"))
    roots.push(root)

    const policy = createNodeDocumentWorkspacePolicy()

    await expect(
      policy.resolveDocumentPath({
        projectRootPath: root,
        path: "../escape.md",
      }),
    ).rejects.toMatchObject({
      code: DOCUMENT_ERROR_CODES.INVALID_PATH,
    })
  })

  it("rejects symlinked workspace segments that escape the project", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harbor-document-workspace-"))
    const outside = await mkdtemp(path.join(tmpdir(), "harbor-document-outside-"))
    roots.push(root, outside)

    await mkdir(path.join(root, ".harbor"), { recursive: true })
    await symlink(outside, path.join(root, ".harbor/docs"))

    const policy = createNodeDocumentWorkspacePolicy()

    await expect(
      policy.resolveDocumentPath({
        projectRootPath: root,
        path: ".harbor/docs/requirements/requirements-doc-1.md",
      }),
    ).rejects.toMatchObject({
      code: DOCUMENT_ERROR_CODES.INVALID_PATH,
    })
  })
})
