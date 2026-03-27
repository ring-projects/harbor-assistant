import type { DocumentRepository } from "./document-repository"

export async function listProjectDocumentsUseCase(
  repository: DocumentRepository,
  input: {
    projectId: string
    includeArchived?: boolean
    kind?: import("../domain/document").DocumentKind
  },
) {
  return repository.listByProject(input)
}
