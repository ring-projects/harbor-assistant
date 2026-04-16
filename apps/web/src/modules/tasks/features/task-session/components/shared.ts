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
