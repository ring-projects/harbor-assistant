export type GitHubAppInstallEvent = {
  status: "success" | "error"
  returnTo: string | null
  code: string | null
  message: string | null
}

const GITHUB_APP_INSTALL_CHANNEL_NAME = "harbor:github-app-install"
const GITHUB_APP_INSTALL_STORAGE_KEY = "harbor:github-app-install:last-event"

function isGitHubAppInstallStatus(
  value: unknown,
): value is GitHubAppInstallEvent["status"] {
  return value === "success" || value === "error"
}

export function isGitHubAppInstallEvent(
  value: unknown,
): value is GitHubAppInstallEvent {
  if (!value || typeof value !== "object") {
    return false
  }

  const source = value as Record<string, unknown>
  return (
    isGitHubAppInstallStatus(source.status) &&
    (typeof source.returnTo === "string" || source.returnTo === null) &&
    (typeof source.code === "string" || source.code === null) &&
    (typeof source.message === "string" || source.message === null)
  )
}

export function getCurrentGitHubAppInstallReturnTo() {
  if (typeof window === "undefined") {
    return null
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

export function publishGitHubAppInstallEvent(event: GitHubAppInstallEvent) {
  if (typeof window === "undefined") {
    return
  }

  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel(GITHUB_APP_INSTALL_CHANNEL_NAME)
    channel.postMessage(event)
    channel.close()
  }

  try {
    window.localStorage.setItem(
      GITHUB_APP_INSTALL_STORAGE_KEY,
      JSON.stringify({
        ...event,
        publishedAt: Date.now(),
      }),
    )
  } catch {
    return
  }
}

export function subscribeToGitHubAppInstallEvents(
  onEvent: (event: GitHubAppInstallEvent) => void,
) {
  if (typeof window === "undefined") {
    return () => undefined
  }

  let channel: BroadcastChannel | null = null

  if ("BroadcastChannel" in window) {
    channel = new BroadcastChannel(GITHUB_APP_INSTALL_CHANNEL_NAME)
    channel.onmessage = (messageEvent) => {
      if (isGitHubAppInstallEvent(messageEvent.data)) {
        onEvent(messageEvent.data)
      }
    }
  }

  function handleStorage(event: StorageEvent) {
    if (event.key !== GITHUB_APP_INSTALL_STORAGE_KEY || !event.newValue) {
      return
    }

    try {
      const parsed = JSON.parse(event.newValue) as Record<string, unknown>
      const installEvent = {
        status: parsed.status,
        returnTo: parsed.returnTo,
        code: parsed.code,
        message: parsed.message,
      }

      if (isGitHubAppInstallEvent(installEvent)) {
        onEvent(installEvent)
      }
    } catch {
      return
    }
  }

  window.addEventListener("storage", handleStorage)

  return () => {
    window.removeEventListener("storage", handleStorage)
    channel?.close()
  }
}

export function formatGitHubAppInstallEventMessage(
  event: GitHubAppInstallEvent,
) {
  if (event.status === "success") {
    return "GitHub App access updated."
  }

  if (event.code && event.message) {
    return `${event.code}: ${event.message}`
  }

  return event.message ?? "GitHub App authorization failed."
}
