import { createFileRoute, redirect } from "@tanstack/react-router"

import { HomeRouteRedirect } from "@/modules/auth"
import { readCurrentAuthSession } from "@/modules/auth/server/read-current-auth-session"

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const session = await readCurrentAuthSession()

    if (session.authenticated) {
      return
    }

    throw redirect({
      to: "/login",
      replace: true,
    })
  },
  component: HomeRedirect,
})

function HomeRedirect() {
  return <HomeRouteRedirect />
}
