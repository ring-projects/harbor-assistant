import { createFileRoute, Outlet } from "@tanstack/react-router"

import { AuthGate } from "@/modules/auth"

export const Route = createFileRoute("/_project-shell")({
  component: ProjectShellLayout,
})

function ProjectShellLayout() {
  return (
    <AuthGate>
      <div className="bg-background h-svh overflow-hidden">
        <Outlet />
      </div>
    </AuthGate>
  )
}
