type SameSitePolicy = "Lax" | "Strict" | "None"

type CookieOptions = {
  httpOnly?: boolean
  secure?: boolean
  sameSite?: SameSitePolicy
  path?: string
  maxAge?: number
  expires?: Date
}

export function parseCookieHeader(header: string | undefined) {
  const cookies = new Map<string, string>()

  if (!header) {
    return cookies
  }

  for (const part of header.split(";")) {
    const trimmed = part.trim()
    if (!trimmed) {
      continue
    }

    const separatorIndex = trimmed.indexOf("=")
    if (separatorIndex <= 0) {
      continue
    }

    const name = trimmed.slice(0, separatorIndex).trim()
    const rawValue = trimmed.slice(separatorIndex + 1).trim()

    if (!name) {
      continue
    }

    try {
      cookies.set(name, decodeURIComponent(rawValue))
    } catch {
      cookies.set(name, rawValue)
    }
  }

  return cookies
}

export function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions = {},
) {
  const segments = [`${name}=${encodeURIComponent(value)}`]

  segments.push(`Path=${options.path ?? "/"}`)

  if (options.httpOnly !== false) {
    segments.push("HttpOnly")
  }

  if (options.secure) {
    segments.push("Secure")
  }

  segments.push(`SameSite=${options.sameSite ?? "Lax"}`)

  if (typeof options.maxAge === "number") {
    segments.push(`Max-Age=${Math.max(0, Math.trunc(options.maxAge))}`)
  }

  if (options.expires) {
    segments.push(`Expires=${options.expires.toUTCString()}`)
  }

  return segments.join("; ")
}

export function expireCookie(name: string, options: Omit<CookieOptions, "expires" | "maxAge"> = {}) {
  return serializeCookie(name, "", {
    ...options,
    maxAge: 0,
    expires: new Date(0),
  })
}
