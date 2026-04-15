import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ERROR_CODES } from "@/constants"

import { LoginPage } from "./login-page"

const getGitHubLoginUrlMock = vi.fn((redirectTo?: string | null) =>
  redirectTo
    ? `/v1/auth/github/start?redirect=${encodeURIComponent(redirectTo)}`
    : "/v1/auth/github/start",
)

vi.mock("../api", () => ({
  getGitHubLoginUrl: (redirectTo?: string | null) =>
    getGitHubLoginUrlMock(redirectTo),
}))

describe("LoginPage", () => {
  afterEach(() => {
    getGitHubLoginUrlMock.mockClear()
    window.localStorage.clear()
  })

  it("passes redirectTo into the GitHub login link", () => {
    render(
      <LoginPage
        redirectTo="/projects/project-1?tab=files#readme"
        errorCode={null}
      />,
    )

    expect(getGitHubLoginUrlMock).toHaveBeenCalledWith(
      "/projects/project-1?tab=files#readme",
    )
    expect(
      screen.getByRole("link", { name: "Sign in with GitHub" }),
    ).toHaveAttribute(
      "href",
      "/v1/auth/github/start?redirect=%2Fprojects%2Fproject-1%3Ftab%3Dfiles%23readme",
    )
  })

  it("shows a dedicated message for auth identity conflicts", () => {
    render(
      <LoginPage
        redirectTo="/projects/project-1"
        errorCode={ERROR_CODES.AUTH_IDENTITY_CONFLICT}
      />,
    )

    expect(
      screen.getByText(
        "This GitHub account conflicts with an existing Harbor user and needs manual repair.",
      ),
    ).toBeInTheDocument()
  })

  it("explains that gmail oauth happens after github sign-in", () => {
    render(<LoginPage redirectTo="/projects/project-1" errorCode={null} />)

    expect(screen.getByText("Google / Gmail OAuth")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Available after GitHub sign-in when email workflows are enabled.",
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Sign in with your GitHub account to access projects, settings, and workspace tools in Harbor.",
      ),
    ).toBeInTheDocument()
  })

  it("shows cookie terms and hides them after confirmation", async () => {
    const user = userEvent.setup()

    render(<LoginPage redirectTo="/projects/project-1" errorCode={null} />)

    expect(
      screen.getByText(
        "We use cookies to improve your experience, keep you signed in, and make Harbor work as expected.",
      ),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Got it" }))

    expect(
      screen.queryByText(
        "We use cookies to improve your experience, keep you signed in, and make Harbor work as expected.",
      ),
    ).not.toBeInTheDocument()
    expect(window.localStorage.getItem("harbor.cookie-notice-dismissed")).toBe(
      "true",
    )
  })

  it("does not show the cookie notice after it has been dismissed", () => {
    window.localStorage.setItem("harbor.cookie-notice-dismissed", "true")

    render(<LoginPage redirectTo="/projects/project-1" errorCode={null} />)

    expect(
      screen.queryByText(
        "We use cookies to improve your experience, keep you signed in, and make Harbor work as expected.",
      ),
    ).not.toBeInTheDocument()
  })
})
