import { lstat } from "node:fs/promises"
import path from "node:path"

import type { DocumentWorkspacePolicy } from "../application/document-workspace-policy"
import { createDocumentError } from "../errors"

export function createNodeDocumentWorkspacePolicy(): DocumentWorkspacePolicy {
  return {
    async getWorkspaceRoot(projectRootPath: string) {
      const rootPath = normalizeProjectRoot(projectRootPath)
      return path.join(rootPath, ".harbor")
    },
    async resolveDocumentPath(input) {
      const rootPath = normalizeProjectRoot(input.projectRootPath)
      const workspaceRootPath = path.join(rootPath, ".harbor")
      const absolutePath = path.resolve(rootPath, input.path)

      assertWithinWorkspace(workspaceRootPath, absolutePath)
      await assertNoSymlinkedSegments(workspaceRootPath, absolutePath)

      return {
        workspaceRootPath,
        absolutePath,
      }
    },
  }
}

function normalizeProjectRoot(projectRootPath: string) {
  const normalized = projectRootPath.trim()
  if (!normalized) {
    throw createDocumentError().invalidInput("projectRootPath is required")
  }

  return path.resolve(normalized)
}

function assertWithinWorkspace(
  workspaceRootPath: string,
  absolutePath: string,
) {
  const relative = path.relative(workspaceRootPath, absolutePath)
  if (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  ) {
    return
  }

  throw createDocumentError().invalidPath(
    "document path must stay within project .harbor workspace",
  )
}

async function assertNoSymlinkedSegments(
  workspaceRootPath: string,
  absolutePath: string,
) {
  const relative = path.relative(workspaceRootPath, absolutePath)
  const segments = relative ? relative.split(path.sep) : []

  let current = workspaceRootPath
  await assertPathIsNotSymlink(current)

  for (const segment of segments) {
    current = path.join(current, segment)
    await assertPathIsNotSymlink(current)
  }
}

async function assertPathIsNotSymlink(targetPath: string) {
  try {
    const metadata = await lstat(targetPath)
    if (metadata.isSymbolicLink()) {
      throw createDocumentError().invalidPath(
        "document path cannot traverse symlinked workspace entries",
      )
    }
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return
    }

    throw error
  }
}
