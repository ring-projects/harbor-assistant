import type { Document } from "../domain/document"

export interface DocumentRepository {
  create(document: Document): Promise<void>
  findById(documentId: string): Promise<Document | null>
  save(document: Document): Promise<void>
  delete(documentId: string): Promise<void>
  listByProject(input: {
    projectId: string
    includeArchived?: boolean
    kind?: Document["kind"]
  }): Promise<Document[]>
  listByTask(input: {
    taskId: string
    includeArchived?: boolean
    kind?: Document["kind"]
  }): Promise<Document[]>
}
