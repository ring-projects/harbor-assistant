import { createDocumentError, isDocumentError } from "../errors"
import type { DocumentContentStore } from "./document-content-store"
import type { DocumentRepository } from "./document-repository"
import type { ProjectDocumentPort } from "./project-document-port"

export async function readDocumentContentUseCase(
  args: {
    repository: DocumentRepository
    contentStore: DocumentContentStore
    projectDocumentPort: ProjectDocumentPort
  },
  documentId: string,
) {
  const document = await args.repository.findById(documentId)
  if (!document) {
    throw createDocumentError().notFound()
  }

  const project = await args.projectDocumentPort.getProjectForDocument(
    document.projectId,
  )
  if (!project) {
    throw createDocumentError().projectNotFound()
  }

  try {
    return await args.contentStore.read({
      projectRootPath: project.rootPath,
      path: document.path,
    })
  } catch (error) {
    if (isDocumentError(error)) {
      throw error
    }

    throw createDocumentError().contentMissing(
      error instanceof Error ? error.message : "document content not found",
    )
  }
}
