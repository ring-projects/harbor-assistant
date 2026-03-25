function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value
}

export function getExecutorApiBaseUrl() {
  const publicValue = process.env.NEXT_PUBLIC_EXECUTOR_API_BASE_URL?.trim()
  if (publicValue) {
    return trimTrailingSlash(publicValue)
  }

  throw new Error(
    "NEXT_PUBLIC_EXECUTOR_API_BASE_URL is required to connect the web app to the executor service.",
  )
}

export function buildExecutorApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${getExecutorApiBaseUrl()}${normalizedPath}`
}
