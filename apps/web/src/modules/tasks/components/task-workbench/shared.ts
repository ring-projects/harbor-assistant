"use client"

import type {
  TaskStatus,
} from "@/modules/tasks/contracts"

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
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return "-"
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return "-"
  }

  return parsed.toLocaleString("zh-CN", {
    hour12: false,
  })
}

export function truncateTaskId(taskId: string | null | undefined) {
  if (!taskId) {
    return "-"
  }

  if (taskId.length <= 14) {
    return taskId
  }

  return `${taskId.slice(0, 8)}...${taskId.slice(-4)}`
}

export function getPromptSummary(prompt: string) {
  const summary = prompt.split("\n").find((line) => line.trim().length > 0) ?? prompt
  if (!summary) {
    return "(empty prompt)"
  }

  return summary.length > 100 ? `${summary.slice(0, 100)}...` : summary
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return "加载失败，请重试。"
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
      return "Connected"
    case "full-access":
      return "Full Access"
    case "custom":
      return "Custom"
    default:
      return "-"
  }
}

export function extractDiffBlocks(text: string) {
  if (!text.trim()) {
    return []
  }

  const blocks: string[] = []

  const fencedDiff = /```diff\s*([\s\S]*?)```/g
  for (const match of text.matchAll(fencedDiff)) {
    const content = match[1]?.trim()
    if (content) {
      blocks.push(content)
    }
  }

  const lines = text.split(/\r?\n/)
  let currentBlock: string[] = []

  function flushCurrentBlock() {
    if (currentBlock.length === 0) {
      return
    }

    const merged = currentBlock.join("\n").trim()
    if (merged.length > 0) {
      blocks.push(merged)
    }

    currentBlock = []
  }

  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      flushCurrentBlock()
      currentBlock.push(line)
      continue
    }

    if (currentBlock.length > 0) {
      currentBlock.push(line)
    }
  }

  flushCurrentBlock()

  return blocks
}

export function extractChangedFiles(diffBlocks: string[]) {
  const files = new Set<string>()

  for (const block of diffBlocks) {
    for (const line of block.split("\n")) {
      if (line.startsWith("diff --git ")) {
        const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/)
        if (match?.[2]) {
          files.add(match[2].trim())
        }
        continue
      }

      if (line.startsWith("+++ b/")) {
        files.add(line.slice("+++ b/".length).trim())
      }
    }
  }

  return Array.from(files)
}
