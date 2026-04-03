import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { AuthGate } from "./auth-gate"

const navigateMock = vi.fn()
const useLocationMock = vi.fn()
const useAuthSessionQueryMock = vi.fn()

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
  useLocation: () => useLocationMock(),
}))

vi.mock("../hooks", () => ({
  useAuthSessionQuery: () => useAuthSessionQueryMock(),
}))

describe("AuthGate", () => {
  afterEach(() => {
    navigateMock.mockReset()
    useLocationMock.mockReset()
    useAuthSessionQueryMock.mockReset()
  })

  it("redirects unauthenticated users to login with the current path", async () => {
    useLocationMock.mockReturnValue({
      pathname: "/projects/project-1",
      search: "?tab=files",
      hash: "#readme",
    })
    useAuthSessionQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        authenticated: false,
        user: null,
      },
    })

    render(
      <AuthGate>
        <div>Protected content</div>
      </AuthGate>,
    )

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: "/login",
        search: {
          redirect: "/projects/project-1?tab=files#readme",
        },
        replace: true,
      })
    })
  })

  it("renders children when the user is already authenticated", () => {
    useLocationMock.mockReturnValue({
      pathname: "/projects/project-1",
      search: "",
      hash: "",
    })
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
      <AuthGate>
        <div>Protected content</div>
      </AuthGate>,
    )

    expect(screen.getByText("Protected content")).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
