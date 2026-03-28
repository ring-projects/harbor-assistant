import { describe, expect, it } from "vitest"

import {
  extractLocalImageAttachments,
  normalizeAgentInputItems,
  resolveAgentInput,
  summarizeAgentInput,
} from "./task-input"

describe("task input helpers", () => {
  it("resolves prompt input as a trimmed string", () => {
    expect(
      resolveAgentInput({
        prompt: "  Investigate runtime drift  ",
      }),
    ).toBe("Investigate runtime drift")
  })

  it("prefers structured items when provided", () => {
    expect(
      resolveAgentInput({
        prompt: "ignored",
        items: [
          {
            type: "text",
            text: "  Review this screenshot  ",
          },
          {
            type: "local_image",
            path: "  .harbor/task-input-images/example.png  ",
          },
        ],
      }),
    ).toEqual([
      {
        type: "text",
        text: "Review this screenshot",
      },
      {
        type: "local_image",
        path: ".harbor/task-input-images/example.png",
      },
    ])
  })

  it("drops empty text items and keeps normalized local images", () => {
    expect(
      normalizeAgentInputItems([
        {
          type: "text",
          text: "   ",
        },
        {
          type: "local_image",
          path: "  .harbor/task-input-images/example.png  ",
        },
      ]),
    ).toEqual([
      {
        type: "local_image",
        path: ".harbor/task-input-images/example.png",
      },
    ])
  })

  it("summarizes text input and image-only input", () => {
    expect(summarizeAgentInput("  Run tests  ")).toBe("Run tests")
    expect(
      summarizeAgentInput([
        {
          type: "text",
          text: "Review this screenshot",
        },
        {
          type: "local_image",
          path: ".harbor/task-input-images/example.png",
        },
      ]),
    ).toBe("Review this screenshot")
    expect(
      summarizeAgentInput([
        {
          type: "local_image",
          path: ".harbor/task-input-images/example-1.png",
        },
        {
          type: "local_image",
          path: ".harbor/task-input-images/example-2.png",
        },
      ]),
    ).toBe("Attached 2 images")
  })

  it("extracts local image attachments from structured input", () => {
    expect(
      extractLocalImageAttachments([
        {
          type: "text",
          text: "Review this screenshot",
        },
        {
          type: "local_image",
          path: ".harbor/task-input-images/example.png",
        },
      ]),
    ).toEqual([
      {
        type: "local_image",
        path: ".harbor/task-input-images/example.png",
      },
    ])
  })
})
