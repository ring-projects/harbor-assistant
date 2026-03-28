export type TaskInputItem =
  | {
      type: "text"
      text: string
    }
  | {
      type: "local_image"
      path: string
    }

export type TaskInput = string | TaskInputItem[]
export type TaskInputImageAttachment = Extract<TaskInputItem, { type: "local_image" }>

export type UploadedTaskInputImage = {
  path: string
  mediaType: string
  name: string
  size: number
}

export function summarizeTaskInput(input: TaskInput): string {
  if (typeof input === "string") {
    return input.trim()
  }

  const text = input
    .flatMap((item) => (item.type === "text" ? [item.text.trim()] : []))
    .filter((item) => item.length > 0)
    .join("\n\n")
    .trim()

  if (text) {
    return text
  }

  const imageCount = input.filter((item) => item.type === "local_image").length
  if (imageCount === 0) {
    return ""
  }

  return imageCount === 1 ? "Attached 1 image" : `Attached ${imageCount} images`
}

export function extractTaskInputText(input: TaskInput): string {
  if (typeof input === "string") {
    return input.trim()
  }

  return input
    .flatMap((item) => (item.type === "text" ? [item.text.trim()] : []))
    .filter((item) => item.length > 0)
    .join("\n\n")
    .trim()
}

export function extractTaskInputAttachments(
  input: TaskInput,
): TaskInputImageAttachment[] {
  if (typeof input === "string") {
    return []
  }

  return input.flatMap((item) =>
    item.type === "local_image" && item.path.trim()
      ? [
          {
            type: "local_image" as const,
            path: item.path.trim(),
          },
        ]
      : [],
  )
}

export function buildTaskInput(args: {
  text: string
  attachments?: UploadedTaskInputImage[]
}): TaskInput | null {
  const text = args.text.trim()
  const attachments = args.attachments ?? []

  if (attachments.length === 0) {
    return text ? text : null
  }

  const items: TaskInputItem[] = []
  if (text) {
    items.push({
      type: "text",
      text,
    })
  }

  for (const attachment of attachments) {
    items.push({
      type: "local_image",
      path: attachment.path,
    })
  }

  return items.length > 0 ? items : null
}

export function getAttachmentDisplayName(attachment: UploadedTaskInputImage) {
  return attachment.name.trim() || attachment.path.split("/").at(-1) || attachment.path
}
