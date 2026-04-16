import { createFileRoute, redirect } from "@tanstack/react-router"

import { readCurrentAuthSession } from "@/modules/auth/server/read-current-auth-session"

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const session = await readCurrentAuthSession()

    if (!session.authenticated) {
      throw redirect({
        to: "/login",
        replace: true,
      })
    }

    throw redirect({
      to: "/workspaces",
      replace: true,
    })
  },
  component: HomeRedirectPlaceholder,
})

function HomeRedirectPlaceholder() {
  return null
}
