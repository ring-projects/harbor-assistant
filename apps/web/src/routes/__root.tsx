import "@fontsource/inter/400.css"
import "@fontsource/inter/500.css"
import "@fontsource/inter/600.css"
import "@fontsource/inter/700.css"
import "@fontsource/inter/800.css"
import "@fontsource/jetbrains-mono/400.css"
import "@fontsource/jetbrains-mono/500.css"
import "@fontsource/jetbrains-mono/600.css"
import "@fontsource/jetbrains-mono/700.css"
import "katex/dist/katex.min.css"
import "streamdown/styles.css"
import "@/app/globals.css"

import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"

import { AppErrorPage } from "@/components/app-error-page"
import { QueryProvider } from "@/components/providers/query-provider"
import { ERROR_CODES } from "@/constants"
import { AuthErrorPage } from "@/modules/auth"
import { AddProjectModal } from "@/modules/projects/modal"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        title: "Harbor Assistant",
      },
      {
        name: "description",
        content: "Harbor Assistant projects",
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/brand/harbor-favicon-black.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: light)",
      },
      {
        rel: "icon",
        href: "/brand/harbor-favicon-white.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: dark)",
      },
      {
        rel: "shortcut icon",
        href: "/brand/harbor-favicon-black.svg",
      },
      {
        rel: "apple-touch-icon",
        href: "/brand/harbor-favicon-black.svg",
      },
    ],
  }),
  component: RootDocument,
  errorComponent: RootErrorBoundary,
  notFoundComponent: RootNotFoundBoundary,
})

function RootDocument() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="font-sans antialiased">
        <QueryProvider>
          <main>
            <Outlet />
          </main>
          <AddProjectModal />
          {import.meta.env.DEV ? (
            <TanStackRouterDevtools position="bottom-right" />
          ) : null}
        </QueryProvider>
        <Scripts />
      </body>
    </html>
  )
}

type ApiErrorLike = {
  message?: string
  code?: string
  status?: number
}

function isApiErrorLike(error: unknown): error is ApiErrorLike {
  return typeof error === "object" && error !== null
}

function RootErrorBoundary(props: { error: unknown; reset: () => void }) {
  const { error, reset } = props
  const apiError = isApiErrorLike(error) ? error : null
  const isAuthenticationError =
    apiError?.code === ERROR_CODES.AUTH_REQUIRED || apiError?.status === 401

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground font-sans antialiased">
        <QueryProvider>
          {isAuthenticationError ? (
            <AuthErrorPage
              code={apiError?.code}
              status={apiError?.status}
              message={apiError?.message}
              onRetry={reset}
            />
          ) : (
            <AppErrorPage
              code={apiError?.code}
              status={apiError?.status}
              message={apiError?.message}
              onRetry={reset}
            />
          )}
          <AddProjectModal />
          {import.meta.env.DEV ? (
            <TanStackRouterDevtools position="bottom-right" />
          ) : null}
        </QueryProvider>
        <Scripts />
      </body>
    </html>
  )
}

function RootNotFoundBoundary() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground font-sans antialiased">
        <QueryProvider>
          <AppErrorPage
            status={404}
            code={ERROR_CODES.NOT_FOUND}
            title="Page not found"
            description="The route you requested does not exist in Harbor Assistant."
          />
          <AddProjectModal />
          {import.meta.env.DEV ? (
            <TanStackRouterDevtools position="bottom-right" />
          ) : null}
        </QueryProvider>
        <Scripts />
      </body>
    </html>
  )
}
