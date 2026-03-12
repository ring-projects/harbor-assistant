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

  it("runs migrate deploy when the sqlite file is missing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harbor-db-init-"))
    tempDirs.push(root)
    const databaseFile = path.join(root, "data", "harbor.sqlite")
    const runPrismaMigrateDeploy = vi.fn(async () => {})

    const result = await ensureServiceDatabaseInitialized({
      databaseUrl: `file:${databaseFile}`,
      serviceRootDirectory: root,
      runPrismaMigrateDeploy,
    })

    expect(result).toEqual({
      action: "migrated-missing-sqlite",
      sqliteFilePath: databaseFile,
    })
    expect(runPrismaMigrateDeploy).toHaveBeenCalledTimes(1)
  })

  it("runs migrate deploy when the sqlite file exists but schema is missing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harbor-db-init-"))
    tempDirs.push(root)
    const databaseFile = path.join(root, "data", "harbor.sqlite")
    await mkdir(path.dirname(databaseFile), { recursive: true })
    await writeFile(databaseFile, "", "utf8")
    const inspectSqliteSchema = vi.fn(async () => false)
    const runPrismaMigrateDeploy = vi.fn(async () => {})

    const result = await ensureServiceDatabaseInitialized({
      databaseUrl: `file:${databaseFile}`,
      serviceRootDirectory: root,
      inspectSqliteSchema,
      runPrismaMigrateDeploy,
    })

    expect(result).toEqual({
      action: "migrated-uninitialized-sqlite",
      sqliteFilePath: databaseFile,
    })
    expect(inspectSqliteSchema).toHaveBeenCalledTimes(1)
    expect(runPrismaMigrateDeploy).toHaveBeenCalledTimes(1)
  })

  it("skips migrate deploy when the sqlite schema is already initialized", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harbor-db-init-"))
    tempDirs.push(root)
    const databaseFile = path.join(root, "data", "harbor.sqlite")
    await mkdir(path.dirname(databaseFile), { recursive: true })
    await writeFile(databaseFile, "", "utf8")
    const inspectSqliteSchema = vi.fn(async () => true)
    const runPrismaMigrateDeploy = vi.fn(async () => {})

    const result = await ensureServiceDatabaseInitialized({
      databaseUrl: `file:${databaseFile}`,
      serviceRootDirectory: root,
      inspectSqliteSchema,
      runPrismaMigrateDeploy,
    })

    expect(result).toEqual({
      action: "ready",
      sqliteFilePath: databaseFile,
    })
    expect(runPrismaMigrateDeploy).not.toHaveBeenCalled()
  })

  it("skips auto-migration for non-sqlite datasources", async () => {
    const runPrismaMigrateDeploy = vi.fn(async () => {})

    const result = await ensureServiceDatabaseInitialized({
      databaseUrl: "postgresql://localhost:5432/harbor",
      runPrismaMigrateDeploy,
    })

    expect(result).toEqual({
      action: "skipped-non-sqlite",
    })
    expect(runPrismaMigrateDeploy).not.toHaveBeenCalled()
  })
})
