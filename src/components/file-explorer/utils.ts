const IMAGE_FILE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "bmp",
  "ico",
  "avif",
  "tiff",
  "tif",
])

export function isImageFileName(name: string) {
  const extension = name.split(".").pop()?.toLowerCase()
  if (!extension) {
    return false
  }

  return IMAGE_FILE_EXTENSIONS.has(extension)
}

export function getTreeNodePadding(level: number) {
  return `${Math.max(level, 0) * 16 + 8}px`
}
