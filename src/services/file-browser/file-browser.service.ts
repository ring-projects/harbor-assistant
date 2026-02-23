import { lstat, readdir } from "node:fs/promises"
import path from "node:path"

import type {
  BrowseDirectoryInput,
  BrowseDirectoryResult,
  FileBrowserErrorCode,
  FileTreeNode,
} from "@/services/file-browser/types"
import {
  isInsideRoot,
  normalizeBrowseDirectoryInput,
  toRelativePath,
} from "@/services/file-browser/utils"
import { getAppConfig } from "@/utils/yaml-config"

const DEFAULT_DEPTH = 2
const DEFAULT_MAX_ENTRIES_PER_DIRECTORY = 200
const DEFAULT_MAX_NODES = 5000
const MAX_DEPTH = 8
const MAX_ENTRIES_PER_DIRECTORY = 1000

const DEFAULT_IGNORED_NAMES = new Set([".git", "node_modules", ".next"])

function resolveRootDirectory() {
  return path.resolve(getAppConfig().fileBrowser.rootDirectory)
}

export class FileBrowserServiceError extends Error {
  code: FileBrowserErrorCode

  constructor(code: FileBrowserErrorCode, message: string) {
    super(message)
    this.name = "FileBrowserServiceError"
    this.code = code
  }
}

type BuildContext = {
  nodesVisited: number
  maxNodes: number
  truncated: boolean
}

async function buildTreeNode(args: {
  absolutePath: string
  rootPath: string
  depth: number
  includeHidden: boolean
  maxEntriesPerDirectory: number
  context: BuildContext
}): Promise<FileTreeNode> {
  const {
    absolutePath,
    rootPath,
    depth,
    includeHidden,
    maxEntriesPerDirectory,
    context,
  } = args

  context.nodesVisited += 1

  const stats = await lstat(absolutePath)
  const baseNode: FileTreeNode = {
    name: path.basename(absolutePath) || ".",
    path: toRelativePath(rootPath, absolutePath),
    mtime: stats.mtime.toISOString(),
    type: stats.isDirectory()
      ? "directory"
      : stats.isFile()
        ? "file"
        : stats.isSymbolicLink()
          ? "symlink"
          : "other",
  }

  if (stats.isFile()) {
    baseNode.size = stats.size
  }

  if (!stats.isDirectory() || depth <= 1) {
    return baseNode
  }

  let entries
  try {
    entries = await readdir(absolutePath, { withFileTypes: true })
  } catch (error) {
    throw new FileBrowserServiceError(
      "READ_ERROR",
      `Failed to read directory: ${absolutePath}. ${String(error)}`,
    )
  }

  const filtered = entries
    .filter((entry) => {
      if (!includeHidden && entry.name.startsWith(".")) {
        return false
      }

      if (DEFAULT_IGNORED_NAMES.has(entry.name)) {
        return false
      }

      return true
    })
    .sort((first, second) => {
      if (first.isDirectory() && !second.isDirectory()) {
        return -1
      }
      if (!first.isDirectory() && second.isDirectory()) {
        return 1
      }
      return first.name.localeCompare(second.name, "en")
    })

  const limitedEntries = filtered.slice(0, maxEntriesPerDirectory)
  const children: FileTreeNode[] = []

  for (const entry of limitedEntries) {
    if (context.nodesVisited >= context.maxNodes) {
      context.truncated = true
      break
    }

    const childAbsolutePath = path.join(absolutePath, entry.name)
    children.push(
      await buildTreeNode({
        absolutePath: childAbsolutePath,
        rootPath,
        depth: depth - 1,
        includeHidden,
        maxEntriesPerDirectory,
        context,
      }),
    )
  }

  return {
    ...baseNode,
    children,
    truncated: filtered.length > limitedEntries.length || context.truncated,
  }
}

export async function browseDirectory(
  input: BrowseDirectoryInput = {},
): Promise<BrowseDirectoryResult> {
  const rootPath = resolveRootDirectory()
  const normalized = normalizeBrowseDirectoryInput(input, {
    defaultDepth: DEFAULT_DEPTH,
    maxDepth: MAX_DEPTH,
    defaultMaxEntriesPerDirectory: DEFAULT_MAX_ENTRIES_PER_DIRECTORY,
    maxEntriesPerDirectory: MAX_ENTRIES_PER_DIRECTORY,
    defaultMaxNodes: DEFAULT_MAX_NODES,
    maxNodes: DEFAULT_MAX_NODES,
  })
  const absoluteTargetPath = path.resolve(rootPath, normalized.targetPath)

  if (!isInsideRoot(rootPath, absoluteTargetPath)) {
    throw new FileBrowserServiceError(
      "PATH_OUT_OF_ROOT",
      "Requested path is outside the allowed root directory.",
    )
  }

  let stats
  try {
    stats = await lstat(absoluteTargetPath)
  } catch (error) {
    throw new FileBrowserServiceError(
      "PATH_NOT_FOUND",
      `Requested path does not exist: ${absoluteTargetPath}. ${String(error)}`,
    )
  }

  if (!stats.isDirectory()) {
    throw new FileBrowserServiceError(
      "NOT_A_DIRECTORY",
      "Requested path is not a directory.",
    )
  }

  const context: BuildContext = {
    nodesVisited: 0,
    maxNodes: normalized.maxNodes,
    truncated: false,
  }

  const tree = await buildTreeNode({
    absolutePath: absoluteTargetPath,
    rootPath,
    depth: normalized.depth,
    includeHidden: normalized.includeHidden,
    maxEntriesPerDirectory: normalized.maxEntriesPerDirectory,
    context,
  })

  return {
    tree,
    meta: {
      depth: normalized.depth,
      truncated: Boolean(tree.truncated || context.truncated),
      nodesVisited: context.nodesVisited,
      root: rootPath,
    },
  }
}
