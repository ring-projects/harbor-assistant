"use client"

import { Github, Mail } from "lucide-react"

import { HarborMark } from "@/components/logo"
import { ERROR_CODES } from "@/constants"
import { ThemeToggle } from "@/modules/app"
import { useUiStore } from "@/stores/ui.store"
import { getGitHubLoginUrl } from "../api"
import { CookieNotice } from "./cookie-notice"
import { Button } from "@/components/ui/button"

type LoginPageProps = {
  redirectTo?: string | null
  errorCode?: string | null
}

const loginFontFamily = [
  '"Berkeley Mono"',
  "var(--font-mono)",
  '"IBM Plex Mono"',
  "ui-monospace",
  "SFMono-Regular",
  "Menlo",
  "Monaco",
  "Consolas",
  '"Liberation Mono"',
  '"Courier New"',
  "monospace",
].join(", ")

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
  const uiHydrated = useUiStore((state) => state.uiHydrated)
  const cookieNoticeDismissed = useUiStore(
    (state) => state.cookieNoticeDismissed,
  )
  const dismissCookieNotice = useUiStore((state) => state.dismissCookieNotice)
  const cookieNoticeVisible = uiHydrated && !cookieNoticeDismissed
  const loginUrl = getGitHubLoginUrl(redirectTo)
  const errorMessage = resolveLoginErrorMessage(errorCode)

  return (
    <div
      className="bg-background text-foreground relative min-h-svh font-mono"
      style={{ fontFamily: loginFontFamily }}
    >
      <div className="absolute top-6 right-6 z-10 sm:top-8 sm:right-8 lg:top-10 lg:right-10">
        <ThemeToggle className="bg-background/72 text-foreground/80 hover:bg-surface-subtle hover:text-foreground shadow-none backdrop-blur" />
      </div>

      <div className="grid min-h-svh lg:grid-cols-[1.2fr_0.8fr]">
        <aside className="bg-primary text-primary-foreground relative flex min-h-[42svh] flex-col border-b border-primary/15 px-6 py-8 sm:px-10 sm:py-10 lg:min-h-svh lg:border-r lg:border-b-0 lg:px-12 lg:py-12">
          <div className="flex items-center gap-3">
            <HarborMark
              variant="white"
              width={24}
              height={24}
              className="mt-0.5 size-6 shrink-0 dark:hidden"
            />
            <HarborMark
              variant="black"
              width={24}
              height={24}
              className="mt-0.5 hidden size-6 shrink-0 dark:block"
            />
            <p className="text-base leading-5 font-medium">
              harbor assistant
            </p>
          </div>

          <div
            className="flex flex-1 items-center py-12 sm:py-14 lg:py-0"
          >
            <div className="max-w-3xl lg:pb-10">
              <h1 className="max-w-2xl text-[34px] font-bold leading-[1.38] sm:text-[44px] lg:text-[52px]">
                A workspace for code and agents.
              </h1>
              <p className="mt-8 max-w-xl text-[17px] leading-[1.8] text-primary-foreground/68">
                Connect repositories, run agents, and work in one place.
              </p>
            </div>
          </div>

          {cookieNoticeVisible ? <CookieNotice onDismiss={dismissCookieNotice} /> : null}
        </aside>

        <main className="bg-background text-foreground dark:bg-primary-foreground dark:text-primary flex min-h-svh items-center px-6 py-8 sm:px-10 sm:py-10 lg:px-12">
          <section className="mx-auto w-full max-w-md">
            <h2 className="text-[24px] font-bold leading-[1.5]">
              Continue to Harbor
            </h2>

            <div className="mt-8">
              <Button
                asChild
                size="xl"
                className="w-full shadow-none"
              >
                <a href={loginUrl}>
                  <Github className="size-4" />
                  Sign in with GitHub
                </a>
              </Button>

              <div className="mt-3">
                <div className="flex items-start gap-3">
                  <Mail className="text-muted-foreground mt-1 size-4" />
                  <div>
                    <p className="text-sm font-medium leading-6">
                      Google / Gmail OAuth
                    </p>
                    <p className="text-muted-foreground dark:text-primary/55 text-sm leading-6">
                      Available after GitHub sign-in when email workflows are enabled.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {errorMessage ? (
              <div className="text-destructive border-destructive mt-6 border-l pl-4 text-sm leading-6 dark:border-destructive/60">
                {errorMessage}
              </div>
            ) : null}
          </section>
        </main>
      </div>
    </div>
  )
}
