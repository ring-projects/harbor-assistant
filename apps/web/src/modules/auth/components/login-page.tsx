"use client"

import { Github, Mail } from "lucide-react"
import { useEffect, useState } from "react"

import { HarborMark } from "@/components/logo"
import { ERROR_CODES } from "@/constants"
import { getGitHubLoginUrl } from "../api"
import { CookieNotice } from "./cookie-notice"
import { Button } from "@/components/ui/button"

type LoginPageProps = {
  redirectTo?: string | null
  errorCode?: string | null
}

const COOKIE_NOTICE_DISMISSED_KEY = "harbor.cookie-notice-dismissed"

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
  const [cookieNoticeVisible, setCookieNoticeVisible] = useState(true)
  const loginUrl = getGitHubLoginUrl(redirectTo)
  const errorMessage = resolveLoginErrorMessage(errorCode)

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    if (window.localStorage.getItem(COOKIE_NOTICE_DISMISSED_KEY) === "true") {
      setCookieNoticeVisible(false)
    }
  }, [])

  function dismissCookieNotice() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(COOKIE_NOTICE_DISMISSED_KEY, "true")
    }

    setCookieNoticeVisible(false)
  }

  return (
    <div
      className="min-h-svh bg-[#201d1d] text-[#fdfcfc] font-mono"
      style={{ fontFamily: loginFontFamily }}
    >
      <div className="grid min-h-svh lg:grid-cols-[1.2fr_0.8fr]">
        <aside className="relative flex min-h-[42svh] flex-col border-b border-[rgba(15,0,0,0.12)] bg-[#201d1d] px-6 py-8 sm:px-10 sm:py-10 lg:min-h-svh lg:border-r lg:border-b-0 lg:px-12 lg:py-12">
          <div className="flex items-center gap-3">
            <HarborMark
              variant="white"
              width={24}
              height={24}
              className="mt-0.5 size-6 shrink-0"
            />
            <p className="text-base leading-5 font-medium text-[#fdfcfc]">
              harbor assistant
            </p>
          </div>

          <div
            className={`flex flex-1 items-center py-12 sm:py-14 lg:py-0 ${
              cookieNoticeVisible ? "pb-40 sm:pb-44 lg:pb-48" : ""
            }`}
          >
            <div className="max-w-3xl lg:pb-10">
              <h1 className="max-w-2xl text-[34px] font-bold leading-[1.38] text-[#fdfcfc] sm:text-[44px] lg:text-[52px]">
                Sign in once and continue directly into your Harbor workspace.
              </h1>
              <p className="mt-8 max-w-xl text-[17px] leading-[1.8] text-[#9a9898]">
                Sign in with your GitHub account to access projects, settings, and
                workspace tools in Harbor.
              </p>
            </div>
          </div>

          {cookieNoticeVisible ? <CookieNotice onDismiss={dismissCookieNotice} /> : null}
        </aside>

        <main className="flex min-h-svh items-center bg-[#f8f7f7] px-6 py-8 text-[#201d1d] sm:px-10 sm:py-10 lg:px-12">
          <section className="mx-auto w-full max-w-md text-[#201d1d]">
            <h2 className="text-[24px] font-bold leading-[1.5] text-[#201d1d]">
              Continue to Harbor
            </h2>

            <div className="mt-8">
              <Button asChild size="xl" className="w-full shadow-none">
                <a href={loginUrl}>
                  <Github className="size-4" />
                  Sign in with GitHub
                </a>
              </Button>

              <div className="mt-3">
                <div className="flex items-start gap-3">
                  <Mail className="mt-1 size-4 text-[#8c8c91]" />
                  <div>
                    <p className="text-sm font-medium leading-6 text-[#424245]">
                      Google / Gmail OAuth
                    </p>
                    <p className="text-sm leading-6 text-[#6e6e73]">
                      Available after GitHub sign-in when email workflows are enabled.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {errorMessage ? (
              <div className="mt-6 border-l border-[#ff3b30] pl-4 text-sm leading-6 text-[#ff3b30]">
                {errorMessage}
              </div>
            ) : null}
          </section>
        </main>
      </div>
    </div>
  )
}
