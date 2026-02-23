import { randomUUID } from "node:crypto"
import { stat, realpath } from "node:fs/promises"
import path from "node:path"

import {
  readJsonFile,
  withFileLock,
  writeJsonFileAtomic,
} from "@/lib/json-store"
import type {
  Workspace,
  WorkspaceErrorCode,
  WorkspaceStoreDocument,
} from "@/services/workspace/types"
import { getAppConfig } from "@/utils/yaml-config"

const STORE_VERSION = 1

function nowIsoString() {
  return new Date().toISOString()
}

function createDefaultDocument(): WorkspaceStoreDocument {
  return {
    version: STORE_VERSION,
    updatedAt: nowIsoString(),
    workspaces: [],
  }
}

function resolveWorkspaceDataFile() {
  return path.resolve(getAppConfig().workspace.dataFile)
}

function ensureValidWorkspaceDocument(
  candidate: WorkspaceStoreDocument,
): WorkspaceStoreDocument {
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    !Array.isArray(candidate.workspaces)
  ) {
    throw new WorkspaceRepositoryError(
      "STORE_READ_ERROR",
      "Workspace store file has invalid JSON schema.",
    )
  }

  return {
    version:
      typeof candidate.version === "number" ? candidate.version : STORE_VERSION,
    updatedAt:
      typeof candidate.updatedAt === "string"
        ? candidate.updatedAt
        : nowIsoString(),
    workspaces: candidate.workspaces
      .filter((item) => {
        if (typeof item !== "object" || item === null) {
          return false
        }

        return (
          typeof item.id === "string" &&
          typeof item.name === "string" &&
          typeof item.path === "string" &&
          typeof item.createdAt === "string"
        )
      })
      .map((item) => ({
        id: item.id,
        name: item.name,
        path: item.path,
        createdAt: item.createdAt,
      })),
  }
}

async function loadWorkspaceDocument(): Promise<WorkspaceStoreDocument> {
  const filePath = resolveWorkspaceDataFile()

  let document: WorkspaceStoreDocument
  try {
    document = await readJsonFile<WorkspaceStoreDocument>({
      filePath,
      fallback: createDefaultDocument(),
    })
  } catch (error) {
    throw new WorkspaceRepositoryError(
      "STORE_READ_ERROR",
      `Failed to read workspace store: ${String(error)}`,
    )
  }

  return ensureValidWorkspaceDocument(document)
}

async function saveWorkspaceDocument(document: WorkspaceStoreDocument) {
  const filePath = resolveWorkspaceDataFile()

  try {
    await writeJsonFileAtomic({
      filePath,
      data: document,
    })
  } catch (error) {
    throw new WorkspaceRepositoryError(
      "STORE_WRITE_ERROR",
      `Failed to write workspace store: ${String(error)}`,
    )
  }
}

async function resolveWorkspacePath(rawPath: string) {
  const trimmedPath = rawPath.trim()
  if (!trimmedPath) {
    throw new WorkspaceRepositoryError(
      "INVALID_PATH",
      "Workspace path cannot be empty.",
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
    throw new WorkspaceRepositoryError(
      "PATH_NOT_FOUND",
      `Workspace path does not exist: ${absolutePath}. ${String(error)}`,
    )
  }

  let pathStats
  try {
    pathStats = await stat(canonicalPath)
  } catch (error) {
    throw new WorkspaceRepositoryError(
      "PATH_NOT_FOUND",
      `Failed to stat workspace path: ${canonicalPath}. ${String(error)}`,
    )
  }

  if (!pathStats.isDirectory()) {
    throw new WorkspaceRepositoryError(
      "NOT_A_DIRECTORY",
      "Workspace path must point to a directory.",
    )
  }

  return canonicalPath
}

function buildWorkspaceName(canonicalPath: string, explicitName?: string) {
  const trimmedName = explicitName?.trim()
  if (trimmedName) {
    return trimmedName
  }

  const basename = path.basename(canonicalPath)
  return basename || canonicalPath
}

function workspaceComparator(first: Workspace, second: Workspace) {
  return second.createdAt.localeCompare(first.createdAt)
}

function buildWorkspaceId() {
  return randomUUID()
}

export class WorkspaceRepositoryError extends Error {
  code: WorkspaceErrorCode

  constructor(code: WorkspaceErrorCode, message: string) {
    super(message)
    this.name = "WorkspaceRepositoryError"
    this.code = code
  }
}

export async function listWorkspaces(): Promise<Workspace[]> {
  const document = await loadWorkspaceDocument()
  return [...document.workspaces].sort(workspaceComparator)
}

export async function getWorkspaceById(id: string): Promise<Workspace | null> {
  const trimmedId = id.trim()
  if (!trimmedId) {
    return null
  }

  const document = await loadWorkspaceDocument()
  return (
    document.workspaces.find((workspace) => workspace.id === trimmedId) ?? null
  )
}

export async function addWorkspace(input: {
  path: string
  name?: string
}): Promise<Workspace> {
  const canonicalPath = await resolveWorkspacePath(input.path)
  const filePath = resolveWorkspaceDataFile()

  return withFileLock(filePath, async () => {
    const document = await loadWorkspaceDocument()
    const existingWorkspace = document.workspaces.find(
      (workspace) => workspace.path === canonicalPath,
    )

    if (existingWorkspace) {
      throw new WorkspaceRepositoryError(
        "DUPLICATE_PATH",
        `Workspace path already exists: ${canonicalPath}`,
      )
    }

    const workspace: Workspace = {
      id: buildWorkspaceId(),
      name: buildWorkspaceName(canonicalPath, input.name),
      path: canonicalPath,
      createdAt: nowIsoString(),
    }

    const nextDocument: WorkspaceStoreDocument = {
      ...document,
      updatedAt: nowIsoString(),
      workspaces: [...document.workspaces, workspace],
    }

    await saveWorkspaceDocument(nextDocument)
    return workspace
  })
}

export async function deleteWorkspace(id: string): Promise<boolean> {
  if (!id.trim()) {
    throw new WorkspaceRepositoryError(
      "INVALID_WORKSPACE_ID",
      "Workspace id cannot be empty.",
    )
  }

  const filePath = resolveWorkspaceDataFile()

  return withFileLock(filePath, async () => {
    const document = await loadWorkspaceDocument()
    const nextWorkspaces = document.workspaces.filter(
      (workspace) => workspace.id !== id,
    )

    if (nextWorkspaces.length === document.workspaces.length) {
      return false
    }

    const nextDocument: WorkspaceStoreDocument = {
      ...document,
      updatedAt: nowIsoString(),
      workspaces: nextWorkspaces,
    }

    await saveWorkspaceDocument(nextDocument)
    return true
  })
}
