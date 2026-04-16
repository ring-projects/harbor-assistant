import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

import { readCurrentAuthSession } from "@/modules/auth/server/read-current-auth-session"

export const Route = createFileRoute("/workspaces")({
  beforeLoad: async ({ location }) => {
    const session = await readCurrentAuthSession()

    if (session.authenticated) {
      return
    }

    throw redirect({
      to: "/login",
      search: {
        redirect: location.href,
      },
      replace: true,
    })
  },
  component: WorkspacesLayout,
})

function WorkspacesLayout() {
  return <Outlet />
}
