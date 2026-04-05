import { createFileRoute } from "@tanstack/react-router"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import {
  formatGitHubAppInstallEventMessage,
  publishGitHubAppInstallEvent,
} from "@/modules/projects/lib/github-app-install-events"

type GitHubAppCallbackSearch = {
  status?: string
  returnTo?: string
  code?: string
  message?: string
}

export const Route = createFileRoute("/github/app/callback")({
  validateSearch: (
    search: Record<string, unknown>,
  ): GitHubAppCallbackSearch => ({
    status: typeof search.status === "string" ? search.status : undefined,
    returnTo: typeof search.returnTo === "string" ? search.returnTo : undefined,
    code: typeof search.code === "string" ? search.code : undefined,
    message: typeof search.message === "string" ? search.message : undefined,
  }),
  component: GitHubAppCallbackPage,
})

function GitHubAppCallbackPage() {
  const search = Route.useSearch()
  const status = search.status === "success" ? "success" : "error"
  const event = {
    status,
    returnTo: search.returnTo ?? null,
    code: search.code ?? null,
    message: search.message ?? null,
  } as const
  const detailMessage = formatGitHubAppInstallEventMessage(event)

  useEffect(() => {
    publishGitHubAppInstallEvent(event)
  }, [event])

  return (
    <div className="bg-background text-foreground flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-xl border p-6 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm font-semibold">
            {status === "success"
              ? "GitHub App Connected"
              : "GitHub App Authorization Failed"}
          </p>
          <p className="text-muted-foreground text-sm leading-6">
            {detailMessage}
          </p>
          {status === "success" ? (
            <p className="text-muted-foreground text-sm leading-6">
              You can return to Harbor and continue selecting the repository.
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button type="button" asChild>
            <a href={search.returnTo?.trim() || "/"}>Return to Harbor</a>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => window.close()}
          >
            Close Tab
          </Button>
        </div>
      </div>
    </div>
  )
}
