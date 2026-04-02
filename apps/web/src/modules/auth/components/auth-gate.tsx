"use client"

import { useLocation, useNavigate } from "@tanstack/react-router"
import { useEffect, type ReactNode } from "react"

import { AuthShell } from "./auth-shell"
import { useAuthSessionQuery } from "../hooks"

type AuthGateProps = {
  children: ReactNode
}

export function AuthGate({ children }: AuthGateProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const sessionQuery = useAuthSessionQuery()

  if (sessionQuery.isError) {
    throw sessionQuery.error
  }

  useEffect(() => {
    if (sessionQuery.isLoading || sessionQuery.data?.authenticated) {
      return
    }

    const redirectTo = `${location.pathname}${location.search}${location.hash}`

    void navigate({
      to: "/login",
      search: {
        redirect: redirectTo,
      },
      replace: true,
    })
  }, [
    location.hash,
    location.pathname,
    location.search,
    navigate,
    sessionQuery.data?.authenticated,
    sessionQuery.isLoading,
  ])

  if (sessionQuery.isLoading) {
    return (
      <AuthShell
        title="Checking your session"
        description="Harbor is loading your access state before opening the workspace."
      />
    )
  }

  if (!sessionQuery.data?.authenticated) {
    return null
  }

  return <>{children}</>
}
