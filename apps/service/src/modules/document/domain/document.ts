import { createDocumentError } from "../errors"

export const DOCUMENT_KINDS = [
  "requirements",
  "plan",
  "context_bundle",
  "task_summary",
  "review",
  "final_report",
] as const

export const DOCUMENT_FORMATS = ["markdown", "json"] as const

export const DOCUMENT_STATUSES = ["draft", "published", "archived"] as const

export type DocumentKind = (typeof DOCUMENT_KINDS)[number]
export type DocumentFormat = (typeof DOCUMENT_FORMATS)[number]
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number]

export type Document = {
  id: string
  projectId: string
  taskId: string | null
  kind: DocumentKind
  title: string
  path: string
  format: DocumentFormat
  status: DocumentStatus
  version: number
  summary: string | null
  createdAt: Date
  updatedAt: Date
}

const DOCUMENT_KIND_FORMATS: Record<DocumentKind, readonly DocumentFormat[]> = {
  requirements: ["markdown"],
  plan: ["markdown"],
  context_bundle: ["json"],
  task_summary: ["markdown"],
  review: ["markdown"],
  final_report: ["markdown"],
}

export function createDocument(input: {
  id: string
  projectId: string
  kind: DocumentKind
  title: string
  path: string
  format: DocumentFormat
  taskId?: string | null
  status?: DocumentStatus
  version?: number
  summary?: string | null
  createdAt?: Date
  updatedAt?: Date
}): Document {
  const id = requireNonEmpty(input.id, "id")
  const projectId = requireNonEmpty(input.projectId, "projectId")
  const title = requireNonEmpty(input.title, "title")
  const taskId = normalizeNullableString(input.taskId ?? null, "taskId")
  const path = normalizeDocumentPath(input.path)
  const createdAt = input.createdAt ?? new Date()
  const updatedAt = input.updatedAt ?? createdAt
  const version = input.version ?? 1

  assertDocumentKind(input.kind)
  assertDocumentFormat(input.format)
  assertKindAllowsFormat(input.kind, input.format)
  assertDocumentStatus(input.status ?? "draft")
  assertPositiveInteger(version, "version")

  return {
    id,
    projectId,
    taskId,
    kind: input.kind,
    title,
    path,
    format: input.format,
    status: input.status ?? "draft",
    version,
    summary: normalizeNullableString(input.summary ?? null, "summary"),
    createdAt,
    updatedAt,
  }
}

export function reviseDocument(
  document: Document,
  now = new Date(),
): Document {
  assertDocumentCanWrite(document)

  return {
    ...document,
    version: document.version + 1,
    updatedAt: now,
  }
}

export function publishDocument(
  document: Document,
  now = new Date(),
): Document {
  if (document.status === "archived") {
    throw createDocumentError().archived("archived document cannot be published")
  }

  if (document.status === "published") {
    return document
  }

  return {
    ...document,
    status: "published",
    updatedAt: now,
  }
}

export function archiveDocument(
  document: Document,
  now = new Date(),
): Document {
  if (document.status === "archived") {
    throw createDocumentError().invalidState("document is already archived")
  }

  return {
    ...document,
    status: "archived",
    updatedAt: now,
  }
}

export function assertDocumentCanWrite(document: Document) {
  if (document.status === "archived") {
    throw createDocumentError().archived("archived document cannot be updated")
  }
}

export function isDocumentPathWithinWorkspace(path: string) {
  if (!path.startsWith(".harbor/")) {
    return false
  }

  return !path.split("/").some((segment) => segment === "..")
}

function assertDocumentKind(kind: string): asserts kind is DocumentKind {
  if (!DOCUMENT_KINDS.includes(kind as DocumentKind)) {
    throw createDocumentError().invalidKind(`unsupported document kind: ${kind}`)
  }
}

function assertDocumentFormat(
  format: string,
): asserts format is DocumentFormat {
  if (!DOCUMENT_FORMATS.includes(format as DocumentFormat)) {
    throw createDocumentError().invalidFormat(
      `unsupported document format: ${format}`,
    )
  }
}

function assertDocumentStatus(
  status: string,
): asserts status is DocumentStatus {
  if (!DOCUMENT_STATUSES.includes(status as DocumentStatus)) {
    throw createDocumentError().invalidState(
      `unsupported document status: ${status}`,
    )
  }
}

function assertKindAllowsFormat(kind: DocumentKind, format: DocumentFormat) {
  if (!DOCUMENT_KIND_FORMATS[kind].includes(format)) {
    throw createDocumentError().invalidFormat(
      `${kind} does not support ${format} format`,
    )
  }
}

function assertPositiveInteger(value: number, field: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw createDocumentError().invalidInput(
      `${field} must be a positive integer`,
    )
  }
}

function requireNonEmpty(value: string, field: string) {
  const normalized = value.trim()
  if (!normalized) {
    throw createDocumentError().invalidInput(`${field} is required`)
  }

  return normalized
}

function normalizeNullableString(
  value: string | null,
  field: string,
): string | null {
  if (value === null) {
    return null
  }

  const normalized = value.trim()
  if (!normalized) {
    throw createDocumentError().invalidInput(`${field} cannot be empty`)
  }

  return normalized
}

function normalizeDocumentPath(path: string) {
  const normalized = requireNonEmpty(path, "path")
  if (!isDocumentPathWithinWorkspace(normalized)) {
    throw createDocumentError().invalidPath(
      "document path must stay within project .harbor workspace",
    )
  }

  return normalized
}
