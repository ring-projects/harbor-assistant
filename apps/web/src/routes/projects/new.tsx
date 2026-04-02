import { createFileRoute } from "@tanstack/react-router"

import { AuthGate } from "@/modules/auth"
import { LandingPage } from "@/modules/landing-page"

export const Route = createFileRoute("/projects/new")({
  component: NewProjectPage,
})

function NewProjectPage() {
  return (
    <AuthGate>
      <LandingPage />
    </AuthGate>
  )
}
