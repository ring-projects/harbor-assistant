import { execFile } from "node:child_process"
import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"

import type {
  ListReviewFilesResult,
  ReadReviewFileResult,
  ReviewFile,
  ReviewListMode,
  ReviewSuggestionsResult,
  ReviewServiceErrorCode,
} from "@/services/review/types"

const execFileAsync = promisify(execFile)
const DEFAULT_MAX_FILES = 3000
const DEFAULT_MAX_PREVIEW_BYTES = 2 * 1024 * 1024
const DEFAULT_MAX_SUGGESTIONS = 120
const DEFAULT_MAX_LINE_LENGTH = 120
const IGNORED_DIRECTORY_NAMES = new Set([
  ".git",
  ".next",
  "node_modules",
  "dist",
  "build",
  "out",
])

function toUnixPath(value: string) {
  return value.split(path.sep).join("/")
}

function normalizeRelativePath(rawPath: string) {
  return toUnixPath(rawPath.trim()).replace(/^\/+/, "")
}

function isPathInsideRoot(rootPath: string, absolutePath: string) {
  const relative = path.relative(rootPath, absolutePath)
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

function isMarkdownPath(filePath: string) {
  const lowered = filePath.toLowerCase()
  return lowered.endsWith(".md") || lowered.endsWith(".mdx")
}

function unquoteGitPath(value: string) {
  const trimmed = value.trim()
  if (!(trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed
  }

  return trimmed
    .slice(1, -1)
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
}

function parseGitStatusLine(line: string) {
  if (!line.trim()) {
    return null
  }

  const status = line.slice(0, 2)
  const payload = line.slice(3).trim()
  if (!payload) {
    return null
  }

  const pathPart = payload.includes(" -> ")
    ? payload.split(" -> ").at(-1) ?? payload
    : payload
  const relativePath = normalizeRelativePath(unquoteGitPath(pathPart))
  if (!relativePath) {
    return null
  }

  return {
    status: status.trim() || "??",
    relativePath,
  }
}

async function isGitRepository(workspacePath: string) {
  try {
    await execFileAsync("git", ["-C", workspacePath, "rev-parse", "--is-inside-work-tree"])
    return true
  } catch {
    return false
  }
}

async function listChangedFilesFromGit(args: {
  workspacePath: string
  maxFiles: number
}) {
  const { stdout } = await execFileAsync("git", [
    "-C",
    args.workspacePath,
    "status",
    "--porcelain",
  ])
  const lines = stdout.split(/\r?\n/).filter((line) => line.trim().length > 0)
  const map = new Map<string, ReviewFile>()

  for (const line of lines) {
    const parsed = parseGitStatusLine(line)
    if (!parsed) {
      continue
    }
    const absolutePath = path.resolve(args.workspacePath, parsed.relativePath)
    if (!isPathInsideRoot(args.workspacePath, absolutePath)) {
      continue
    }

    const fileStats = await stat(absolutePath).catch(() => null)
    if (!fileStats?.isFile()) {
      continue
    }

    map.set(parsed.relativePath, {
      relativePath: parsed.relativePath,
      absolutePath,
      status: parsed.status,
    })

    if (map.size >= args.maxFiles) {
      break
    }
  }

  const files = Array.from(map.values()).sort((first, second) =>
    first.relativePath.localeCompare(second.relativePath, "en")
  )
  return {
    files,
    truncated: map.size >= args.maxFiles,
  }
}

async function listAllFilesRecursively(args: {
  workspacePath: string
  maxFiles: number
}) {
  const queue: string[] = [args.workspacePath]
  const files: ReviewFile[] = []
  let truncated = false

  while (queue.length > 0) {
    const current = queue.pop()
    if (!current) {
      continue
    }

    const entries = await readdir(current, { withFileTypes: true }).catch(() => null)
    if (!entries) {
      continue
    }

    const sortedEntries = entries.sort((first, second) =>
      first.name.localeCompare(second.name, "en")
    )

    for (const entry of sortedEntries) {
      const absolutePath = path.join(current, entry.name)
      if (!isPathInsideRoot(args.workspacePath, absolutePath)) {
        continue
      }

      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORY_NAMES.has(entry.name)) {
          continue
        }
        queue.push(absolutePath)
        continue
      }

      if (!entry.isFile()) {
        continue
      }

      files.push({
        relativePath: toUnixPath(path.relative(args.workspacePath, absolutePath)),
        absolutePath,
      })
      if (files.length >= args.maxFiles) {
        truncated = true
        break
      }
    }

    if (truncated) {
      break
    }
  }

  files.sort((first, second) =>
    first.relativePath.localeCompare(second.relativePath, "en")
  )
  return {
    files,
    truncated,
  }
}

