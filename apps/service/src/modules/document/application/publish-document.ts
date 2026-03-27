import { publishDocument } from "../domain/document"
import { createDocumentError } from "../errors"
import type { DocumentRepository } from "./document-repository"

export async function publishDocumentUseCase(
  repository: DocumentRepository,
  input: {
    documentId: string
    now?: Date
  },
) {
  const current = await repository.findById(input.documentId)
  if (!current) {
    throw createDocumentError().notFound()
  }

  const next = publishDocument(current, input.now)
  await repository.save(next)
  return next
}
