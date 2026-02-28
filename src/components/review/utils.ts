import type {
  ReviewFile,
  ReviewListMode,
  ReviewSuggestionSeverity,
} from "@/services/review/types"

export type ReviewDirectoryNode = {
  name: string
  path: string
  files: ReviewFile[]
  directories: ReviewDirectoryNode[]
  fileCount: number
  hasSelectedFile: boolean
  defaultOpen: boolean
}

type ReviewStatusToken =
  | "NONE"
  | "UNTRACKED"
  | "ADDED"
  | "MODIFIED"
  | "DELETED"
  | "RENAMED"
  | "COPIED"
  | "UNMERGED"
  | "UNKNOWN"

export function normalizeReviewListMode(
  value: string | undefined,
): ReviewListMode {
  return value === "all" ? "all" : "changed"
}

export function getFileNameParts(relativePath: string) {
  const parts = relativePath.split("/").filter(Boolean)
  if (parts.length === 0) {
    return {
      name: relativePath,
      parent: "",
    }
  }

  const name = parts[parts.length - 1]
  const parent = parts.slice(0, -1).join("/")

  return {
    name,
    parent,
  }
}

export function getReviewStatusToken(status?: string): ReviewStatusToken {
  const normalized = (status ?? "").replace(/\s+/g, "").toUpperCase()
  if (!normalized) {
    return "NONE"
  }

  if (normalized.startsWith("??")) {
    return "UNTRACKED"
  }

  if (normalized.startsWith("A")) {
    return "ADDED"
  }

  if (normalized.startsWith("M")) {
    return "MODIFIED"
  }

  if (normalized.startsWith("D")) {
    return "DELETED"
  }

  if (normalized.startsWith("R")) {
    return "RENAMED"
  }

  if (normalized.startsWith("C")) {
    return "COPIED"
  }

  if (normalized.startsWith("U")) {
    return "UNMERGED"
  }

  return "UNKNOWN"
}

export function getReviewStatusLabel(status?: string) {
  const token = getReviewStatusToken(status)
  if (token === "NONE") {
    return "FILE"
  }
  if (token === "UNTRACKED") {
    return "NEW"
  }

  return token
}

export function getReviewStatusBadgeClass(status?: string) {
  const token = getReviewStatusToken(status)
  if (token === "MODIFIED") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700"
  }
  if (token === "ADDED" || token === "UNTRACKED") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
  }
  if (token === "DELETED") {
    return "border-rose-500/30 bg-rose-500/10 text-rose-700"
  }
  if (token === "RENAMED" || token === "COPIED") {
    return "border-sky-500/30 bg-sky-500/10 text-sky-700"
  }
  if (token === "UNMERGED") {
    return "border-orange-500/30 bg-orange-500/10 text-orange-700"
  }
  return "border-border bg-muted text-muted-foreground"
}

export function getReviewStatusDotClass(status?: string) {
  const token = getReviewStatusToken(status)
  if (token === "MODIFIED") {
    return "bg-amber-500"
  }
  if (token === "ADDED" || token === "UNTRACKED") {
    return "bg-emerald-500"
  }
  if (token === "DELETED") {
    return "bg-rose-500"
  }
  if (token === "RENAMED" || token === "COPIED") {
    return "bg-sky-500"
  }
  if (token === "UNMERGED") {
    return "bg-orange-500"
  }
  return "bg-muted-foreground/40"
}

export function getSuggestionBadgeClass(severity: ReviewSuggestionSeverity) {
  if (severity === "error") {
    return "border-rose-500/30 bg-rose-500/10 text-rose-700"
  }
  if (severity === "warning") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700"
  }
  return "border-sky-500/30 bg-sky-500/10 text-sky-700"
}

export function getSuggestionDotClass(severity: ReviewSuggestionSeverity) {
  if (severity === "error") {
    return "bg-rose-500"
  }
  if (severity === "warning") {
    return "bg-amber-500"
  }
  return "bg-sky-500"
}

export function buildReviewDirectoryTree(args: {
  files: ReviewFile[]
  selectedRelativePath: string | null
}) {
  type MutableDirectoryNode = {
    name: string
    path: string
    files: ReviewFile[]
    directories: Map<string, MutableDirectoryNode>
    fileCount: number
  }

  function createNode(name: string, path: string): MutableDirectoryNode {
    return {
      name,
      path,
      files: [],
      directories: new Map<string, MutableDirectoryNode>(),
      fileCount: 0,
    }
  }

  function sortFiles(files: ReviewFile[]) {
    return [...files].sort((first, second) =>
      first.relativePath.localeCompare(second.relativePath, "en"),
    )
  }

  function finalizeDirectoryNode(
    node: MutableDirectoryNode,
    selectedRelativePath: string | null,
  ): ReviewDirectoryNode {
    const files = sortFiles(node.files)
    const directories = Array.from(node.directories.values())
      .map((directoryNode) =>
        finalizeDirectoryNode(directoryNode, selectedRelativePath),
      )
      .sort((first, second) => first.path.localeCompare(second.path, "en"))

    const hasSelectedFile =
      files.some((file) => file.relativePath === selectedRelativePath) ||
      directories.some((directoryNode) => directoryNode.hasSelectedFile)

    return {
      name: node.name,
      path: node.path,
      files,
      directories,
      fileCount: node.fileCount,
      hasSelectedFile,
      defaultOpen: node.path === "" || hasSelectedFile,
    }
  }

  const rootNode = createNode("project root", "")

  for (const file of args.files) {
    const parts = file.relativePath.split("/").filter(Boolean)
    const directoryParts = parts.slice(0, -1)

    let cursor = rootNode
    cursor.fileCount += 1

    for (let index = 0; index < directoryParts.length; index += 1) {
      const part = directoryParts[index]
      const childPath = cursor.path ? `${cursor.path}/${part}` : part
      const existing = cursor.directories.get(part)
      if (existing) {
        cursor = existing
        cursor.fileCount += 1
        continue
      }

      const created = createNode(part, childPath)
      cursor.directories.set(part, created)
      cursor = created
      cursor.fileCount += 1
    }

    cursor.files.push(file)
  }

  return finalizeDirectoryNode(rootNode, args.selectedRelativePath)
}

export function getReviewStatusStats(files: ReviewFile[]) {
  return files.reduce(
    (stats, file) => {
      const status = getReviewStatusToken(file.status)
      if (status === "ADDED" || status === "UNTRACKED") {
        stats.added += 1
      } else if (status === "MODIFIED") {
        stats.modified += 1
      } else if (status === "DELETED") {
        stats.deleted += 1
      }
      return stats
    },
    {
      added: 0,
      modified: 0,
      deleted: 0,
    },
  )
}
