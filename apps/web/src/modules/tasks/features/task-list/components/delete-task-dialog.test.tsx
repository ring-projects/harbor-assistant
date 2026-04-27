import type { ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { DeleteTaskDialog } from "./delete-task-dialog"

vi.mock("@/components/ui/button", () => ({
  Button: ({ children }: { children: ReactNode }) => (
    <button>{children}</button>
  ),
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  DialogFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <h1>{children}</h1>,
}))

describe("DeleteTaskDialog", () => {
  it("clamps the pending task title to two lines", () => {
    const title =
      "This is a very long task title meant to verify the delete dialog title only shows up to two lines"

    render(
      <DeleteTaskDialog
        pendingTaskDelete={{ id: "task-1", title }}
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    )

    expect(screen.getByText(`\"${title}\"`)).toHaveClass("line-clamp-2")
  })
})
