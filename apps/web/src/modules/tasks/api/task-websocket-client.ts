function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value
}

export function getTaskSocketBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_EXECUTOR_SOCKET_BASE_URL?.trim()
  if (configured) {
    return trimTrailingSlash(configured)
  }

  if (typeof window === "undefined") {
    return "http://127.0.0.1:3400"
  }

  const { protocol, hostname, host } = window.location

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return `${protocol}//${hostname}:3400`
  }

  return `${protocol}//${host}`
}
