import { createDocumentError } from "../errors"
import type { DocumentRepository } from "./document-repository"

export async function getDocumentUseCase(
  repository: DocumentRepository,
  documentId: string,
) {
  const document = await repository.findById(documentId)
  if (!document) {
    throw createDocumentError().notFound()
  }

  return document
}
