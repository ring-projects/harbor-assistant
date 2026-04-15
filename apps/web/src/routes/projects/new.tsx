import { createFileRoute, redirect } from "@tanstack/react-router"

import { LandingPage } from "@/modules/landing-page"
import { readCurrentAuthSession } from "@/modules/auth/server/read-current-auth-session"

export const Route = createFileRoute("/projects/new")({
  beforeLoad: async () => {
    const session = await readCurrentAuthSession()

    if (session.authenticated) {
      return
    }

    throw redirect({
      to: "/login",
      search: {
        redirect: "/projects/new",
      },
      replace: true,
    })
  },
  component: NewProjectPage,
})

function NewProjectPage() {
  return <LandingPage />
}
