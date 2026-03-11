function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value
}

function toWebSocketOrigin(httpOrigin: string) {
  if (httpOrigin.startsWith("https://")) {
    return `wss://${httpOrigin.slice("https://".length)}`
  }

  if (httpOrigin.startsWith("http://")) {
    return `ws://${httpOrigin.slice("http://".length)}`
  }

  return httpOrigin
}

export function getTaskWebSocketUrl() {
  const configured = process.env.NEXT_PUBLIC_EXECUTOR_WS_BASE_URL?.trim()
  if (configured) {
    return trimTrailingSlash(configured)
  }

  if (typeof window === "undefined") {
    return "ws://127.0.0.1:3400/v1/ws/tasks"
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
  const { hostname, host } = window.location

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return `${protocol}//${hostname}:3400/v1/ws/tasks`
  }

  return `${toWebSocketOrigin(`${window.location.protocol}//${host}`)}/v1/ws/tasks`
}
