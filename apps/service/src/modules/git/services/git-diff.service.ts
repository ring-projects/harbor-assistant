import { readFile } from "node:fs/promises"
import path from "node:path"

import { runGitCommand } from "../repositories"
import type {
  GitDiff,
  GitDiffFile,
  GitDiffFileStatus,
  GitDiffHunk,
} from "../types"

const MAX_FILE_BYTES = 200_000

type GitStatusEntry = {
  code: string
  path: string
  originalPath: string | null
}

function normalizePath(value: string) {
  return value.replaceAll("\\", "/")
}

async function verifyGitRepository(projectPath: string) {
  const result = await runGitCommand(["rev-parse", "--show-toplevel"], projectPath)
  return result.exitCode === 0
}

async function hasHeadCommit(projectPath: string) {
  const result = await runGitCommand(["rev-parse", "--verify", "HEAD"], projectPath)
  return result.exitCode === 0
}

async function readTrackedPatch(projectPath: string) {
  const headExists = await hasHeadCommit(projectPath)
  const args = headExists
    ? ["diff", "-U1", "--no-color", "--no-ext-diff", "--find-renames", "--find-copies", "--binary", "HEAD", "--"]
    : ["diff", "-U1", "--no-color", "--no-ext-diff", "--find-renames", "--find-copies", "--binary", "--cached", "--root", "--"]

  const result = await runGitCommand(args, projectPath)
  if (result.exitCode !== 0 && result.exitCode !== 1) {
    throw new Error(result.stderr || "Failed to read git diff.")
  }

  return result.stdout
}

async function readGitStatus(projectPath: string) {
  const result = await runGitCommand(
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    projectPath,
  )
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || "Failed to read git status.")
  }

  const entries: GitStatusEntry[] = []
  const chunks = result.stdout.split("\0").filter((value) => value.length > 0)

  for (let index = 0; index < chunks.length; index += 1) {
    const entry = chunks[index]
    if (entry.length < 4) {
      continue
    }

    const code = entry.slice(0, 2)
    const filePath = normalizePath(entry.slice(3))

    if (code.startsWith("R") || code.startsWith("C")) {
      const originalPath = chunks[index + 1] ? normalizePath(chunks[index + 1]) : null
      entries.push({
        code,
        path: filePath,
        originalPath,
      })
      index += 1
      continue
    }

    entries.push({
      code,
      path: filePath,
      originalPath: null,
    })
  }

  return entries
}

function isBinaryBuffer(buffer: Uint8Array) {
  for (const byte of buffer) {
    if (byte === 0) {
      return true
    }
  }

  return false
}

function splitLines(content: string) {
  return content.split(/\r?\n/)
}

function createSyntheticAddedPatch(filePath: string, content: string) {
  const lines = splitLines(content)
  const normalizedLines =
    lines.length > 0 && lines[lines.length - 1] === "" ? lines.slice(0, -1) : lines

  const header = [
    `diff --git a/${filePath} b/${filePath}`,
    "new file mode 100644",
    "--- /dev/null",
    `+++ b/${filePath}`,
    `@@ -0,0 +1,${normalizedLines.length} @@`,
  ]

  const body = normalizedLines.map((line) => `+${line}`)
  return [...header, ...body].join("\n")
}

async function buildSyntheticUntrackedPatches(
  projectPath: string,
  statusEntries: GitStatusEntry[],
) {
  const patches: string[] = []

  for (const entry of statusEntries) {
    if (entry.code !== "??") {
      continue
    }

    const absolutePath = path.join(projectPath, entry.path)
    const buffer = await readFile(absolutePath)
    if (buffer.byteLength > MAX_FILE_BYTES || isBinaryBuffer(buffer)) {
      patches.push(
        [
          `diff --git a/${entry.path} b/${entry.path}`,
          "new file mode 100644",
          "Binary files /dev/null and b/" + entry.path + " differ",
        ].join("\n"),
      )
      continue
    }

    patches.push(createSyntheticAddedPatch(entry.path, buffer.toString("utf8")))
  }

  return patches
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
}) {
  return {
    path: file.path,
    oldPath: file.oldPath,
    status: file.isBinary && file.status === "unknown" ? "binary" : file.status,
    isBinary: file.isBinary,
    isTooLarge: file.patchLines.length > 4_000 || file.patchLines.join("\n").length > 120_000,
    additions: file.additions,
    deletions: file.deletions,
    patch: file.patchLines.join("\n"),
    hunks: file.hunks,
  } satisfies GitDiffFile
}

export function parseUnifiedDiff(patchText: string): GitDiffFile[] {
  if (!patchText.trim()) {
    return []
  }

  const lines = patchText.split(/\r?\n/)
  const files: GitDiffFile[] = []
  let currentFile:
    | {
        path: string
        oldPath: string | null
        status: GitDiffFileStatus
        isBinary: boolean
        patchLines: string[]
        hunks: GitDiffHunk[]
        additions: number
        deletions: number
      }
    | null = null
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

    if (line === "GIT binary patch") {
      currentFile.isBinary = true
      if (currentFile.status === "modified") {
        currentFile.status = "binary"
      }
      continue
    }

    if (line.startsWith("--- ")) {
      const source = line.slice(4).trim()
      if (source === "/dev/null") {
        currentFile.oldPath = null
      } else if (source.startsWith("a/")) {
        currentFile.oldPath = source.slice(2)
      }
      continue
    }

    if (line.startsWith("+++ ")) {
      const target = line.slice(4).trim()
      if (target === "/dev/null") {
        currentFile.path = currentFile.oldPath ?? currentFile.path
      } else if (target.startsWith("b/")) {
        currentFile.path = target.slice(2)
      }
      continue
    }

    if (line.startsWith("@@ ")) {
      flushHunk()
      currentHunk = {
        header: line,
        lines: [],
      }
      const parsed = parseHunkHeader(line)
      oldLine = parsed?.oldLine ?? 0
      newLine = parsed?.newLine ?? 0
      continue
    }

    if (!currentHunk) {
      continue
    }

    if (line.startsWith("+")) {
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

    if (line.startsWith("-")) {
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

  return files.filter((file) => file.path.length > 0)
}

export async function readProjectGitDiff(args: {
  projectId: string
  projectPath: string
}): Promise<GitDiff> {
  const isGitRepository = await verifyGitRepository(args.projectPath)
  if (!isGitRepository) {
    throw new Error("Project path is not a git repository.")
  }

  const trackedPatch = await readTrackedPatch(args.projectPath)
  const statusEntries = await readGitStatus(args.projectPath)
  const untrackedPatches = await buildSyntheticUntrackedPatches(
    args.projectPath,
    statusEntries,
  )

  const files = parseUnifiedDiff([trackedPatch, ...untrackedPatches].filter(Boolean).join("\n"))

  return {
    projectId: args.projectId,
    files,
  }
}
