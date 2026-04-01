import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ChatMessage } from "./chat-message"

describe("ChatMessage", () => {
  it("renders user image attachments as dedicated attachment blocks", () => {
    render(
      <ChatMessage
        block={{
          id: "message-1",
          type: "message",
          role: "user",
          content: "Review this screenshot",
          attachments: [
            {
              type: "local_image",
              path: ".harbor/task-input-images/example.png",
            },
          ],
          timestamp: "2026-03-11T00:00:00.000Z",
        }}
      />,
    )

    expect(screen.getByText("Review this screenshot")).toBeInTheDocument()
    expect(screen.getByText("example.png")).toBeInTheDocument()
    expect(
      screen.getByText(".harbor/task-input-images/example.png"),
    ).toBeInTheDocument()
  })

  it("renders attachment-only user messages without an empty text block", () => {
    render(
      <ChatMessage
        block={{
          id: "message-2",
          type: "message",
          role: "user",
          content: "",
          attachments: [
            {
              type: "local_image",
              path: ".harbor/task-input-images/only-image.png",
            },
          ],
          timestamp: "2026-03-11T00:00:00.000Z",
        }}
      />,
    )

    expect(screen.getByText("only-image.png")).toBeInTheDocument()
    expect(screen.queryByText(/^Attached 1 image$/)).not.toBeInTheDocument()
  })

  it("renders user file attachments as dedicated attachment blocks", () => {
    render(
      <ChatMessage
        block={{
          id: "message-3",
          type: "message",
          role: "user",
          content: "Review this spec",
          attachments: [
            {
              type: "local_file",
              path: ".harbor/task-input-files/spec.md",
            },
          ],
          timestamp: "2026-03-11T00:00:00.000Z",
        }}
      />,
    )

    expect(screen.getByText("Review this spec")).toBeInTheDocument()
    expect(screen.getByText("spec.md")).toBeInTheDocument()
    expect(
      screen.getByText(".harbor/task-input-files/spec.md"),
    ).toBeInTheDocument()
  })
})
