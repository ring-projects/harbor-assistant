import type { TaskEffort, TaskStatus } from "@/modules/tasks/contracts"

export const STATUS_META: Record<
  TaskStatus,
  {
    label: string
    badgeClassName: string
  }
> = {
  queued: {
    label: "Queued",
    badgeClassName: "border-border bg-secondary/40 text-muted-foreground",
  },
  running: {
    label: "Running",
    badgeClassName: "border-info/25 bg-surface-info text-info",
  },
  completed: {
    label: "Completed",
    badgeClassName: "border-success/25 bg-surface-success text-success",
  },
  failed: {
    label: "Failed",
    badgeClassName: "border-destructive/25 bg-surface-danger text-destructive",
  },
  cancelled: {
    label: "Cancelled",
    badgeClassName: "border-warning/25 bg-surface-warning text-warning",
  },
  archived: {
    label: "Archived",
    badgeClassName: "border-border bg-secondary/40 text-muted-foreground",
  },
}

export function getPromptSummary(prompt: string) {
  const summary = prompt.split("\n").find((line) => line.trim().length > 0) ?? prompt
  if (!summary) {
    return "(empty prompt)"
  }

  return summary.length > 100 ? `${summary.slice(0, 100)}...` : summary
}

export function getTaskDisplayTitle(args: {
  title: string | null | undefined
  prompt: string
}) {
  const normalizedTitle = args.title?.trim()
  if (normalizedTitle) {
    return normalizedTitle
  }

  return getPromptSummary(args.prompt)
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return "Failed to load. Please try again."
}

export function formatExecutorLabel(executor: string | null | undefined) {
  const normalized = executor?.trim().toLowerCase()

  if (!normalized) {
    return "-"
  }

  if (
    normalized === "claude-code" ||
    normalized === "claude" ||
    normalized === "claudecode" ||
    normalized === "claudcode"
  ) {
    return "Claude Code"
  }

  if (normalized === "codex") {
    return "Codex"
  }

  return executor ?? "-"
}

export function formatExecutionModeLabel(executionMode: string | null | undefined) {
  switch (executionMode?.trim().toLowerCase()) {
    case "safe":
      return "Safe"
    case "connected":
      return "Normal"
    case "full-access":
      return "Full Access"
    default:
      return "-"
  }
}

export function formatModelSummary(model: string | null | undefined) {
  return model?.trim() || "Runtime Default"
}

export function formatEffortLabel(effort: TaskEffort | null | undefined) {
  switch (effort) {
    case "minimal":
      return "Minimal"
    case "low":
      return "Low"
    case "medium":
      return "Medium"
    case "high":
      return "High"
    case "xhigh":
      return "X-High"
    default:
      return "Provider Default"
  }
}
