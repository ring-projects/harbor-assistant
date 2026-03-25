export function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

export function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

export function toNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

export function toBoolean(value: unknown) {
  return value === true
}

export function toDateOrNull(value: string | null | undefined): Date | null {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

export function toDateOrNow(value: string) {
  return toDateOrNull(value) ?? new Date()
}
