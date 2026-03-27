export type DocumentProjectReference = {
  projectId: string
  rootPath: string
}

export interface ProjectDocumentPort {
  getProjectForDocument(projectId: string): Promise<DocumentProjectReference | null>
}
