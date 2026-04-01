import { describe, expect, it } from "vitest"

import {
  extractLocalAttachments,
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
          {
            type: "local_file",
            path: "  .harbor/task-input-files/notes.md  ",
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
      {
        type: "local_file",
        path: ".harbor/task-input-files/notes.md",
      },
    ])
  })

  it("drops empty text items and keeps normalized local attachments", () => {
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
        {
          type: "local_file",
          path: "  .harbor/task-input-files/spec.md  ",
        },
      ]),
    ).toEqual([
      {
        type: "local_image",
        path: ".harbor/task-input-images/example.png",
      },
      {
        type: "local_file",
        path: ".harbor/task-input-files/spec.md",
      },
    ])
  })

  it("summarizes text input and attachment-only input", () => {
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
    expect(
      summarizeAgentInput([
        {
          type: "local_file",
          path: ".harbor/task-input-files/spec.md",
        },
        {
          type: "local_file",
          path: ".harbor/task-input-files/notes.txt",
        },
      ]),
    ).toBe("Attached 2 files")
    expect(
      summarizeAgentInput([
        {
          type: "local_image",
          path: ".harbor/task-input-images/example.png",
        },
        {
          type: "local_file",
          path: ".harbor/task-input-files/spec.md",
        },
      ]),
    ).toBe("Attached 1 image and 1 file")
  })

  it("extracts local attachments from structured input", () => {
    const input = [
      {
        type: "text" as const,
        text: "Review this screenshot",
      },
      {
        type: "local_image" as const,
        path: ".harbor/task-input-images/example.png",
      },
      {
        type: "local_file" as const,
        path: ".harbor/task-input-files/spec.md",
      },
    ]

    expect(extractLocalAttachments(input)).toEqual([
      {
        type: "local_image",
        path: ".harbor/task-input-images/example.png",
      },
      {
        type: "local_file",
        path: ".harbor/task-input-files/spec.md",
      },
    ])

    expect(extractLocalImageAttachments(input)).toEqual([
      {
        type: "local_image",
        path: ".harbor/task-input-images/example.png",
      },
      {
        type: "local_file",
        path: ".harbor/task-input-files/spec.md",
      },
    ])
  })
})
