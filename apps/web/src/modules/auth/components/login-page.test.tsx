import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ERROR_CODES } from "@/constants"
import { useUiStore } from "@/stores/ui.store"

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
  beforeEach(async () => {
    await act(async () => {
      await useUiStore.persist.rehydrate()
    })
  })

  afterEach(() => {
    getGitHubLoginUrlMock.mockClear()
    useUiStore.setState({
      settingsOpen: false,
      settingsProjectId: null,
      addProjectModalOpen: false,
      addProjectModalWorkspaceId: null,
      uiHydrated: true,
      cookieNoticeDismissed: false,
    })
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
      screen.getByText("A workspace for code and agents."),
    ).toBeInTheDocument()
  })

  it("shows cookie terms and hides them after confirmation", async () => {
    const user = userEvent.setup()

    act(() => {
      useUiStore.setState({
        uiHydrated: true,
        cookieNoticeDismissed: false,
      })
    })

    render(<LoginPage redirectTo="/projects/project-1" errorCode={null} />)

    const message = await screen.findByText(
      "We use cookies to improve your experience, keep you signed in, and make Harbor work as expected.",
    )

    expect(message).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Got it" }))

    await waitFor(() =>
      expect(
        screen.queryByText(
          "We use cookies to improve your experience, keep you signed in, and make Harbor work as expected.",
        ),
      ).not.toBeInTheDocument(),
    )
    expect(useUiStore.getState().cookieNoticeDismissed).toBe(true)
    expect(window.localStorage.getItem("harbor-ui")).toContain(
      '"cookieNoticeDismissed":true',
    )
  })

  it("does not show the cookie notice after it has been dismissed", () => {
    act(() => {
      useUiStore.setState({
        uiHydrated: true,
        cookieNoticeDismissed: true,
      })
    })

    render(<LoginPage redirectTo="/projects/project-1" errorCode={null} />)

    expect(
      screen.getByText(
        "Continue to Harbor",
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(
        "We use cookies to improve your experience, keep you signed in, and make Harbor work as expected.",
      ),
    ).not.toBeInTheDocument()
  })
})
