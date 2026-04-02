function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value
}

export function getExecutorApiBaseUrl() {
  const publicValue =
    import.meta.env.VITE_EXECUTOR_API_BASE_URL?.trim() ??
    process.env.VITE_EXECUTOR_API_BASE_URL?.trim() ??
    process.env.NEXT_PUBLIC_EXECUTOR_API_BASE_URL?.trim()
  if (publicValue) {
    return trimTrailingSlash(publicValue)
  }

  throw new Error(
    "VITE_EXECUTOR_API_BASE_URL is required to connect the web app to the executor service.",
  )
}

export function buildExecutorApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${getExecutorApiBaseUrl()}${normalizedPath}`
}

export function executorApiFetch(path: string, init?: RequestInit) {
  return fetch(buildExecutorApiUrl(path), {
    ...init,
    credentials: "include",
  })
}
