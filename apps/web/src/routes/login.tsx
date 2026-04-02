import { createFileRoute } from "@tanstack/react-router"

import { LoginPage } from "@/modules/auth"

type LoginSearch = {
  redirect?: string
  error?: string
}

export const Route = createFileRoute("/login")({
  validateSearch: (search): LoginSearch => ({
    redirect:
      typeof search.redirect === "string" ? search.redirect : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
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
