"use client"

import { ImageIcon } from "lucide-react"
import {
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

type ChatInteractionProps = {
  canSubmit: boolean
  actionMode?: "send" | "break"
  actionDisabled?: boolean
  inputDisabled: boolean
  isSubmitting: boolean
  autoFocus?: boolean
  helperText: string
  placeholder: string
  value: string
  errorMessage: string | null
  attachments?: ReactNode
  controls?: ReactNode
  footer?: ReactNode
  onChange: (value: string) => void
  onPasteFiles?: (files: File[]) => void
  onDropFiles?: (files: File[]) => void
  onAction?: () => void
  onSubmit: () => void
}

function extractImageFiles(items: DataTransferItemList | null) {
  if (!items) {
    return []
  }

  return Array.from(items)
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .flatMap((item) => {
      const file = item.getAsFile()
      return file ? [file] : []
    })
}

export function ChatInteraction(props: ChatInteractionProps) {
  const isComposingRef = useRef(false)
  const dragDepthRef = useRef(0)
  const [isDraggingImage, setIsDraggingImage] = useState(false)
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
    const nativeEvent = event.nativeEvent as KeyboardEvent<HTMLTextAreaElement>["nativeEvent"] & {
      isComposing?: boolean
      keyCode?: number
    }
    const isImeConfirming =
      isComposingRef.current ||
      nativeEvent.isComposing === true ||
      nativeEvent.keyCode === 229

    if (event.key === "Enter" && !event.shiftKey) {
      if (isImeConfirming) {
        return
      }

      event.preventDefault()
      if (props.canSubmit && !props.isSubmitting) {
        props.onSubmit()
      }
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    if (!props.onPasteFiles) {
      return
    }

    const files = extractImageFiles(event.clipboardData.items)

    if (files.length === 0) {
      return
    }

    event.preventDefault()
    props.onPasteFiles(files)
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    if (!props.onDropFiles || props.inputDisabled || props.isSubmitting) {
      return
    }

    const files = extractImageFiles(event.dataTransfer.items)
    if (files.length === 0) {
      return
    }

    dragDepthRef.current += 1
    setIsDraggingImage(true)
    event.preventDefault()
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (!props.onDropFiles || props.inputDisabled || props.isSubmitting) {
      return
    }

    const files = extractImageFiles(event.dataTransfer.items)
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

    const files = extractImageFiles(event.dataTransfer.items)
    if (files.length === 0) {
      return
    }

    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) {
      setIsDraggingImage(false)
    }

    event.preventDefault()
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    if (!props.onDropFiles || props.inputDisabled || props.isSubmitting) {
      return
    }

    const files = extractImageFiles(event.dataTransfer.items)
    dragDepthRef.current = 0
    setIsDraggingImage(false)

    if (files.length === 0) {
      return
    }

    event.preventDefault()
    props.onDropFiles(files)
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-muted/16 transition-colors",
        isDraggingImage && "bg-muted/34 ring-1 ring-foreground/12",
      )}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDraggingImage ? (
        <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-lg bg-background/90 backdrop-blur-sm">
          <div className="flex items-center gap-2 rounded-md bg-muted/55 px-3 py-2 font-mono text-[12px] text-foreground">
            <ImageIcon className="size-4 text-muted-foreground" />
            <span>Drop images to attach</span>
          </div>
        </div>
      ) : null}

      <div className="relative flex min-h-[168px] flex-col gap-3 p-3">
        <div className="text-muted-foreground flex items-center gap-2 font-mono text-[11px] leading-5">
          <span className="text-foreground/80">{">"}</span>
          <span>input</span>
          <span className="opacity-50">·</span>
          <span>enter to send</span>
          <span className="opacity-50">·</span>
          <span>shift+enter for newline</span>
        </div>

        <Textarea
          autoFocus={props.autoFocus}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={props.placeholder}
          disabled={props.inputDisabled || props.isSubmitting}
          className="min-h-[96px] resize-none border-0 bg-transparent px-0 py-0 font-mono text-[13px] leading-6 shadow-none focus-visible:ring-0 dark:bg-transparent"
        />

        {props.errorMessage ? (
          <div className="rounded-md border border-rose-300/70 bg-rose-50/80 px-3 py-2 font-mono text-[11px] text-rose-700">
            {props.errorMessage}
          </div>
        ) : null}

        {props.attachments ? props.attachments : null}

        <div className="border-border/40 flex items-end justify-between gap-3 border-t pt-3">
          <div className="min-w-0 flex-1 space-y-2.5">
            {props.controls ? (
              <div className="flex flex-wrap items-center gap-2">{props.controls}</div>
            ) : null}

            {props.helperText ? (
              <p className="text-muted-foreground font-mono text-[11px] leading-5">
                {props.helperText}
              </p>
            ) : null}

            {props.footer ? props.footer : null}
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
