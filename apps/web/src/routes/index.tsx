import { createFileRoute } from "@tanstack/react-router"

import { HomeRouteRedirect } from "@/modules/auth"

export const Route = createFileRoute("/")({
  component: HomeRedirect,
})

function HomeRedirect() {
  return <HomeRouteRedirect />
}
