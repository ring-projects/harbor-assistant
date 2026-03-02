"use client"

import { useEffect, useMemo, type KeyboardEvent } from "react"
import { FolderIcon } from "lucide-react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useDirectoryEntriesQuery } from "./hooks/use-directory-entries-query"
import { useDirectoryPickerStore } from "./hooks/use-directory-picker-store"
import { DirectoryPickerProvider } from "./providers/directory-picker-provider"
import type { DirectoryPickerProps } from "./types"

type BreadcrumbSegment = {
  label: string
  path: string
}

function appendPathSegment(parentPath: string, segment: string) {
  if (parentPath === "/") {
    return `/${segment}`
  }

  return `${parentPath}/${segment}`
}

function normalizePathForCompare(path: string) {
  if (path === "/") {
    return "/"
  }

  return path.replace(/\/+$/, "")
}

function isSameOrChildPath(path: string, parentPath: string) {
  const normalizedPath = normalizePathForCompare(path)
  const normalizedParentPath = normalizePathForCompare(parentPath)

  return (
    normalizedPath === normalizedParentPath ||
    normalizedPath.startsWith(`${normalizedParentPath}/`)
  )
}

function buildBreadcrumbSegments(
  currentPath: string,
  rootPath: string | null,
): BreadcrumbSegment[] {
  if (!rootPath || !isSameOrChildPath(currentPath, rootPath)) {
    return [{ label: currentPath, path: currentPath }]
  }

  const normalizedCurrent = normalizePathForCompare(currentPath)
  const normalizedRoot = normalizePathForCompare(rootPath)
  const relative = normalizedCurrent
    .slice(normalizedRoot.length)
    .replace(/^\/+/, "")

  const segments: BreadcrumbSegment[] = [{ label: "Local", path: normalizedRoot }]

  if (!relative) {
    return segments
  }

  let accumulator = normalizedRoot
  for (const segment of relative.split("/").filter(Boolean)) {
    accumulator = appendPathSegment(accumulator, segment)
    segments.push({
      label: segment,
      path: accumulator,
    })
  }

  return segments
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return "Request failed."
}

