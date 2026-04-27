import type { Input as CodexInput } from "@openai/codex-sdk"

import type { AgentInput } from "../../types"

export function serializeHarborInputForCodex(input: AgentInput): CodexInput {
  if (typeof input === "string") {
    return input
  }

  const textBlocks: string[] = []
  const items: Array<
    | {
        type: "text"
        text: string
      }
    | {
        type: "local_image"
        path: string
      }
  > = []
  const filePaths = input
    .flatMap((item) => (item.type === "local_file" ? [item.path.trim()] : []))
    .filter((path) => path.length > 0)

  for (const item of input) {
    if (item.type === "text") {
      const text = item.text.trim()
      if (text) {
        textBlocks.push(text)
      }
      continue
    }

    if (item.type === "local_image") {
      const path = item.path.trim()
      if (path) {
        items.push({
          type: "local_image",
          path,
        })
      }
    }
  }

  if (filePaths.length > 0) {
    textBlocks.push(
      `Attached local files:\n${filePaths.map((path) => `- ${path}`).join("\n")}`,
    )
  }

  if (textBlocks.length > 0) {
    items.unshift({
      type: "text",
      text: textBlocks.join("\n\n"),
    })
  }

  if (items.length === 0) {
    return ""
  }

  return items
}
