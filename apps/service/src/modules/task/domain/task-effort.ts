export const TASK_EFFORT_VALUES = [
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
] as const

export type TaskEffort = (typeof TASK_EFFORT_VALUES)[number]

export function isTaskEffort(value: unknown): value is TaskEffort {
  return (
    typeof value === "string" &&
    (TASK_EFFORT_VALUES as readonly string[]).includes(value)
  )
}

export function normalizeNullableTaskEffort(
  value: string | null | undefined,
): TaskEffort | null {
  const normalized = value?.trim().toLowerCase()
  return isTaskEffort(normalized) ? normalized : null
}