export class ReviewServiceError extends Error {
  code: ReviewServiceErrorCode

  constructor(code: ReviewServiceErrorCode, message: string) {
    super(message)
    this.name = "ReviewServiceError"
    this.code = code
  }
}

export async function listReviewFiles(args: {
  workspacePath: string
  mode: ReviewListMode
  maxFiles?: number
}): Promise<ListReviewFilesResult> {
  const maxFiles =
    typeof args.maxFiles === "number" && Number.isFinite(args.maxFiles)
      ? Math.max(1, Math.trunc(args.maxFiles))
      : DEFAULT_MAX_FILES
  const mode = args.mode
  const gitRepo = await isGitRepository(args.workspacePath)

  if (mode === "changed") {
    if (!gitRepo) {
      return {
        mode,
        workspacePath: args.workspacePath,
        isGitRepository: false,
        truncated: false,
        files: [],
      }
    }

    const changed = await listChangedFilesFromGit({
      workspacePath: args.workspacePath,
      maxFiles,
    })
    return {
      mode,
      workspacePath: args.workspacePath,
      isGitRepository: true,
      truncated: changed.truncated,
      files: changed.files,
    }
  }

  const allFiles = await listAllFilesRecursively({
    workspacePath: args.workspacePath,
    maxFiles,
  })
  return {
    mode,
    workspacePath: args.workspacePath,
    isGitRepository: gitRepo,
    truncated: allFiles.truncated,
    files: allFiles.files,
  }
}

export async function readReviewFile(args: {
  workspacePath: string
  relativePath: string
  maxBytes?: number
}): Promise<ReadReviewFileResult> {
  const normalizedRelativePath = normalizeRelativePath(args.relativePath)
  if (!normalizedRelativePath) {
    throw new ReviewServiceError("INVALID_PATH", "File path cannot be empty.")
  }

  const absolutePath = path.resolve(args.workspacePath, normalizedRelativePath)
  if (!isPathInsideRoot(args.workspacePath, absolutePath)) {
    throw new ReviewServiceError(
      "PATH_OUTSIDE_WORKSPACE",
      "Requested file is outside workspace root."
    )
  }

  const fileStats = await stat(absolutePath).catch(() => null)
  if (!fileStats) {
    throw new ReviewServiceError("NOT_FOUND", `File not found: ${absolutePath}`)
  }
  if (!fileStats.isFile()) {
    throw new ReviewServiceError("NOT_A_FILE", "Requested path is not a file.")
  }

  const maxBytes =
    typeof args.maxBytes === "number" && Number.isFinite(args.maxBytes)
      ? Math.max(1, Math.trunc(args.maxBytes))
      : DEFAULT_MAX_PREVIEW_BYTES
  if (fileStats.size > maxBytes) {
    throw new ReviewServiceError(
      "READ_ERROR",
      `File is too large to preview (> ${maxBytes} bytes).`
    )
  }

  const buffer = await readFile(absolutePath).catch((error) => {
    throw new ReviewServiceError(
      "READ_ERROR",
      `Failed to read file: ${absolutePath}. ${String(error)}`
    )
  })

  const isText = !buffer.includes(0)
  const content = isText ? buffer.toString("utf8") : null
  return {
    relativePath: normalizedRelativePath,
    absolutePath,
    isText,
    isMarkdown: isMarkdownPath(normalizedRelativePath),
    content,
  }
}

