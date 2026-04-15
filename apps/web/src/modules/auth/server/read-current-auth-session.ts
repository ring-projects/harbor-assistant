import { createServerFn, getGlobalStartContext } from "@tanstack/react-start"

import { readServerAuthSession } from "./auth-proxy"

export const readCurrentAuthSession = createServerFn({
  method: "GET",
}).handler(async () => {
  const startContext = getGlobalStartContext() as
    | { request?: Request }
    | undefined

  if (!startContext?.request) {
    throw new Error("Request context is unavailable for auth session lookup.")
  }

  return readServerAuthSession(startContext.request)
})
