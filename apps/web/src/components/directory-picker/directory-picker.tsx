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
import {
  buildBreadcrumbSegments,
  getDirectoryPickerErrorMessage,
} from "./directory-picker-utils"
import { useDirectoryEntriesQuery } from "./hooks/use-directory-entries-query"
import { useDirectoryPickerStore } from "./hooks/use-directory-picker-store"
import { DirectoryPickerProvider } from "./providers/directory-picker-provider"
import type { DirectoryPickerProps } from "./types"

function DirectoryPickerInner({
  className,
  title = null,
  helperText = null,
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

  const directoryEntries = useMemo(
    () => (query.data?.entries ?? []).filter((entry) => entry.type === "directory"),
    [query.data?.entries],
  )
  const currentResolvedPath = query.data?.path ?? currentPath

  useEffect(() => {
    if (query.data && !rootPath) {
      setRootPath(query.data.path)
    }
  }, [query.data, rootPath, setRootPath])

  useEffect(() => {
    if (
      !selectedPath ||
      directoryEntries.some((entry) => entry.path === selectedPath)
    ) {
      return
    }

    setSelectedPath(null)
    setActiveIndex(-1)
  }, [directoryEntries, selectedPath, setActiveIndex, setSelectedPath])

  const breadcrumbSegments = useMemo(
    () =>
      currentResolvedPath
        ? buildBreadcrumbSegments(currentResolvedPath, rootPath)
        : [],
    [currentResolvedPath, rootPath],
  )

  async function handleConfirm() {
    if (!selectedPath || !query.data || disabled || isSubmitting || query.isLoading) {
      return
    }

    setActionError(null)
    setSubmitting(true)
    try {
      await onConfirm({
        rootId: query.data.rootId,
        rootPath: query.data.rootPath,
        path: selectedPath,
      })
    } catch (error) {
      setActionError(getDirectoryPickerErrorMessage(error))
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
    if (!directoryEntries.length || disabled || isSubmitting) {
      return
    }

    if (event.key === "ArrowDown") {
      event.preventDefault()
      const nextIndex = Math.min(
        directoryEntries.length - 1,
        activeIndex < 0 ? 0 : activeIndex + 1,
      )
      setActiveIndex(nextIndex)
      setSelectedPath(directoryEntries[nextIndex]?.path ?? null)
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      const nextIndex = Math.max(0, activeIndex <= 0 ? 0 : activeIndex - 1)
      setActiveIndex(nextIndex)
      setSelectedPath(directoryEntries[nextIndex]?.path ?? null)
      return
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault()
      const targetPath = directoryEntries[activeIndex]?.path
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
        "flex max-h-[70svh] flex-col",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b px-5 py-2.5">
        <div className="min-w-0">
          {title ? (
            <p className="mb-2 text-sm font-medium text-muted-foreground">
              {title}
            </p>
          ) : null}
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbSegments.map((segment, index) => {
                const isLast = index === breadcrumbSegments.length - 1
                return (
                  <BreadcrumbItem key={segment.path}>
                    {isLast ? (
                      <BreadcrumbPage className="text-sm">
                        {segment.label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <button
                          type="button"
                          className="cursor-pointer text-sm"
                          onClick={() => handleEnterDirectory(segment.path)}
                          disabled={disabled || isSubmitting}
                        >
                          {segment.label}
                        </button>
                      </BreadcrumbLink>
                    )}
                    {!isLast ? <BreadcrumbSeparator>/</BreadcrumbSeparator> : null}
                  </BreadcrumbItem>
                )
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        {helperText ? (
          <p className="text-sm text-muted-foreground">{helperText}</p>
        ) : null}
      </div>

      <div
        className="min-h-0 flex-1"
        role="listbox"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-label="Directory list"
      >
        <ScrollArea className="h-full min-h-0" viewportClassName="h-full min-h-0">
          <div className="py-0">
            {query.isLoading ? (
              <div className="space-y-3 px-6 py-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-10 w-full" />
                ))}
              </div>
            ) : null}

            {!query.isLoading && query.isError ? (
              <div className="px-6 py-6 text-sm">
                <p className="text-destructive">
                  {getDirectoryPickerErrorMessage(query.error)}
                </p>
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

            {!query.isLoading && !query.isError && directoryEntries.length === 0 ? (
              <p className="px-6 py-6 text-sm text-muted-foreground">
                No directories found in this path.
              </p>
            ) : null}

            {!query.isLoading && !query.isError && directoryEntries.length > 0
              ? directoryEntries.map((entry, index) => {
                  const isSelected = selectedPath === entry.path
                  return (
                    <button
                      key={entry.path}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-5 py-2 text-left",
                        "hover:bg-muted/50 transition-colors",
                        isSelected &&
                          "bg-accent text-accent-foreground hover:bg-accent",
                      )}
                      onClick={() => handleSelect(entry.path, index)}
                      onDoubleClick={() => handleEnterDirectory(entry.path)}
                      disabled={disabled || isSubmitting}
                    >
                      <FolderIcon className="size-4 shrink-0" />
                      <span className="truncate text-sm font-medium">
                        {entry.name}
                      </span>
                    </button>
                  )
                })
              : null}
          </div>
        </ScrollArea>
      </div>

      <div className="flex items-center justify-between gap-2 border-t px-5 py-2.5">
        <p className="min-h-5 text-sm text-destructive">{actionError ?? ""}</p>
        <div className="flex items-center gap-3">
          {onCancel ? (
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              disabled={disabled || isSubmitting}
            >
              {cancelLabel}
            </Button>
          ) : null}
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
