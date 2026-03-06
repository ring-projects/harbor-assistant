import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { LAST_PROJECT_COOKIE_NAME } from "@/constants"
import { listProjectsFromService } from "@/lib/projects-service"
import { LandingPage } from "@/modules/landing-page"

export const dynamic = "force-dynamic"

export default async function Home() {
  const projects = await listProjectsFromService()
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
