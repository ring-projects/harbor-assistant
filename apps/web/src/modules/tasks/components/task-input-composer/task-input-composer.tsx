"use client"

import { PaperclipIcon } from "lucide-react"
import {
  useId,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react"

import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { ActionButton } from "./action-button"

type TaskInputComposerProps = {
  canSubmit: boolean
  actionMode?: "send" | "break"
  actionDisabled?: boolean
  inputDisabled: boolean
  isSubmitting: boolean
  autoFocus?: boolean
  placeholder: string
  value: string
  errorMessage: string | null
  attachments?: ReactNode
  controls?: ReactNode
  onChange: (value: string) => void
  onPasteFiles?: (files: File[]) => void
  onDropFiles?: (files: File[]) => void
  onAction?: () => void
  onSubmit: () => void
}

function extractFiles(items: DataTransferItemList | null) {
  if (!items) {
    return []
  }

  return Array.from(items)
    .filter((item) => item.kind === "file")
    .flatMap((item) => {
      const file = item.getAsFile()
      return file ? [file] : []
    })
}

export function TaskInputComposer(props: TaskInputComposerProps) {
  const textareaId = useId()
  const errorTextId = useId()
  const isComposingRef = useRef(false)
  const dragDepthRef = useRef(0)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const actionMode = props.actionMode ?? "send"
  const actionDisabled =
    props.actionDisabled ?? (!props.canSubmit || props.isSubmitting)

  function handleCompositionStart() {
    isComposingRef.current = true
  }

  function handleCompositionEnd() {
    isComposingRef.current = false
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const nativeEvent =
      event.nativeEvent as KeyboardEvent<HTMLTextAreaElement>["nativeEvent"] & {
        isComposing?: boolean
        keyCode?: number
      }
    const isImeConfirming =
      isComposingRef.current ||
      nativeEvent.isComposing === true ||
      nativeEvent.keyCode === 229

    const isSubmitShortcut =
      event.key === "Enter" && (event.metaKey || event.ctrlKey)

    if (!isSubmitShortcut || isImeConfirming) {
      return
    }

    event.preventDefault()
    if (props.canSubmit && !props.isSubmitting) {
      props.onSubmit()
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    if (!props.onPasteFiles) {
      return
    }

    const files = extractFiles(event.clipboardData.items)

    if (files.length === 0) {
      return
    }

    props.onPasteFiles(files)
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    if (!props.onDropFiles || props.inputDisabled || props.isSubmitting) {
      return
    }

    const files = extractFiles(event.dataTransfer.items)
    if (files.length === 0) {
      return
    }

    dragDepthRef.current += 1
    setIsDraggingFile(true)
    event.preventDefault()
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (!props.onDropFiles || props.inputDisabled || props.isSubmitting) {
      return
    }

    const files = extractFiles(event.dataTransfer.items)
    if (files.length === 0) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = "copy"
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    if (!props.onDropFiles || props.inputDisabled || props.isSubmitting) {
      return
    }

    const files = extractFiles(event.dataTransfer.items)
    if (files.length === 0) {
      return
    }

    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) {
      setIsDraggingFile(false)
    }

    event.preventDefault()
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    if (!props.onDropFiles || props.inputDisabled || props.isSubmitting) {
      return
    }

    const files = extractFiles(event.dataTransfer.items)
    dragDepthRef.current = 0
    setIsDraggingFile(false)

    if (files.length === 0) {
      return
    }

    event.preventDefault()
    props.onDropFiles(files)
  }

  return (
    <div
      className={cn(
        "bg-muted/80 relative overflow-hidden rounded-xl transition-colors",
        isDraggingFile && "bg-muted/34 ring-foreground/12 ring-1",
      )}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDraggingFile ? (
        <div className="bg-background/90 pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-lg backdrop-blur-sm">
          <div className="bg-muted/55 text-foreground flex items-center gap-2 rounded-md px-3 py-2 font-mono text-[12px]">
            <PaperclipIcon className="text-muted-foreground size-4" />
            <span>Drop files to attach</span>
          </div>
        </div>
      ) : null}

      <div className="relative flex min-h-42 flex-col gap-3 p-3">
        <Textarea
          id={textareaId}
          autoFocus={props.autoFocus}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={props.placeholder}
          disabled={props.inputDisabled || props.isSubmitting}
          aria-label="Task prompt"
          aria-describedby={props.errorMessage ? errorTextId : undefined}
          aria-invalid={props.errorMessage ? true : undefined}
          className={cn(
            "field-sizing-fixed max-h-[40svh] min-h-24 resize-none overflow-y-auto border-0 bg-transparent px-0 py-0 leading-6 shadow-none focus-visible:ring-0 dark:bg-transparent",
          )}
        />

        {props.errorMessage ? (
          <div
            id={errorTextId}
            className="bg-surface-danger text-destructive border-destructive/25 rounded-md border px-3 py-2 font-mono text-[11px]"
          >
            {props.errorMessage}
          </div>
        ) : null}

        {props.attachments ? props.attachments : null}

        <div className="flex items-end justify-between gap-3 pt-3">
          <div className="min-w-0 flex-1 space-y-2.5">
            {props.controls ? (
              <div className="flex flex-wrap items-center gap-2">
                {props.controls}
              </div>
            ) : null}
          </div>

          <ActionButton
            mode={actionMode}
            disabled={actionDisabled}
            onClick={props.onAction ?? props.onSubmit}
          />
        </div>
      </div>
    </div>
  )
}
