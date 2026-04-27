import { createFileRoute, redirect } from "@tanstack/react-router"

import { LoginPage } from "@/modules/auth"
import { normalizeAuthRedirectTarget } from "@/modules/auth/lib/redirect-target"
import { readCurrentAuthSession } from "@/modules/auth/server/read-current-auth-session"

type LoginSearch = {
  redirect?: string
  error?: string
}

export const Route = createFileRoute("/login")({
  validateSearch: (search): LoginSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  beforeLoad: async ({ search }) => {
    const session = await readCurrentAuthSession()

    if (!session.authenticated) {
      return
    }

    const redirectTarget = normalizeAuthRedirectTarget(search.redirect)

    throw redirect({
      href: redirectTarget ?? "/",
      replace: true,
    })
  },
  component: LoginRoutePage,
})

function LoginRoutePage() {
  const search = Route.useSearch()

  return (
    <LoginPage
      redirectTo={search.redirect ?? null}
      errorCode={search.error ?? null}
    />
  )
}
