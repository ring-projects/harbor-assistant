function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value
}

export function getHarborApiBaseUrl() {
  const publicValue =
    import.meta.env.VITE_HARBOR_API_BASE_URL?.trim() ??
    process.env.VITE_HARBOR_API_BASE_URL?.trim()
  if (publicValue) {
    return trimTrailingSlash(publicValue)
  }

  throw new Error(
    "VITE_HARBOR_API_BASE_URL is required to connect the web app to the Harbor API.",
  )
}

export function buildHarborApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${getHarborApiBaseUrl()}${normalizedPath}`
}

export function harborApiFetch(path: string, init?: RequestInit) {
  return fetch(buildHarborApiUrl(path), {
    ...init,
    credentials: "include",
  })
}
