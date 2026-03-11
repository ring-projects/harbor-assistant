export type GitRepositorySummary = {
  projectId: string
  repositoryRoot: string
  currentBranch: string | null
  detached: boolean
  dirty: boolean
}

export type GitBranch = {
  name: string
  current: boolean
}

export type GitDiffFileStatus =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "binary"
  | "unknown"

export type GitDiffLineType = "context" | "add" | "delete" | "meta"

export type GitDiffLine = {
  type: GitDiffLineType
  content: string
  oldLineNumber: number | null
  newLineNumber: number | null
}

export type GitDiffHunk = {
  header: string
  lines: GitDiffLine[]
}

export type GitDiffFile = {
  path: string
  oldPath: string | null
  status: GitDiffFileStatus
  isBinary: boolean
  isTooLarge: boolean
  additions: number
  deletions: number
  patch: string
  hunks: GitDiffHunk[]
}

export type GitDiff = {
  projectId: string
  files: GitDiffFile[]
}

export type GitBranchList = {
  projectId: string
  currentBranch: string | null
  branches: GitBranch[]
}
