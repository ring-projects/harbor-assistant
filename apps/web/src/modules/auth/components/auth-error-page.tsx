"use client"

import { useLocation, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import { ERROR_CODES } from "@/constants"
import { normalizeAuthRedirectTarget } from "../lib/redirect-target"
import { getGitHubLoginUrl } from "../api"
import { AuthShell } from "./auth-shell"

type AuthErrorPageProps = {
  code?: string
  status?: number
  message?: string
  onRetry?: () => void
}

export function AuthErrorPage(props: AuthErrorPageProps) {
  const { code, status, message, onRetry } = props
  const navigate = useNavigate()
  const location = useLocation()
  const isAuthenticationError =
    code === ERROR_CODES.AUTH_REQUIRED || status === 401
  const redirectTo = normalizeAuthRedirectTarget(location.href)

  useEffect(() => {
    if (!isAuthenticationError || location.pathname === "/login") {
      return
    }

    void navigate({
      to: "/login",
      search: redirectTo
        ? {
            redirect: redirectTo,
          }
        : undefined,
      replace: true,
    })
  }, [isAuthenticationError, location.pathname, navigate, redirectTo])

  return (
    <AuthShell
      title={
        isAuthenticationError
          ? "Authentication required"
          : "Something went wrong"
      }
      description={
        isAuthenticationError
          ? "Your Harbor session is missing or expired. Sign in again with GitHub and then retry the request."
          : (message ?? "An unexpected error occurred while loading the page.")
      }
      actions={
        <div className="flex gap-3">
          {isAuthenticationError ? (
            <Button asChild>
              <a href={getGitHubLoginUrl(redirectTo ?? undefined)}>
                Sign in with GitHub
              </a>
            </Button>
          ) : null}
          {onRetry ? (
            <Button
              type="button"
              variant={isAuthenticationError ? "outline" : "default"}
              onClick={onRetry}
            >
              Retry
            </Button>
          ) : null}
        </div>
      }
    />
  )
}
