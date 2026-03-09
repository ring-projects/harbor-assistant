import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import type { FastifyInstance } from "fastify"

import { createFileSystemTestApp } from "../../../../test/helpers/filesystem-test-app"

describe("filesystem routes", () => {
  let app: FastifyInstance
  let rootDirectory: string
  let canonicalRootDirectory: string
  let childDirectory: string
  let hiddenFilePath: string
  let visibleFilePath: string

  beforeAll(async () => {
    rootDirectory = await mkdtemp(path.join(tmpdir(), "harbor-filesystem-test-"))
    canonicalRootDirectory = await realpath(rootDirectory)
    childDirectory = path.join(rootDirectory, "src")
    hiddenFilePath = path.join(rootDirectory, ".env")
    visibleFilePath = path.join(rootDirectory, "README.md")

    await mkdir(childDirectory, { recursive: true })
    await writeFile(visibleFilePath, "hello")
    await writeFile(hiddenFilePath, "secret")

    app = await createFileSystemTestApp({
      rootDirectory,
    })
  })

  afterAll(async () => {
    await app.close()
    await rm(rootDirectory, { recursive: true, force: true })
  })

  it("lists the configured root directory", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/fs/list",
      payload: {},
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      ok: true,
      path: canonicalRootDirectory,
      parentPath: null,
      truncated: false,
    })

    const body = response.json() as {
      entries: Array<{ name: string; type: string }>
    }
    expect(body.entries.map((entry) => ({
      name: entry.name,
      type: entry.type,
    }))).toEqual([
      { name: "src", type: "directory" },
      { name: "README.md", type: "file" },
    ])
  })

  it("includes hidden files when explicitly requested", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/fs/list",
      payload: {
        includeHidden: true,
      },
    })

    expect(response.statusCode).toBe(200)

    const body = response.json() as {
      entries: Array<{ name: string }>
    }
    expect(body.entries.map((entry) => entry.name)).toEqual([
      "src",
      ".env",
      "README.md",
    ])
  })

  it("rejects paths outside the allowed root", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/fs/list",
      payload: {
        path: path.resolve(rootDirectory, ".."),
      },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "PATH_OUTSIDE_ALLOWED_ROOT",
      },
    })
  })

  it("rejects invalid cursors", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/fs/list",
      payload: {
        cursor: "oops",
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_CURSOR",
      },
    })
  })

  it("returns not found for missing paths", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/fs/list",
      payload: {
        path: "missing",
      },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "PATH_NOT_FOUND",
      },
    })
  })
})
