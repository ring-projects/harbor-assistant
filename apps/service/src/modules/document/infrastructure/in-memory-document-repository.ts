import type { Document } from "../domain/document"
import type { DocumentRepository } from "../application/document-repository"

export class InMemoryDocumentRepository implements DocumentRepository {
  private readonly documents = new Map<string, Document>()

  constructor(seed: Document[] = []) {
    for (const document of seed) {
      this.documents.set(document.id, document)
    }
  }

  async create(document: Document): Promise<void> {
    this.documents.set(document.id, document)
  }

  async findById(documentId: string): Promise<Document | null> {
    return this.documents.get(documentId) ?? null
  }

  async save(document: Document): Promise<void> {
    this.documents.set(document.id, document)
  }

  async delete(documentId: string): Promise<void> {
    this.documents.delete(documentId)
  }

  async listByProject(input: {
    projectId: string
    includeArchived?: boolean
    kind?: Document["kind"]
  }): Promise<Document[]> {
    return [...this.documents.values()]
      .filter((document) => document.projectId === input.projectId)
      .filter(
        (document) => input.includeArchived || document.status !== "archived",
      )
      .filter((document) => (input.kind ? document.kind === input.kind : true))
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      )
  }

  async listByTask(input: {
    taskId: string
    includeArchived?: boolean
    kind?: Document["kind"]
  }): Promise<Document[]> {
    return [...this.documents.values()]
      .filter((document) => document.taskId === input.taskId)
      .filter(
        (document) => input.includeArchived || document.status !== "archived",
      )
      .filter((document) => (input.kind ? document.kind === input.kind : true))
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      )
  }
}
