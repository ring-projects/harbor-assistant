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

import { QueryProvider } from "@/components/providers/query-provider"
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
