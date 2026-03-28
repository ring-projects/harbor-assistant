import type { AgentInput, AgentInputItem } from "../../../lib/agents"

function isNonEmpty(value: string) {
  return value.trim().length > 0
}

function formatImageSummary(imageCount: number) {
  return imageCount === 1 ? "Attached 1 image" : `Attached ${imageCount} images`
}

export function normalizeAgentInputItems(
  items: readonly AgentInputItem[] | null | undefined,
): AgentInputItem[] {
  if (!items) {
    return []
  }

  return items.flatMap<AgentInputItem>((item) => {
    if (item.type === "text") {
      const text = item.text.trim()
      return isNonEmpty(text) ? [{ type: "text", text }] : []
    }

    const path = item.path.trim()
    return isNonEmpty(path) ? [{ type: "local_image", path }] : []
  })
}

export function summarizeAgentInput(input: AgentInput): string {
  if (typeof input === "string") {
    return input.trim()
  }

  const normalizedItems = normalizeAgentInputItems(input)
  const textSummary = normalizedItems
    .flatMap((item) => (item.type === "text" ? [item.text] : []))
    .join("\n\n")
    .trim()

  if (isNonEmpty(textSummary)) {
    return textSummary
  }

  const imageCount = normalizedItems.filter(
    (item) => item.type === "local_image",
  ).length

  return imageCount > 0 ? formatImageSummary(imageCount) : ""
}

export function resolveAgentInput(args: {
  prompt?: string | null
  items?: readonly AgentInputItem[] | null
}): AgentInput | null {
  const normalizedPrompt = args.prompt?.trim() ?? ""
  const normalizedItems = normalizeAgentInputItems(args.items)

  if (normalizedItems.length > 0) {
    return normalizedItems
  }

  if (isNonEmpty(normalizedPrompt)) {
    return normalizedPrompt
  }

  return null
}

export function extractLocalImageAttachments(input: AgentInput) {
  if (typeof input === "string") {
    return []
  }

  return normalizeAgentInputItems(input)
    .filter(
      (item): item is Extract<AgentInputItem, { type: "local_image" }> =>
        item.type === "local_image",
    )
    .map((item) => ({
      type: item.type,
      path: item.path,
    }))
}
