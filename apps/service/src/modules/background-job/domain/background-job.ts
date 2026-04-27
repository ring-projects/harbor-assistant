export type BackgroundJobType = "project_sandbox_template_bootstrap"

export type BackgroundJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"

export type BackgroundJobRecord = {
  id: string
  type: BackgroundJobType
  status: BackgroundJobStatus
  dedupeKey: string | null
  payload: Record<string, unknown>
  attemptCount: number
  maxAttempts: number
  runAfter: Date
  lockedAt: Date | null
  lockedBy: string | null
  lastError: string | null
  createdAt: Date
  updatedAt: Date
  completedAt: Date | null
}
