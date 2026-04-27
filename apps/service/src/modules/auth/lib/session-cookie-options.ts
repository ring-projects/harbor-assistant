import type { ServiceConfig } from "../../../config"

function resolveSessionCookieDomain(config: ServiceConfig) {
  const value = config.sessionCookieDomain?.trim()
  if (!value) {
    return undefined
  }

  return value.replace(/^\.+/, "")
}

export function buildSessionCookieOptions(config: ServiceConfig) {
  return {
    secure: config.isProduction,
    sameSite: "lax" as const,
    path: "/",
    domain: resolveSessionCookieDomain(config),
  }
}
