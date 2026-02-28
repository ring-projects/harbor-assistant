import { randomUUID } from "node:crypto"
import { mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { readFile, realpath, stat } from "node:fs/promises"
import path from "node:path"

import Database from "better-sqlite3"

import type { Project, ProjectErrorCode } from "@/services/project/types"
import { getAppConfig } from "@/utils/yaml-config"

function nowIsoString() {
  return new Date().toISOString()
}

function resolveProjectDataFile() {
  return path.resolve(getAppConfig().project.dataFile)
}

function ensureProjectDatabase() {
  const databasePath = resolveProjectDataFile()
  const databaseDir = path.dirname(databasePath)
  mkdirSync(databaseDir, { recursive: true })

  const db = new Database(databasePath)
  db.pragma("journal_mode = WAL")
  db.pragma("foreign_keys = ON")
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    )
  `)

  return db
}

let databaseSingleton: Database.Database | null = null

function resolveLegacyWorkspaceDataFile() {
  return path.join(homedir(), ".otter", "data", "workspaces.json")
}

function parseLegacyWorkspaceItems(value: unknown): Array<{
  id: string
  name: string
  path: string
  createdAt: string
}> {
  if (
    typeof value !== "object" ||
    value === null ||
    !Array.isArray((value as { workspaces?: unknown[] }).workspaces)
  ) {
    return []
  }

  const workspaces = (value as { workspaces: unknown[] }).workspaces
  return workspaces
    .filter((item) => typeof item === "object" && item !== null)
    .filter(
      (item) =>
        typeof (item as { id?: unknown }).id === "string" &&
        typeof (item as { name?: unknown }).name === "string" &&
        typeof (item as { path?: unknown }).path === "string" &&
        typeof (item as { createdAt?: unknown }).createdAt === "string",
    )
    .map((item) => ({
      id: String((item as { id: string }).id),
      name: String((item as { name: string }).name),
      path: String((item as { path: string }).path),
      createdAt: String((item as { createdAt: string }).createdAt),
    }))
}

async function migrateLegacyWorkspacesIfNeeded(db: Database.Database) {
  const row = db
    .prepare("SELECT COUNT(1) AS count FROM projects")
    .get() as { count: number } | undefined
  if ((row?.count ?? 0) > 0) {
    return
  }

  const legacyFilePath = resolveLegacyWorkspaceDataFile()
  const rawContent = await readFile(legacyFilePath, "utf8").catch(() => null)
  if (!rawContent) {
    return
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawContent)
  } catch {
    return
  }

  const legacyItems = parseLegacyWorkspaceItems(parsed)
  if (legacyItems.length === 0) {
    return
  }

  const insertStatement = db.prepare(
    `INSERT OR IGNORE INTO projects (id, name, path, created_at)
     VALUES (?, ?, ?, ?)`,
  )
  const transaction = db.transaction(
    (
      items: Array<{
        id: string
        name: string
        path: string
        createdAt: string
      }>,
    ) => {
      for (const item of items) {
        insertStatement.run(item.id, item.name, item.path, item.createdAt)
      }
    },
  )
  transaction(legacyItems)
}

async function getDatabase() {
  if (databaseSingleton) {
    return databaseSingleton
  }

  databaseSingleton = ensureProjectDatabase()
  await migrateLegacyWorkspacesIfNeeded(databaseSingleton)
  return databaseSingleton
}

async function resolveProjectPath(rawPath: string) {
  const trimmedPath = rawPath.trim()
  if (!trimmedPath) {
    throw new ProjectRepositoryError(
      "INVALID_PATH",
      "Project path cannot be empty.",
    )
  }

  const baseRootDirectory = getAppConfig().fileBrowser.rootDirectory
  const absolutePath = path.isAbsolute(trimmedPath)
    ? path.resolve(trimmedPath)
    : path.resolve(baseRootDirectory, trimmedPath)

  let canonicalPath: string
  try {
    canonicalPath = await realpath(absolutePath)
  } catch (error) {
    throw new ProjectRepositoryError(
      "PATH_NOT_FOUND",
      `Project path does not exist: ${absolutePath}. ${String(error)}`,
    )
  }

  let pathStats
  try {
    pathStats = await stat(canonicalPath)
  } catch (error) {
    throw new ProjectRepositoryError(
      "PATH_NOT_FOUND",
      `Failed to stat project path: ${canonicalPath}. ${String(error)}`,
    )
  }

  if (!pathStats.isDirectory()) {
    throw new ProjectRepositoryError(
      "NOT_A_DIRECTORY",
      "Project path must point to a directory.",
    )
  }

  return canonicalPath
}

function buildProjectName(canonicalPath: string, explicitName?: string) {
  const trimmedName = explicitName?.trim()
  if (trimmedName) {
    return trimmedName
  }

  const basename = path.basename(canonicalPath)
  return basename || canonicalPath
}

export class ProjectRepositoryError extends Error {
  code: ProjectErrorCode

  constructor(code: ProjectErrorCode, message: string) {
    super(message)
    this.name = "ProjectRepositoryError"
    this.code = code
  }
}

export async function listProjects(): Promise<Project[]> {
  try {
    const db = await getDatabase()
    const rows = db
      .prepare(
        `SELECT id, name, path, created_at AS createdAt
         FROM projects
         ORDER BY created_at DESC`,
      )
      .all() as Project[]

    return rows
  } catch (error) {
    throw new ProjectRepositoryError(
      "DB_READ_ERROR",
      `Failed to read projects: ${String(error)}`,
    )
  }
}

export async function getProjectById(id: string): Promise<Project | null> {
  const trimmedId = id.trim()
  if (!trimmedId) {
    return null
  }

  try {
    const db = await getDatabase()
    const row = db
      .prepare(
        `SELECT id, name, path, created_at AS createdAt
         FROM projects
         WHERE id = ?`,
      )
      .get(trimmedId) as Project | undefined

    return row ?? null
  } catch (error) {
    throw new ProjectRepositoryError(
      "DB_READ_ERROR",
      `Failed to read project: ${String(error)}`,
    )
  }
}

export async function addProject(input: {
  path: string
  name?: string
}): Promise<Project> {
  const canonicalPath = await resolveProjectPath(input.path)
  const project: Project = {
    id: randomUUID(),
    name: buildProjectName(canonicalPath, input.name),
    path: canonicalPath,
    createdAt: nowIsoString(),
  }

  try {
    const db = await getDatabase()
    db.prepare(
      `INSERT INTO projects (id, name, path, created_at)
       VALUES (?, ?, ?, ?)`,
    ).run(project.id, project.name, project.path, project.createdAt)

    return project
  } catch (error) {
    const message = String(error)
    if (message.includes("UNIQUE constraint failed: projects.path")) {
      throw new ProjectRepositoryError(
        "DUPLICATE_PATH",
        `Project path already exists: ${canonicalPath}`,
      )
    }

    throw new ProjectRepositoryError(
      "DB_WRITE_ERROR",
      `Failed to write project: ${message}`,
    )
  }
}

export async function deleteProject(id: string): Promise<boolean> {
  const trimmedId = id.trim()
  if (!trimmedId) {
    throw new ProjectRepositoryError(
      "INVALID_PROJECT_ID",
      "Project id cannot be empty.",
    )
  }

  try {
    const db = await getDatabase()
    const result = db.prepare(`DELETE FROM projects WHERE id = ?`).run(trimmedId)
    return result.changes > 0
  } catch (error) {
    throw new ProjectRepositoryError(
      "DB_WRITE_ERROR",
      `Failed to delete project: ${String(error)}`,
    )
  }
}