function DirectoryPickerInner({
  className,
  title = "Directory",
  helperText = "Select a folder to start",
  confirmLabel = "Confirm and Launch",
  cancelLabel = "Cancel",
  includeHidden = false,
  pageSize = 200,
  disabled = false,
  onConfirm,
  onCancel,
}: Omit<DirectoryPickerProps, "initialPath">) {
  const currentPath = useDirectoryPickerStore((state) => state.currentPath)
  const rootPath = useDirectoryPickerStore((state) => state.rootPath)
  const selectedPath = useDirectoryPickerStore((state) => state.selectedPath)
  const activeIndex = useDirectoryPickerStore((state) => state.activeIndex)
  const isSubmitting = useDirectoryPickerStore((state) => state.isSubmitting)
  const actionError = useDirectoryPickerStore((state) => state.actionError)
  const setCurrentPath = useDirectoryPickerStore((state) => state.setCurrentPath)
  const setRootPath = useDirectoryPickerStore((state) => state.setRootPath)
  const setSelectedPath = useDirectoryPickerStore(
    (state) => state.setSelectedPath,
  )
  const setActiveIndex = useDirectoryPickerStore((state) => state.setActiveIndex)
  const setSubmitting = useDirectoryPickerStore((state) => state.setSubmitting)
  const setActionError = useDirectoryPickerStore((state) => state.setActionError)

  const query = useDirectoryEntriesQuery({
    path: currentPath,
    includeHidden,
    pageSize,
  })

  const listEntries = query.data?.entries ?? []
  const currentResolvedPath = query.data?.path ?? currentPath

  useEffect(() => {
    if (query.data && !rootPath) {
      setRootPath(query.data.path)
    }
  }, [query.data, rootPath, setRootPath])

  useEffect(() => {
    if (!selectedPath || listEntries.some((entry) => entry.path === selectedPath)) {
      return
    }

    setSelectedPath(null)
    setActiveIndex(-1)
  }, [listEntries, selectedPath, setActiveIndex, setSelectedPath])

  const breadcrumbSegments = useMemo(
    () =>
      currentResolvedPath
        ? buildBreadcrumbSegments(currentResolvedPath, rootPath)
        : [],
    [currentResolvedPath, rootPath],
  )

  async function handleConfirm() {
    if (!selectedPath || disabled || isSubmitting || query.isLoading) {
      return
    }

    setActionError(null)
    setSubmitting(true)
    try {
      await onConfirm(selectedPath)
    } catch (error) {
      setActionError(toErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  function handleSelect(path: string, index: number) {
    if (disabled || isSubmitting) {
      return
    }

    setActionError(null)
    setSelectedPath(path)
    setActiveIndex(index)
  }

  function handleEnterDirectory(path: string) {
    if (disabled || isSubmitting) {
      return
    }

    setActionError(null)
    setCurrentPath(path)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!listEntries.length || disabled || isSubmitting) {
      return
    }

    if (event.key === "ArrowDown") {
      event.preventDefault()
      const nextIndex = Math.min(
        listEntries.length - 1,
        activeIndex < 0 ? 0 : activeIndex + 1,
      )
      setActiveIndex(nextIndex)
      setSelectedPath(listEntries[nextIndex]?.path ?? null)
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      const nextIndex = Math.max(0, activeIndex <= 0 ? 0 : activeIndex - 1)
      setActiveIndex(nextIndex)
      setSelectedPath(listEntries[nextIndex]?.path ?? null)
      return
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault()
      const targetPath = listEntries[activeIndex]?.path
      if (targetPath) {
        handleEnterDirectory(targetPath)
      }
      return
    }

    if (event.key === "Backspace" && query.data?.parentPath) {
      event.preventDefault()
      handleEnterDirectory(query.data.parentPath)
    }
  }

  return (
    <div
      className={cn(
        "bg-card overflow-hidden rounded-xl border",
        "flex min-h-[500px] flex-col",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b px-6 py-5">
        <div className="min-w-0">
          <p className="mb-2 text-sm font-medium text-muted-foreground">{title}</p>
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbSegments.map((segment, index) => {
                const isLast = index === breadcrumbSegments.length - 1
                return (
                  <BreadcrumbItem key={segment.path}>
                    {isLast ? (
                      <BreadcrumbPage className="font-mono text-sm">
                        {segment.label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <button
                          type="button"
                          className="cursor-pointer font-mono text-sm"
                          onClick={() => handleEnterDirectory(segment.path)}
                          disabled={disabled || isSubmitting}
                        >
                          {segment.label}
                        </button>
                      </BreadcrumbLink>
                    )}
                    {!isLast ? <BreadcrumbSeparator /> : null}
                  </BreadcrumbItem>
                )
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <p className="text-sm text-muted-foreground">{helperText}</p>
      </div>

      <div
        className="flex-1"
        role="listbox"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-label="Directory list"
      >
        <ScrollArea className="h-[320px]">
          <div className="py-3">
            {query.isLoading ? (
              <div className="space-y-3 px-6 py-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-10 w-full" />
                ))}
              </div>
            ) : null}

            {!query.isLoading && query.isError ? (
              <div className="px-6 py-6 text-sm">
                <p className="text-destructive">{toErrorMessage(query.error)}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => query.refetch()}
                >
                  Retry
                </Button>
              </div>
            ) : null}

            {!query.isLoading && !query.isError && listEntries.length === 0 ? (
              <p className="px-6 py-6 text-sm text-muted-foreground">
                No directories found in this path.
              </p>
            ) : null}

            {!query.isLoading && !query.isError && listEntries.length > 0
              ? listEntries.map((entry, index) => {
                  const isSelected = selectedPath === entry.path
                  return (
                    <button
                      key={entry.path}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={cn(
                        "flex w-full items-center gap-4 px-6 py-3 text-left",
                        "hover:bg-muted/50 transition-colors",
                        isSelected && "bg-blue-50 text-blue-700 hover:bg-blue-50",
                      )}
                      onClick={() => handleSelect(entry.path, index)}
                      onDoubleClick={() => handleEnterDirectory(entry.path)}
                      disabled={disabled || isSubmitting}
                    >
                      <FolderIcon className="size-6 shrink-0" />
                      <span className="truncate text-2xl font-medium">
                        {entry.name}
                      </span>
                    </button>
                  )
                })
              : null}
          </div>
        </ScrollArea>
      </div>

      <div className="flex items-center justify-between gap-2 border-t px-6 py-5">
        <p className="min-h-5 text-sm text-destructive">{actionError ?? ""}</p>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={disabled || isSubmitting}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={
              disabled ||
              isSubmitting ||
              query.isLoading ||
              query.isError ||
              !selectedPath
            }
          >
            {isSubmitting ? "Launching..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function DirectoryPicker(props: DirectoryPickerProps) {
  const { initialPath, ...rest } = props

  return (
    <DirectoryPickerProvider initialPath={initialPath}>
      <DirectoryPickerInner {...rest} />
    </DirectoryPickerProvider>
  )
}
