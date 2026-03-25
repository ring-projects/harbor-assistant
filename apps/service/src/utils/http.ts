export function normalizePositiveInteger(
  value: number | undefined,
  fallback: number,
) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback
  }

  return Math.trunc(value)
}

export function normalizeNonNegativeInteger(
  value: number | undefined,
  fallback: number,
) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return fallback
  }

  return Math.trunc(value)
}

export function normalizeOptionalLimit(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined
  }

  return Math.trunc(value)
}
