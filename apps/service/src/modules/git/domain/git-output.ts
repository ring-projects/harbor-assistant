import type {
  GitBranch,
  GitDiffFile,
  GitDiffFileStatus,
  GitDiffHunk,
} from "../types"
import type { GitCommandResult } from "../application/git-repository"

export type GitCommandFailureKind =
  | "git-not-available"
  | "repository-not-found"
  | "branch-not-found"
  | "branch-already-exists"
  | "worktree-dirty"
  | "unknown"

function normalizeCommandText(result: GitCommandResult) {
  return `${result.stderr}\n${result.stdout}`.trim()
}

export function classifyGitCommandFailure(
  result: GitCommandResult,
): GitCommandFailureKind {
  const text = normalizeCommandText(result)

  if (
    result.exitCode === null &&
    /spawn git enoent|git: command not found|enoent/i.test(text)
  ) {
    return "git-not-available"
  }

  if (/not a git repository/i.test(text)) {
    return "repository-not-found"
  }

  if (
    /pathspec .* did not match any file|invalid reference|not a valid object name|unknown revision/i.test(
      text,
    )
  ) {
    return "branch-not-found"
  }

  if (/already exists/i.test(text)) {
    return "branch-already-exists"
  }

  if (
    /please commit your changes or stash them|would be overwritten by checkout/i.test(
      text,
    )
  ) {
    return "worktree-dirty"
  }

  return "unknown"
}

export function parseCurrentBranch(stdout: string) {
  const value = stdout.trim()
  return value.length > 0 ? value : null
}

export function parseStatusDirty(stdout: string) {
  return stdout
    .split(/\r?\n/)
    .slice(1)
    .some((line) => line.trim().length > 0)
}

export function parseBranchList(
  stdout: string,
  currentBranch: string | null,
): GitBranch[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((name) => ({
      name,
      current: name === currentBranch,
    }))
}

function parseHunkHeader(header: string) {
  const match = header.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/)
  if (!match) {
    return null
  }

  return {
    oldLine: Number(match[1]),
    newLine: Number(match[3]),
  }
}

function finalizeFile(file: {
  path: string
  oldPath: string | null
  status: GitDiffFileStatus
  isBinary: boolean
  patchLines: string[]
  hunks: GitDiffHunk[]
  additions: number
  deletions: number
}): GitDiffFile {
  const patch = file.patchLines.join("\n")
  return {
    path: file.path,
    oldPath: file.oldPath,
    status: file.isBinary && file.status === "unknown" ? "binary" : file.status,
    isBinary: file.isBinary,
    isTooLarge: patch.length > 120_000 || file.patchLines.length > 4_000,
    additions: file.additions,
    deletions: file.deletions,
    patch,
    hunks: file.hunks,
  }
}

export function parseUnifiedDiff(patchText: string): GitDiffFile[] {
  if (!patchText.trim()) {
    return []
  }

  const lines = patchText.split(/\r?\n/)
  const files: GitDiffFile[] = []
  let currentFile: {
    path: string
    oldPath: string | null
    status: GitDiffFileStatus
    isBinary: boolean
    patchLines: string[]
    hunks: GitDiffHunk[]
    additions: number
    deletions: number
  } | null = null
  let currentHunk: GitDiffHunk | null = null
  let oldLine = 0
  let newLine = 0

  function flushHunk() {
    if (currentFile && currentHunk) {
      currentFile.hunks.push(currentHunk)
    }
    currentHunk = null
  }

  function flushFile() {
    flushHunk()
    if (currentFile) {
      files.push(finalizeFile(currentFile))
    }
    currentFile = null
  }

  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      flushFile()
      const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/)
      currentFile = {
        path: match?.[2] ?? "",
        oldPath: match?.[1] ?? null,
        status: "modified",
        isBinary: false,
        patchLines: [line],
        hunks: [],
        additions: 0,
        deletions: 0,
      }
      continue
    }

    if (!currentFile) {
      continue
    }

    currentFile.patchLines.push(line)

    if (line.startsWith("new file mode ")) {
      currentFile.status = "added"
      continue
    }

    if (line.startsWith("deleted file mode ")) {
      currentFile.status = "deleted"
      continue
    }

    if (line.startsWith("rename from ")) {
      currentFile.status = "renamed"
      currentFile.oldPath = line.slice("rename from ".length).trim()
      continue
    }

    if (line.startsWith("rename to ")) {
      currentFile.path = line.slice("rename to ".length).trim()
      continue
    }

    if (line.startsWith("copy from ")) {
      currentFile.status = "copied"
      currentFile.oldPath = line.slice("copy from ".length).trim()
      continue
    }

    if (line.startsWith("copy to ")) {
      currentFile.path = line.slice("copy to ".length).trim()
      continue
    }

    if (line.startsWith("Binary files ")) {
      const binaryMatch = line.match(/^Binary files (.+) and (.+) differ$/)
      const source = binaryMatch?.[1] ?? null
      const target = binaryMatch?.[2] ?? null

      if (source === "/dev/null") {
        currentFile.oldPath = null
        currentFile.status = "added"
      } else if (typeof source === "string" && source.startsWith("a/")) {
        currentFile.oldPath = source.slice(2)
      }

      if (target === "/dev/null") {
        currentFile.status = "deleted"
      } else if (typeof target === "string" && target.startsWith("b/")) {
        currentFile.path = target.slice(2)
      }

      currentFile.isBinary = true
      if (currentFile.status === "modified") {
        currentFile.status = "binary"
      }
      continue
    }

    if (line.startsWith("@@ ")) {
      flushHunk()
      currentHunk = {
        header: line,
        lines: [],
      }

      const positions = parseHunkHeader(line)
      if (positions) {
        oldLine = positions.oldLine
        newLine = positions.newLine
      }
      continue
    }

    if (!currentHunk) {
      continue
    }

    if (line.startsWith("+") && !line.startsWith("+++")) {
      currentFile.additions += 1
      currentHunk.lines.push({
        type: "add",
        content: line.slice(1),
        oldLineNumber: null,
        newLineNumber: newLine,
      })
      newLine += 1
      continue
    }

    if (line.startsWith("-") && !line.startsWith("---")) {
      currentFile.deletions += 1
      currentHunk.lines.push({
        type: "delete",
        content: line.slice(1),
        oldLineNumber: oldLine,
        newLineNumber: null,
      })
      oldLine += 1
      continue
    }

    if (line.startsWith(" ")) {
      currentHunk.lines.push({
        type: "context",
        content: line.slice(1),
        oldLineNumber: oldLine,
        newLineNumber: newLine,
      })
      oldLine += 1
      newLine += 1
      continue
    }

    currentHunk.lines.push({
      type: "meta",
      content: line,
      oldLineNumber: null,
      newLineNumber: null,
    })
  }

  flushFile()
  return files
}
