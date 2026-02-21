import { readFile, readdir, realpath, stat } from "node:fs/promises"
import path from "node:path"

import type {
  DocumentServiceErrorCode,
  ListMarkdownDocumentsResult,
  MarkdownDocument,
  ReadMarkdownDocumentResult,
} from "@/services/documents/types"
import {
  isMarkdownFileName,
  isPathInsideRoot,
  normalizeRelativeDocumentPath,
  toUnixPath,
} from "@/services/documents/utils"

const DEFAULT_MAX_FILES = 2000
const DEFAULT_MAX_FILE_BYTES = 2 * 1024 * 1024
const IGNORED_DIRECTORY_NAMES = new Set([
  ".git",
  ".next",
  ".turbo",
  "node_modules",
  "dist",
  "build",
  "out",
])

export class DocumentServiceError extends Error {
  code: DocumentServiceErrorCode

  constructor(code: DocumentServiceErrorCode, message: string) {
    super(message)
    this.name = "DocumentServiceError"
    this.code = code
  }
}

async function resolveCanonicalRoot(rootPath: string) {
  const canonicalRoot = await realpath(rootPath).catch((error) => {
    throw new DocumentServiceError(
      "ROOT_NOT_FOUND",
      `Document root does not exist: ${rootPath}. ${String(error)}`
    )
  })

  const rootStats = await stat(canonicalRoot).catch((error) => {
    throw new DocumentServiceError(
      "ROOT_NOT_FOUND",
      `Failed to stat document root: ${canonicalRoot}. ${String(error)}`
    )
  })

  if (!rootStats.isDirectory()) {
    throw new DocumentServiceError(
      "ROOT_NOT_DIRECTORY",
      "Document root must be a directory."
    )
  }

  return canonicalRoot
}

export async function listMarkdownDocuments(args: {
  rootPath: string
  maxFiles?: number
}): Promise<ListMarkdownDocumentsResult> {
  const maxFiles =
    typeof args.maxFiles === "number" && Number.isFinite(args.maxFiles)
      ? Math.max(1, Math.trunc(args.maxFiles))
      : DEFAULT_MAX_FILES

  const canonicalRoot = await resolveCanonicalRoot(args.rootPath)

  const documents: MarkdownDocument[] = []
  const directoriesToVisit: string[] = [canonicalRoot]
  let truncated = false

  while (directoriesToVisit.length > 0) {
    const currentDirectory = directoriesToVisit.pop()
    if (!currentDirectory) {
      continue
    }

    const entries = await readdir(currentDirectory, {
      withFileTypes: true,
    }).catch((error) => {
      throw new DocumentServiceError(
        "READ_ERROR",
        `Failed to read directory: ${currentDirectory}. ${String(error)}`
      )
    })

    const sortedEntries = entries.sort((first, second) =>
      first.name.localeCompare(second.name, "en")
    )

    for (const entry of sortedEntries) {
      const entryPath = path.join(currentDirectory, entry.name)

      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORY_NAMES.has(entry.name)) {
          continue
        }
        directoriesToVisit.push(entryPath)
        continue
      }

      if (!entry.isFile() || !isMarkdownFileName(entry.name)) {
        continue
      }

      const relativePath = toUnixPath(path.relative(canonicalRoot, entryPath))
      documents.push({
        name: entry.name,
        relativePath,
        absolutePath: entryPath,
      })

      if (documents.length >= maxFiles) {
        truncated = true
        break
      }
    }

    if (truncated) {
      break
    }
  }

  documents.sort((first, second) =>
    first.relativePath.localeCompare(second.relativePath, "en")
  )

  return {
    rootPath: canonicalRoot,
    truncated,
    documents,
  }
}

export async function readMarkdownDocument(args: {
  rootPath: string
  relativePath: string
  maxBytes?: number
}): Promise<ReadMarkdownDocumentResult> {
  const canonicalRoot = await resolveCanonicalRoot(args.rootPath)
  const normalizedRelativePath = normalizeRelativeDocumentPath(args.relativePath)
  if (!normalizedRelativePath) {
    throw new DocumentServiceError(
      "INVALID_DOCUMENT_PATH",
      "Document path cannot be empty."
    )
  }

  if (!isMarkdownFileName(normalizedRelativePath)) {
    throw new DocumentServiceError(
      "NOT_MARKDOWN_FILE",
      "Only markdown files are supported for preview."
    )
  }

  const absolutePath = path.resolve(canonicalRoot, normalizedRelativePath)
  if (!isPathInsideRoot(canonicalRoot, absolutePath)) {
    throw new DocumentServiceError(
      "INVALID_DOCUMENT_PATH",
      "Requested markdown path is outside workspace root."
    )
  }

  const fileStats = await stat(absolutePath).catch((error) => {
    throw new DocumentServiceError(
      "DOCUMENT_NOT_FOUND",
      `Markdown file not found: ${absolutePath}. ${String(error)}`
    )
  })

  if (!fileStats.isFile()) {
    throw new DocumentServiceError(
      "DOCUMENT_NOT_FILE",
      "Requested path is not a file."
    )
  }

  const maxBytes =
    typeof args.maxBytes === "number" && Number.isFinite(args.maxBytes)
      ? Math.max(1, Math.trunc(args.maxBytes))
      : DEFAULT_MAX_FILE_BYTES
  if (fileStats.size > maxBytes) {
    throw new DocumentServiceError(
      "READ_ERROR",
      `Markdown file is too large to preview (> ${maxBytes} bytes).`
    )
  }

  const content = await readFile(absolutePath, "utf8").catch((error) => {
    throw new DocumentServiceError(
      "READ_ERROR",
      `Failed to read markdown file: ${absolutePath}. ${String(error)}`
    )
  })

  return {
    rootPath: canonicalRoot,
    relativePath: toUnixPath(path.relative(canonicalRoot, absolutePath)),
    absolutePath,
    content,
  }
}
