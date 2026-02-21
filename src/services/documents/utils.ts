import path from "node:path"

export function toUnixPath(value: string) {
  return value.split(path.sep).join("/")
}

export function isMarkdownFileName(name: string) {
  return name.toLowerCase().endsWith(".md")
}

export function normalizeRelativeDocumentPath(value: string) {
  return toUnixPath(value.trim()).replace(/^\/+/, "")
}

export function isPathInsideRoot(rootPath: string, absolutePath: string) {
  const relative = path.relative(rootPath, absolutePath)
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}
