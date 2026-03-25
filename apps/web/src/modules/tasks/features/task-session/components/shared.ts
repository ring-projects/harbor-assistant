"use client"

import { formatTimeShort } from "@/lib/date-time"
import type { TaskStatus } from "@/modules/tasks/contracts"

export const CHAT_STATUS_META: Record<
  TaskStatus,
  {
    label: string
    badgeClassName: string
  }
> = {
  queued: {
    label: "Queued",
    badgeClassName: "border-slate-200 bg-slate-100 text-slate-700",
  },
  running: {
    label: "Running",
    badgeClassName: "border-blue-200 bg-blue-100 text-blue-700",
  },
  completed: {
    label: "Completed",
    badgeClassName: "border-emerald-200 bg-emerald-100 text-emerald-700",
  },
  failed: {
    label: "Failed",
    badgeClassName: "border-rose-200 bg-rose-100 text-rose-700",
  },
  cancelled: {
    label: "Cancelled",
    badgeClassName: "border-amber-200 bg-amber-100 text-amber-700",
  },
}

export function formatChatTimestamp(value: string | null) {
  return formatTimeShort(value)
}
