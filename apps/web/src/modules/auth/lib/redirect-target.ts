function isSafeInternalRedirect(value: string) {
  return value.startsWith("/") && !value.startsWith("//")
}

export function normalizeAuthRedirectTarget(
  value: string | null | undefined,
): string | null {
  const candidate = value?.trim()

  if (!candidate || !isSafeInternalRedirect(candidate)) {
    return null
  }

  if (candidate === "/login" || candidate.startsWith("/login?")) {
    return null
  }

  return candidate
}
