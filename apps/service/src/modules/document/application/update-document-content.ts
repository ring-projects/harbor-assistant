import { reviseDocument } from "../domain/document"
import { createDocumentError, isDocumentError } from "../errors"
import type { DocumentContentStore } from "./document-content-store"
import type { DocumentRepository } from "./document-repository"
import type { ProjectDocumentPort } from "./project-document-port"

export async function updateDocumentContentUseCase(
  args: {
    repository: DocumentRepository
    contentStore: DocumentContentStore
    projectDocumentPort: ProjectDocumentPort
    now?: () => Date
  },
  input: {
    documentId: string
    content: string
    summary?: string | null
  },
) {
  const current = await args.repository.findById(input.documentId)
  if (!current) {
    throw createDocumentError().notFound()
  }

  const project = await args.projectDocumentPort.getProjectForDocument(
    current.projectId,
  )
  if (!project) {
    throw createDocumentError().projectNotFound()
  }

  const next = {
    ...reviseDocument(current, args.now?.() ?? new Date()),
    summary: input.summary === undefined ? current.summary : input.summary,
  }

  try {
    await args.contentStore.write({
      projectRootPath: project.rootPath,
      path: next.path,
      format: next.format,
      content: input.content,
    })
    await args.repository.save(next)
  } catch (error) {
    if (isDocumentError(error)) {
      throw error
    }

    throw createDocumentError().conflict(
      error instanceof Error ? error.message : "document update failed",
    )
  }

  return next
}
