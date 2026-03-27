import { redirect } from "next/navigation"

import { readProjects } from "@/modules/projects/api"

export default async function Home() {
  const projects = await readProjects()
  const firstProject = projects[0]

  if (!firstProject) {
    redirect("/projects/new")
  }

  redirect(`/${encodeURIComponent(firstProject.id)}`)
}
