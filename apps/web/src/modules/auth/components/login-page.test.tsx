import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ERROR_CODES } from "@/constants"

import { LoginPage } from "./login-page"

const navigateMock = vi.fn()
const getGitHubLoginUrlMock = vi.fn((redirectTo?: string | null) =>
  redirectTo
    ? `/v1/auth/github/start?redirect=${encodeURIComponent(redirectTo)}`
    : "/v1/auth/github/start",
)
const useAuthSessionQueryMock = vi.fn()

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
}))

vi.mock("../api", () => ({
  getGitHubLoginUrl: (redirectTo?: string | null) =>
    getGitHubLoginUrlMock(redirectTo),
}))

vi.mock("../hooks", () => ({
  useAuthSessionQuery: () => useAuthSessionQueryMock(),
}))

describe("LoginPage", () => {
  afterEach(() => {
    navigateMock.mockReset()
    getGitHubLoginUrlMock.mockClear()
    useAuthSessionQueryMock.mockReset()
  })

  it("passes redirectTo into the GitHub login link", () => {
    useAuthSessionQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        authenticated: false,
        user: null,
      },
    })

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

  it("navigates to redirectTo after the session becomes authenticated", async () => {
    useAuthSessionQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        authenticated: true,
        user: {
          id: "user-1",
          githubLogin: "octocat",
        },
      },
    })

    render(
      <LoginPage
        redirectTo="/projects/project-1"
        errorCode={null}
      />,
    )

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: "/projects/project-1",
        replace: true,
      })
    })
  })

  it("shows a dedicated message for auth identity conflicts", () => {
    useAuthSessionQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        authenticated: false,
        user: null,
      },
    })

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
})