export function buildReviewSuggestions(args: {
  file: ReadReviewFileResult
  maxSuggestions?: number
}): ReviewSuggestionsResult {
  const maxSuggestions =
    typeof args.maxSuggestions === "number" && Number.isFinite(args.maxSuggestions)
      ? Math.max(1, Math.trunc(args.maxSuggestions))
      : DEFAULT_MAX_SUGGESTIONS
  const suggestions: ReviewSuggestionsResult["suggestions"] = []
  const file = args.file

  function pushSuggestion(suggestion: ReviewSuggestionsResult["suggestions"][number]) {
    if (suggestions.length >= maxSuggestions) {
      return
    }
    suggestions.push(suggestion)
  }

  if (!file.isText || !file.content) {
    return {
      relativePath: file.relativePath,
      suggestions,
    }
  }

  const lines = file.content.split(/\r?\n/)
  const normalizedPath = file.relativePath.toLowerCase()
  let hasMarkdownHeading = false

  for (let index = 0; index < lines.length; index += 1) {
    if (suggestions.length >= maxSuggestions) {
      break
    }

    const line = lines[index]
    const lineNumber = index + 1
    const trimmed = line.trim()

    if (!hasMarkdownHeading && /^#\s+\S/.test(trimmed)) {
      hasMarkdownHeading = true
    }

    if (/\s+$/.test(line) && trimmed.length > 0) {
      pushSuggestion({
        id: `trailing-whitespace-${lineNumber}`,
        ruleId: "style.trailing-whitespace",
        title: "Trailing whitespace",
        message: "This line ends with extra whitespace.",
        severity: "warning",
        line: lineNumber,
      })
    }

    if (line.includes("\t")) {
      pushSuggestion({
        id: `tab-character-${lineNumber}`,
        ruleId: "style.tab-character",
        title: "Tab indentation found",
        message: "Prefer spaces to keep indentation style consistent.",
        severity: "info",
        line: lineNumber,
      })
    }

    if (line.length > DEFAULT_MAX_LINE_LENGTH) {
      pushSuggestion({
        id: `line-too-long-${lineNumber}`,
        ruleId: "readability.line-length",
        title: "Long line",
        message: `Line length is ${line.length}. Consider wrapping around ${DEFAULT_MAX_LINE_LENGTH} chars.`,
        severity: "warning",
        line: lineNumber,
      })
    }

    if (/\bdebugger\b/.test(line)) {
      pushSuggestion({
        id: `debugger-${lineNumber}`,
        ruleId: "runtime.debugger",
        title: "Debugger statement",
        message: "Remove debugger before committing.",
        severity: "error",
        line: lineNumber,
      })
    }

    if (
      (normalizedPath.endsWith(".js") ||
        normalizedPath.endsWith(".jsx") ||
        normalizedPath.endsWith(".ts") ||
        normalizedPath.endsWith(".tsx")) &&
      /\bconsole\.log\s*\(/.test(line)
    ) {
      pushSuggestion({
        id: `console-log-${lineNumber}`,
        ruleId: "runtime.console-log",
        title: "Console log statement",
        message: "Avoid committing console.log unless it is intentional diagnostics.",
        severity: "info",
        line: lineNumber,
      })
    }

    if (/\b(TODO|FIXME)\b/i.test(line)) {
      pushSuggestion({
        id: `todo-fixme-${lineNumber}`,
        ruleId: "maintenance.todo",
        title: "TODO / FIXME marker",
        message: "Confirm this note is still valid for the current change.",
        severity: "info",
        line: lineNumber,
      })
    }
  }

  if (file.isMarkdown && !hasMarkdownHeading && suggestions.length < maxSuggestions) {
    pushSuggestion({
      id: "markdown-heading-missing",
      ruleId: "markdown.heading",
      title: "Missing top-level heading",
      message: "Consider adding a top-level heading for document readability.",
      severity: "info",
      line: 1,
    })
  }

  return {
    relativePath: file.relativePath,
    suggestions,
  }
}
