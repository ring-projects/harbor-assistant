import type { DocumentRepository } from "./document-repository"

export async function listTaskDocumentsUseCase(
  repository: DocumentRepository,
  input: {
    taskId: string
    includeArchived?: boolean
    kind?: import("../domain/document").DocumentKind
  },
) {
  return repository.listByTask(input)
}
