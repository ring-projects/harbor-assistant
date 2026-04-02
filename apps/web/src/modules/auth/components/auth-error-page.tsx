"use client"

import { useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import { ERROR_CODES } from "@/constants"
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
  const isAuthenticationError =
    code === ERROR_CODES.AUTH_REQUIRED || status === 401

  useEffect(() => {
    if (!isAuthenticationError) {
      return
    }

    void navigate({
      to: "/login",
      replace: true,
    })
  }, [isAuthenticationError, navigate])

  return (
    <AuthShell
      title={isAuthenticationError ? "Authentication required" : "Something went wrong"}
      description={
        isAuthenticationError
          ? "Your Harbor session is missing or expired. Sign in again with GitHub and then retry the request."
          : message ?? "An unexpected error occurred while loading the page."
      }
      actions={
        <div className="flex gap-3">
          {isAuthenticationError ? (
            <Button asChild>
              <a href={getGitHubLoginUrl()}>Sign in with GitHub</a>
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
