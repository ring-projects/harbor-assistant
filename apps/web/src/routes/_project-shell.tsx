import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

import { readCurrentAuthSession } from "@/modules/auth/server/read-current-auth-session"

export const Route = createFileRoute("/_project-shell")({
  beforeLoad: async ({ location }) => {
    const session = await readCurrentAuthSession()

    if (session.authenticated) {
      return
    }

    const redirectTo = location.href

    throw redirect({
      to: "/login",
      search: {
        redirect: redirectTo,
      },
      replace: true,
    })
  },
  component: ProjectShellLayout,
})

function ProjectShellLayout() {
  return (
    <div className="bg-background h-svh overflow-hidden">
      <Outlet />
    </div>
  )
}
