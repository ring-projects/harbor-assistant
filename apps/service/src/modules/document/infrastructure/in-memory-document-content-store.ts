import { createDocumentError } from "../errors"
import type { DocumentContentStore } from "../application/document-content-store"

type ContentRecord = {
  path: string
  format: "markdown" | "json"
  content: string
}

export class InMemoryDocumentContentStore implements DocumentContentStore {
  private readonly contents = new Map<string, ContentRecord>()

  constructor(seed: ContentRecord[] = []) {
    for (const record of seed) {
      this.contents.set(record.path, record)
    }
  }

  async write(input: {
    projectRootPath: string
    path: string
    format: "markdown" | "json"
    content: string
  }): Promise<void> {
    this.contents.set(this.toStorageKey(input.projectRootPath, input.path), {
      path: input.path,
      format: input.format,
      content: input.content,
    })
  }

  async read(input: {
    projectRootPath: string
    path: string
  }): Promise<ContentRecord> {
    const content = this.contents.get(
      this.toStorageKey(input.projectRootPath, input.path),
    )
    if (!content) {
      throw createDocumentError().contentMissing()
    }

    return content
  }

  async delete(input: {
    projectRootPath: string
    path: string
  }): Promise<void> {
    this.contents.delete(this.toStorageKey(input.projectRootPath, input.path))
  }

  private toStorageKey(projectRootPath: string, path: string) {
    return `${projectRootPath}:${path}`
  }
}
