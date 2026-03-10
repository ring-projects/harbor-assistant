export type Project = {
  id: string
  name: string
  slug: string | null
  rootPath: string
  normalizedPath: string
  description: string | null
  status: "active" | "archived" | "missing"
  lastOpenedAt: string | null
  updatedAt: string
  archivedAt: string | null
  path: string
  createdAt: string
}
