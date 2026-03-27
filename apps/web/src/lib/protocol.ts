export type JsonRecord = Record<string, unknown>

type IsoDateFallback = string | (() => string)
type OptionalIsoDateFallback = string | null | (() => string | null)

function resolveIsoDateFallback(fallback: IsoDateFallback): string {
  return typeof fallback === "function" ? fallback() : fallback
}

function resolveOptionalIsoDateFallback(
  fallback: OptionalIsoDateFallback,
): string | null {
  return typeof fallback === "function" ? fallback() : fallback
}

export function asRecord(
  value: unknown,
  options?: { allowArrays?: boolean },
): JsonRecord | null {
  if (typeof value !== "object" || value === null) {
    return null
  }

  if (!options?.allowArrays && Array.isArray(value)) {
    return null
  }

  return value as JsonRecord
}

export async function parseJsonResponse<T extends JsonRecord = JsonRecord>(
  response: Response,
): Promise<T | null> {
  return (await response.json().catch(() => null)) as T | null
}

export function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

export function toStringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : ""
}

export function toBooleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null
}

export function toIntegerOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isInteger(parsed)) {
      return parsed
    }
  }

  return null
}

export function pickString(
  source: JsonRecord | null | undefined,
  ...keys: string[]
): string | null {
  if (!source) {
    return null
  }

  for (const key of keys) {
    const value = toStringOrNull(source[key])
    if (value) {
      return value
    }
  }

  return null
}

export function toIsoDateString(
  value: unknown,
  fallback: IsoDateFallback = () => new Date().toISOString(),
): string {
  if (typeof value !== "string") {
    return resolveIsoDateFallback(fallback)
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return resolveIsoDateFallback(fallback)
  }

  return parsed.toISOString()
}

export function toOptionalIsoDateString(
  value: unknown,
  fallback: OptionalIsoDateFallback = () => new Date().toISOString(),
): string | null {
  if (value === null || value === undefined || value === "") {
    return null
  }

  if (typeof value !== "string") {
    return resolveOptionalIsoDateFallback(fallback)
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return resolveOptionalIsoDateFallback(fallback)
  }

  return parsed.toISOString()
}
