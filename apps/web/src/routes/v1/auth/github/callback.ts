import { createFileRoute } from "@tanstack/react-router"

import { proxyExecutorAuthRequest } from "@/modules/auth/server/auth-proxy"

export const Route = createFileRoute("/v1/auth/github/callback")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        proxyExecutorAuthRequest(request, "/v1/auth/github/callback"),
    },
  },
})
