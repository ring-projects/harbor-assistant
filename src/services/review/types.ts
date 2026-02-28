export type ReviewListMode = "changed" | "all"

export type ReviewFile = {
  relativePath: string
  absolutePath: string
  status?: string
}

export type ListReviewFilesResult = {
  mode: ReviewListMode
  projectPath: string
  isGitRepository: boolean
  truncated: boolean
  files: ReviewFile[]
}

export type ReadReviewFileResult = {
  relativePath: string
  absolutePath: string
  isText: boolean
  isMarkdown: boolean
  content: string | null
}

export type ReviewSuggestionSeverity = "info" | "warning" | "error"

export type ReviewSuggestion = {
  id: string
  ruleId: string
  title: string
  message: string
  severity: ReviewSuggestionSeverity
  line?: number
}

export type ReviewSuggestionsResult = {
  relativePath: string
  suggestions: ReviewSuggestion[]
}

export type ReviewServiceErrorCode =
  | "INVALID_PATH"
  | "PATH_OUTSIDE_PROJECT"
  | "NOT_FOUND"
  | "NOT_A_FILE"
  | "READ_ERROR"
