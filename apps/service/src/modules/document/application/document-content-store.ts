export interface DocumentContentStore {
  write(input: {
    projectRootPath: string
    path: string
    format: "markdown" | "json"
    content: string
  }): Promise<void>
  read(input: { projectRootPath: string; path: string }): Promise<{
    path: string
    format: "markdown" | "json"
    content: string
  }>
  delete(input: { projectRootPath: string; path: string }): Promise<void>
}
