"use client"

import { useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import { ERROR_CODES } from "@/constants"
import { getGitHubLoginUrl } from "../api"
import { useAuthSessionQuery } from "../hooks"
import { AuthShell } from "./auth-shell"

type LoginPageProps = {
  redirectTo?: string | null
  errorCode?: string | null
}

function resolveLoginErrorMessage(errorCode: string | null | undefined) {
  switch (errorCode) {
    case ERROR_CODES.AUTH_CALLBACK_FAILED:
      return "GitHub OAuth callback failed. Please try signing in again."
    case ERROR_CODES.PERMISSION_DENIED:
      return "Your GitHub account is not allowed to access this Harbor service."
    case ERROR_CODES.AUTH_NOT_CONFIGURED:
      return "GitHub OAuth is not configured on the service."
    case ERROR_CODES.AUTH_IDENTITY_CONFLICT:
      return "This GitHub account conflicts with an existing Harbor user and needs manual repair."
    default:
      return null
  }
}

export function LoginPage({ redirectTo, errorCode }: LoginPageProps) {
  const navigate = useNavigate()
  const sessionQuery = useAuthSessionQuery()

  useEffect(() => {
    if (!sessionQuery.data?.authenticated) {
      return
    }

    void navigate({
      to: redirectTo || "/",
      replace: true,
    })
  }, [navigate, redirectTo, sessionQuery.data?.authenticated])

  if (sessionQuery.isLoading) {
    return (
      <AuthShell
        title="Checking your session"
        description="Harbor is verifying whether you already have an active session."
      />
    )
  }

  return (
    <AuthShell
      title="Sign in to Harbor"
      description="Use your GitHub account to access this Harbor workspace."
      errorMessage={
        resolveLoginErrorMessage(errorCode) ??
        (sessionQuery.isError
          ? sessionQuery.error.message
          : null)
      }
      actions={
        <div className="flex gap-3">
          <Button asChild>
            <a href={getGitHubLoginUrl(redirectTo)}>Sign in with GitHub</a>
          </Button>
        </div>
      }
    />
  )
}
