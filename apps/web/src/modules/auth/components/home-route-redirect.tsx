"use client"

import { useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

import { useReadProjectsQuery } from "@/modules/projects"
import { AuthShell } from "./auth-shell"
import { useAuthSessionQuery } from "../hooks"

export function HomeRouteRedirect() {
  const navigate = useNavigate()
  const sessionQuery = useAuthSessionQuery()
  const projectsQuery = useReadProjectsQuery({
    enabled: sessionQuery.data?.authenticated === true,
  })

  if (sessionQuery.isError) {
    throw sessionQuery.error
  }

  if (projectsQuery.isError) {
    throw projectsQuery.error
  }

  useEffect(() => {
    if (sessionQuery.isLoading) {
      return
    }

    if (!sessionQuery.data?.authenticated) {
      void navigate({
        to: "/login",
        replace: true,
      })
      return
    }

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
    sessionQuery.data?.authenticated,
    sessionQuery.isLoading,
  ])

  if (
    sessionQuery.isLoading ||
    (sessionQuery.data?.authenticated && projectsQuery.isLoading)
  ) {
    return (
      <AuthShell
        title="Loading Harbor"
        description="Preparing your Harbor workspace."
      />
    )
  }

  return null
}
