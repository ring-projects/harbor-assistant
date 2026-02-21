export type MarkdownDocument = {
  name: string
  relativePath: string
  absolutePath: string
}

export type ListMarkdownDocumentsResult = {
  rootPath: string
  truncated: boolean
  documents: MarkdownDocument[]
}

export type ReadMarkdownDocumentResult = {
  rootPath: string
  relativePath: string
  absolutePath: string
  content: string
}

export type DocumentServiceErrorCode =
  | "ROOT_NOT_FOUND"
  | "ROOT_NOT_DIRECTORY"
  | "INVALID_DOCUMENT_PATH"
  | "DOCUMENT_NOT_FOUND"
  | "DOCUMENT_NOT_FILE"
  | "NOT_MARKDOWN_FILE"
  | "READ_ERROR"
