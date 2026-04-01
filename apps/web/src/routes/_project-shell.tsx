import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/_project-shell")({
  component: ProjectShellLayout,
})

function ProjectShellLayout() {
  return (
    <div className="bg-background h-svh overflow-hidden">
      <Outlet />
    </div>
  )
}
