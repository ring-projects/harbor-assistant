import type { TaskStatus } from "@/modules/tasks/contracts"

export const STATUS_META: Record<
  TaskStatus,
  {
    label: string
    badgeClassName: string
  }
> = {
  queued: {
    label: "Queued",
    badgeClassName: "bg-slate-100 text-slate-700 border-slate-200",
  },
  running: {
    label: "Running",
    badgeClassName: "bg-blue-100 text-blue-700 border-blue-200",
  },
  completed: {
    label: "Completed",
    badgeClassName: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  failed: {
    label: "Failed",
    badgeClassName: "bg-rose-100 text-rose-700 border-rose-200",
  },
  cancelled: {
    label: "Cancelled",
    badgeClassName: "bg-amber-100 text-amber-700 border-amber-200",
  },
  archived: {
    label: "Archived",
    badgeClassName: "bg-amber-100 text-amber-700 border-amber-200",
  }
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
