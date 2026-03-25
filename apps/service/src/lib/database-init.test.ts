import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import { ensureServiceDatabaseInitialized } from "./database-init"

describe("ensureServiceDatabaseInitialized", () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    vi.restoreAllMocks()
    await Promise.all(
      tempDirs.splice(0, tempDirs.length).map((directory) =>
        rm(directory, { recursive: true, force: true }),
      ),
    )
  })

  it("runs db push when the sqlite file is missing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harbor-db-init-"))
    tempDirs.push(root)
    const databaseFile = path.join(root, "data", "harbor.sqlite")
    const runPrismaDbPush = vi.fn(async () => {})

    const result = await ensureServiceDatabaseInitialized({
      databaseUrl: `file:${databaseFile}`,
      serviceRootDirectory: root,
      runPrismaDbPush,
    })

    expect(result).toEqual({
      action: "migrated-missing-sqlite",
      sqliteFilePath: databaseFile,
    })
    expect(runPrismaDbPush).toHaveBeenCalledTimes(1)
  })

  it("runs db push when the sqlite file exists but schema is missing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harbor-db-init-"))
    tempDirs.push(root)
    const databaseFile = path.join(root, "data", "harbor.sqlite")
    await mkdir(path.dirname(databaseFile), { recursive: true })
    await writeFile(databaseFile, "", "utf8")
    const inspectSqliteSchema = vi.fn(async () => false)
    const runPrismaDbPush = vi.fn(async () => {})

    const result = await ensureServiceDatabaseInitialized({
      databaseUrl: `file:${databaseFile}`,
      serviceRootDirectory: root,
      inspectSqliteSchema,
      runPrismaDbPush,
    })

    expect(result).toEqual({
      action: "migrated-uninitialized-sqlite",
      sqliteFilePath: databaseFile,
    })
    expect(inspectSqliteSchema).toHaveBeenCalledTimes(1)
    expect(runPrismaDbPush).toHaveBeenCalledTimes(1)
  })

  it("skips db push when the sqlite schema is already initialized", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harbor-db-init-"))
    tempDirs.push(root)
    const databaseFile = path.join(root, "data", "harbor.sqlite")
    await mkdir(path.dirname(databaseFile), { recursive: true })
    await writeFile(databaseFile, "", "utf8")
    const inspectSqliteSchema = vi.fn(async () => true)
    const runPrismaDbPush = vi.fn(async () => {})

    const result = await ensureServiceDatabaseInitialized({
      databaseUrl: `file:${databaseFile}`,
      serviceRootDirectory: root,
      inspectSqliteSchema,
      runPrismaDbPush,
    })

    expect(result).toEqual({
      action: "ready",
      sqliteFilePath: databaseFile,
    })
    expect(runPrismaDbPush).not.toHaveBeenCalled()
  })

  it("skips auto-migration for non-sqlite datasources", async () => {
    const runPrismaDbPush = vi.fn(async () => {})

    const result = await ensureServiceDatabaseInitialized({
      databaseUrl: "postgresql://localhost:5432/harbor",
      runPrismaDbPush,
    })

    expect(result).toEqual({
      action: "skipped-non-sqlite",
    })
    expect(runPrismaDbPush).not.toHaveBeenCalled()
  })
})
