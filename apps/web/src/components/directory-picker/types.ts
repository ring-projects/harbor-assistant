export type DirectoryEntry = {
  name: string
  path: string
  type: "directory" | "file"
  isHidden: boolean
  isSymlink: boolean
  size: number | null
  mtime: string | null
}

export type DirectoryRoot = {
  id: string
  label: string
  path: string
  isDefault: boolean
}

export type DirectoryListSuccessResponse = {
  ok: true
  rootId: string
  rootPath: string
  path: string
  parentPath: string | null
  entries: DirectoryEntry[]
  nextCursor: string | null
  truncated: boolean
}

export type DirectoryPickerSelection = {
  rootId: string
  rootPath: string
  path: string
}

export type DirectoryListErrorResponse = {
  ok: false
  error?: {
    code?: string
    message?: string
  }
}

export type DirectoryPickerProps = {
  className?: string
  title?: string | null
  helperText?: string | null
  confirmLabel?: string
  cancelLabel?: string
  initialPath?: string
  includeHidden?: boolean
  pageSize?: number
  disabled?: boolean
  onConfirm: (selection: DirectoryPickerSelection) => Promise<void> | void
  onCancel?: () => void
}

export type DirectoryPickerStoreState = {
  currentPath: string | null
  rootPath: string | null
  selectedPath: string | null
  activeIndex: number
  isSubmitting: boolean
  actionError: string | null
  setCurrentPath: (path: string | null) => void
  setRootPath: (path: string) => void
  setSelectedPath: (path: string | null) => void
  setActiveIndex: (index: number) => void
  setSubmitting: (submitting: boolean) => void
  setActionError: (message: string | null) => void
}
