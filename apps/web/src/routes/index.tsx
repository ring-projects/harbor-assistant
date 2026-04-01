import { createFileRoute, redirect } from "@tanstack/react-router"

import { readProjects } from "@/modules/projects/api"

export const Route = createFileRoute("/")({
  loader: async () => {
    const projects = await readProjects()
    const firstProject = projects[0]

    if (!firstProject) {
      throw redirect({
        to: "/projects/new",
      })
    }

    throw redirect({
      to: "/$projectId",
      params: {
        projectId: firstProject.id,
      },
    })
  },
  component: HomeRedirect,
})

function HomeRedirect() {
  return null
}
