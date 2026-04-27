"use client"

import { Link } from "@tanstack/react-router"
import { AlertTriangle, ArrowLeft, Home, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ERROR_CODES } from "@/constants"
import { cn } from "@/lib/utils"

type AppErrorPageProps = {
  title?: string
  description?: string
  message?: string | null
  code?: string | null
  status?: number | null
  onRetry?: (() => void) | null
  homeHref?: string
  className?: string
}

const NOT_FOUND_CODES = new Set<string>([
  ERROR_CODES.NOT_FOUND,
  ERROR_CODES.PROJECT_NOT_FOUND,
  ERROR_CODES.TASK_NOT_FOUND,
  ERROR_CODES.PATH_NOT_FOUND,
])

function resolvePageCopy(
  title: string | undefined,
  description: string | undefined,
  status: number | null | undefined,
  code: string | null | undefined,
) {
  if (title || description) {
    return {
      title: title ?? "Something went wrong",
      description:
        description ??
        "Harbor ran into an unexpected problem while loading this page.",
    }
  }

  if (status === 404 || (code && NOT_FOUND_CODES.has(code))) {
    return {
      title: "Page not found",
      description:
        "The page or resource you requested does not exist or is no longer available.",
    }
  }

  if (status === 403 || code === ERROR_CODES.PERMISSION_DENIED) {
    return {
      title: "Access denied",
      description:
        "Your account does not have permission to view this page or perform this action.",
    }
  }

  return {
    title: "Something went wrong",
    description:
      "Harbor ran into an unexpected problem while loading this page.",
  }
}

export function AppErrorPage({
  title,
  description,
  message,
  code,
  status,
  onRetry,
  homeHref = "/",
  className,
}: AppErrorPageProps) {
  const copy = resolvePageCopy(title, description, status, code)

  function handleGoBack() {
    if (typeof window === "undefined") {
      return
    }

    if (window.history.length > 1) {
      window.history.back()
      return
    }

    window.location.assign(homeHref)
  }

  return (
    <div
      className={cn(
        "bg-background text-foreground relative flex min-h-svh items-center justify-center overflow-hidden px-6 py-10",
        className,
      )}
    >
      <div className="bg-primary/10 absolute inset-x-[8%] top-0 h-48 rounded-full blur-3xl" />
      <div className="bg-muted absolute -bottom-24 left-[-8%] size-72 rounded-full blur-3xl" />
      <div className="bg-card/95 relative w-full max-w-2xl overflow-hidden rounded-[2rem] border shadow-2xl shadow-black/5 backdrop-blur">
        <div className="border-border/80 flex items-center gap-3 border-b px-6 py-4 sm:px-8">
          <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-2xl">
            <AlertTriangle className="size-5" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-[0.24em] uppercase">
              Harbor Assistant
            </p>
            <p className="text-sm font-medium">Application error</p>
          </div>
        </div>

        <div className="space-y-6 px-6 py-8 sm:px-8 sm:py-10">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {typeof status === "number" ? (
                <span className="bg-muted text-muted-foreground rounded-full px-3 py-1 text-xs font-medium">
                  HTTP {status}
                </span>
              ) : null}
              {code ? (
                <span className="bg-muted text-muted-foreground rounded-full px-3 py-1 font-mono text-xs">
                  {code}
                </span>
              ) : null}
            </div>
            <div className="space-y-2">
              <h1 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
                {copy.title}
              </h1>
              <p className="text-muted-foreground max-w-xl text-sm leading-6 sm:text-base">
                {copy.description}
              </p>
            </div>
          </div>

          {message ? (
            <div className="bg-muted/50 border-border/80 rounded-2xl border p-4">
              <p className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
                Error details
              </p>
              <p className="mt-3 font-mono text-sm leading-6 break-words">
                {message}
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link to={homeHref}>
                <Home className="size-4" />
                Back to Harbor
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleGoBack}
            >
              <ArrowLeft className="size-4" />
              Go back
            </Button>
            {onRetry ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={onRetry}
              >
                <RotateCcw className="size-4" />
                Try again
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
