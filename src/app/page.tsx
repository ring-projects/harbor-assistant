import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { LandingPage } from "@/modules/landing-page"
import { listProjects } from "@/services/project/project.repository"

const LAST_PROJECT_COOKIE_NAME = "harbor_last_project_id"

export const dynamic = "force-dynamic"

export default async function Home() {
  const projects = await listProjects()
  if (projects.length === 0) {
    return <LandingPage />
  }

  const cookieStore = await cookies()
  const lastProjectId = cookieStore.get(LAST_PROJECT_COOKIE_NAME)?.value
  const targetProjectId = lastProjectId
    ? (projects.find((project) => project.id === lastProjectId)?.id ??
      projects[0].id)
    : projects[0].id

  redirect(`/${targetProjectId}`)
}
