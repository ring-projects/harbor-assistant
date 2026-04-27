export type TaskInputItem =
  | {
      type: "text"
      text: string
    }
  | {
      type: "local_image"
      path: string
    }
  | {
      type: "local_file"
      path: string
    }

export type TaskInput = string | TaskInputItem[]
export type TaskInputAttachment = Extract<
  TaskInputItem,
  { type: "local_image" | "local_file" }
>

export type UploadedTaskInputAttachment = {
  path: string
  mediaType: string
  name: string
  size: number
}

export type TaskInputImageAttachment = TaskInputAttachment
export type UploadedTaskInputImage = UploadedTaskInputAttachment

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
  const fileCount = input.filter((item) => item.type === "local_file").length
  return formatAttachmentSummary({
    imageCount,
    fileCount,
  })
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
): TaskInputAttachment[] {
  if (typeof input === "string") {
    return []
  }

  return input.flatMap((item) =>
    (item.type === "local_image" || item.type === "local_file") &&
    item.path.trim()
      ? [
          {
            type: item.type,
            path: item.path.trim(),
          },
        ]
      : [],
  )
}

export function buildTaskInput(args: {
  text: string
  attachments?: UploadedTaskInputAttachment[]
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
      type: attachment.mediaType.startsWith("image/")
        ? "local_image"
        : "local_file",
      path: attachment.path,
    })
  }

  return items.length > 0 ? items : null
}

export function getAttachmentDisplayName(
  attachment: UploadedTaskInputAttachment,
) {
  return (
    attachment.name.trim() ||
    attachment.path.split("/").at(-1) ||
    attachment.path
  )
}
