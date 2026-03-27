import { createDocument } from "../domain/document"
import { createDocumentError, isDocumentError } from "../errors"
import type { DocumentContentStore } from "./document-content-store"
import type { DocumentRepository } from "./document-repository"
import type { ProjectDocumentPort } from "./project-document-port"

export async function createDocumentUseCase(
  args: {
    repository: DocumentRepository
    contentStore: DocumentContentStore
    projectDocumentPort: ProjectDocumentPort
    idGenerator: () => string
    now?: () => Date
  },
  input: {
    projectId: string
    taskId?: string | null
    kind: Parameters<typeof createDocument>[0]["kind"]
    title: string
    path: string
    format: Parameters<typeof createDocument>[0]["format"]
    content: string
    summary?: string | null
  },
) {
  const project = await args.projectDocumentPort.getProjectForDocument(
    input.projectId,
  )
  if (!project) {
    throw createDocumentError().projectNotFound()
  }

  const now = args.now?.() ?? new Date()
  const document = createDocument({
    id: args.idGenerator(),
    projectId: input.projectId,
    taskId: input.taskId ?? null,
    kind: input.kind,
    title: input.title,
    path: input.path,
    format: input.format,
    summary: input.summary ?? null,
    createdAt: now,
    updatedAt: now,
  })

  try {
    await args.repository.create(document)
    await args.contentStore.write({
      projectRootPath: project.rootPath,
      path: document.path,
      format: document.format,
      content: input.content,
    })
  } catch (error) {
    await args.repository.delete(document.id)
    throw normalizeDocumentUseCaseError(error)
  }

  return document
}

function normalizeDocumentUseCaseError(error: unknown) {
  if (isDocumentError(error)) {
    return error
  }

  return createDocumentError().conflict(
    error instanceof Error ? error.message : "document create failed",
  )
}
