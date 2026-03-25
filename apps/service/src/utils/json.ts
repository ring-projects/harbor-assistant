import { asRecord } from "./value"

export function safeParseJson(value: string | null): unknown {
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export function parseJsonObject(value: string): Record<string, unknown> {
  const parsed = safeParseJson(value)
  return asRecord(parsed) ?? {}
}

export function serializeJsonObject(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}
