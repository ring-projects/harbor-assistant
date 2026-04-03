import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ERROR_CODES } from "@/constants"

import { AuthErrorPage } from "./auth-error-page"

const navigateMock = vi.fn()
const useLocationMock = vi.fn()
const getGitHubLoginUrlMock = vi.fn((redirectTo?: string | null) =>
  redirectTo
    ? `/v1/auth/github/start?redirect=${encodeURIComponent(redirectTo)}`
    : "/v1/auth/github/start",
)

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
  useLocation: () => useLocationMock(),
}))

vi.mock("../api", () => ({
  getGitHubLoginUrl: (redirectTo?: string | null) =>
    getGitHubLoginUrlMock(redirectTo),
}))

describe("AuthErrorPage", () => {
  afterEach(() => {
    navigateMock.mockReset()
    useLocationMock.mockReset()
    getGitHubLoginUrlMock.mockClear()
  })

  it("preserves the current path when redirecting authentication errors to login", async () => {
    useLocationMock.mockReturnValue({
      pathname: "/projects/project-1",
      search: "?tab=files",
      hash: "#readme",
    })

    render(<AuthErrorPage code={ERROR_CODES.AUTH_REQUIRED} status={401} />)

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: "/login",
        search: {
          redirect: "/projects/project-1?tab=files#readme",
        },
        replace: true,
      })
    })

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

  it("renders non-auth errors without forcing a login redirect", () => {
    useLocationMock.mockReturnValue({
      pathname: "/projects/project-1",
      search: "",
      hash: "",
    })

    render(<AuthErrorPage message="Something broke." status={500} />)

    expect(screen.getByText("Something broke.")).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
