export const DOCUMENT_ERROR_CODES = {
  INVALID_INPUT: "INVALID_INPUT",
  INVALID_PATH: "INVALID_PATH",
  INVALID_KIND: "INVALID_KIND",
  INVALID_FORMAT: "INVALID_FORMAT",
  INVALID_STATE: "INVALID_STATE",
  ARCHIVED: "ARCHIVED",
  NOT_FOUND: "NOT_FOUND",
  PROJECT_NOT_FOUND: "PROJECT_NOT_FOUND",
  CONTENT_MISSING: "CONTENT_MISSING",
  CONFLICT: "CONFLICT",
} as const

export type DocumentErrorCode =
  (typeof DOCUMENT_ERROR_CODES)[keyof typeof DOCUMENT_ERROR_CODES]

export class DocumentError extends Error {
  readonly code: DocumentErrorCode

  constructor(code: DocumentErrorCode, message: string) {
    super(message)
    this.name = "DocumentError"
    this.code = code
  }
}

export function createDocumentError() {
  return {
    invalidInput(message: string) {
      return new DocumentError(DOCUMENT_ERROR_CODES.INVALID_INPUT, message)
    },
    invalidPath(message: string) {
      return new DocumentError(DOCUMENT_ERROR_CODES.INVALID_PATH, message)
    },
    invalidKind(message: string) {
      return new DocumentError(DOCUMENT_ERROR_CODES.INVALID_KIND, message)
    },
    invalidFormat(message: string) {
      return new DocumentError(DOCUMENT_ERROR_CODES.INVALID_FORMAT, message)
    },
    invalidState(message: string) {
      return new DocumentError(DOCUMENT_ERROR_CODES.INVALID_STATE, message)
    },
    archived(message = "document is archived") {
      return new DocumentError(DOCUMENT_ERROR_CODES.ARCHIVED, message)
    },
    notFound(message = "document not found") {
      return new DocumentError(DOCUMENT_ERROR_CODES.NOT_FOUND, message)
    },
    projectNotFound(message = "project not found") {
      return new DocumentError(DOCUMENT_ERROR_CODES.PROJECT_NOT_FOUND, message)
    },
    contentMissing(message = "document content not found") {
      return new DocumentError(DOCUMENT_ERROR_CODES.CONTENT_MISSING, message)
    },
    conflict(message = "document conflict") {
      return new DocumentError(DOCUMENT_ERROR_CODES.CONFLICT, message)
    },
  }
}

export function isDocumentError(error: unknown): error is DocumentError {
  return error instanceof DocumentError
}
