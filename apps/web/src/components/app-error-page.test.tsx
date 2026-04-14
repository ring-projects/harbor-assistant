import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import { ERROR_CODES } from "@/constants"

import { AppErrorPage } from "./app-error-page"

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string
    children: ReactNode
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

describe("AppErrorPage", () => {
  it("renders a generic application error with retry controls", () => {
    const onRetry = vi.fn()

    render(
      <AppErrorPage
        status={500}
        code={ERROR_CODES.INTERNAL_ERROR}
        message="The service returned an unexpected response."
        onRetry={onRetry}
      />,
    )

    expect(screen.getByText("Something went wrong")).toBeInTheDocument()
    expect(screen.getByText("HTTP 500")).toBeInTheDocument()
    expect(screen.getByText(ERROR_CODES.INTERNAL_ERROR)).toBeInTheDocument()
    expect(
      screen.getByText("The service returned an unexpected response."),
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back to Harbor" })).toHaveAttribute(
      "href",
      "/",
    )

    fireEvent.click(screen.getByRole("button", { name: "Try again" }))

    expect(onRetry).toHaveBeenCalledOnce()
  })

  it("renders not found copy for 404-style errors", () => {
    render(<AppErrorPage status={404} code={ERROR_CODES.PROJECT_NOT_FOUND} />)

    expect(screen.getByText("Page not found")).toBeInTheDocument()
    expect(
      screen.getByText(
        "The page or resource you requested does not exist or is no longer available.",
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument()
  })
})
