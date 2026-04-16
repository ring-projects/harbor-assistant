import { createFileRoute, redirect } from "@tanstack/react-router"

import { readCurrentAuthSession } from "@/modules/auth/server/read-current-auth-session"

export const Route = createFileRoute("/projects/new")({
  beforeLoad: async () => {
    const session = await readCurrentAuthSession()

    if (session.authenticated) {
      return
    }

    throw redirect({
      to: "/workspaces",
      replace: true,
    })
  },
  component: LegacyProjectsNewRoutePage,
})

function LegacyProjectsNewRoutePage() {
  return null
}
