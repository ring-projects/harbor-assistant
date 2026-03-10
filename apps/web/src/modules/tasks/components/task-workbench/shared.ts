"use client"

import type {
  TaskStatus,
  TaskTimelineItem,
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

export function truncateTaskId(taskId: string) {
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

export function getTimelineLabel(item: TaskTimelineItem) {
  if (item.kind === "message") {
    return item.role ?? "message"
  }

  if (item.kind === "status" && item.status) {
    return item.status
  }

  return item.kind
}

export function getTimelineContent(item: TaskTimelineItem) {
  if (item.content?.trim()) {
    return item.content
  }

  if (item.payload?.trim()) {
    return item.payload
  }

  return "(empty)"
}

export function getTimelineItemClassName(item: TaskTimelineItem) {
  if (item.kind === "message") {
    if (item.role === "assistant") {
      return "border-blue-200 bg-blue-50/70"
    }

    if (item.role === "user") {
      return "border-emerald-200 bg-emerald-50/70"
    }

    return "border-slate-200 bg-slate-50/70"
  }

  if (item.kind === "stdout") {
    return "border-sky-200 bg-sky-50/70"
  }

  if (item.kind === "stderr" || item.kind === "error") {
    return "border-rose-200 bg-rose-50/70"
  }

  if (item.kind === "status") {
    return "border-violet-200 bg-violet-50/70"
  }

  if (item.kind === "summary") {
    return "border-emerald-200 bg-emerald-50/60"
  }

  return "border-slate-200 bg-slate-50/70"
}
