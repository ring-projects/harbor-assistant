import type { AgentInput, AgentInputItem } from "../../../lib/agents"

function isNonEmpty(value: string) {
  return value.trim().length > 0
}

function formatAttachmentSummary(args: {
  imageCount: number
  fileCount: number
}) {
  const parts: string[] = []

  if (args.imageCount > 0) {
    parts.push(args.imageCount === 1 ? "1 image" : `${args.imageCount} images`)
  }

  if (args.fileCount > 0) {
    parts.push(args.fileCount === 1 ? "1 file" : `${args.fileCount} files`)
  }

  return parts.length > 0 ? `Attached ${parts.join(" and ")}` : ""
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
    if (!isNonEmpty(path)) {
      return []
    }

    if (item.type === "local_image") {
      return [{ type: "local_image", path }]
    }

    return [{ type: "local_file", path }]
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
  const fileCount = normalizedItems.filter(
    (item) => item.type === "local_file",
  ).length

  return formatAttachmentSummary({
    imageCount,
    fileCount,
  })
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

export function extractLocalAttachments(input: AgentInput) {
  if (typeof input === "string") {
    return []
  }

  return normalizeAgentInputItems(input)
    .filter(
      (
        item,
      ): item is Extract<
        AgentInputItem,
        { type: "local_image" | "local_file" }
      > => item.type === "local_image" || item.type === "local_file",
    )
    .map((item) => ({
      type: item.type,
      path: item.path,
    }))
}

export const extractLocalImageAttachments = extractLocalAttachments
