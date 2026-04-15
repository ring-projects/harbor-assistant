"use client"

import { useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

import { useReadProjectsQuery } from "@/modules/projects"
import { AuthShell } from "./auth-shell"

export function HomeRouteRedirect() {
  const navigate = useNavigate()
  const projectsQuery = useReadProjectsQuery()

  if (projectsQuery.isError) {
    throw projectsQuery.error
  }

  useEffect(() => {
    if (projectsQuery.isLoading || !projectsQuery.data) {
      return
    }

    const firstProject = projectsQuery.data[0]

    if (!firstProject) {
      void navigate({
        to: "/projects/new",
        replace: true,
      })
      return
    }

    void navigate({
      to: "/$projectId",
      params: {
        projectId: firstProject.id,
      },
      replace: true,
    })
  }, [
    navigate,
    projectsQuery.data,
    projectsQuery.isLoading,
  ])

  if (projectsQuery.isLoading) {
    return (
      <AuthShell
        title="Loading Harbor"
        description="Preparing your Harbor workspace."
      />
    )
  }

  return null
}
