"use client"

import { memo } from "react"

import { ArrowUpRightIcon, FileCode2Icon } from "lucide-react"

import type { ChatConversationBlock } from "../types"
import { formatChatTimestamp } from "../components/shared"

type ChatFileChangeBlockProps = {
  block: Extract<ChatConversationBlock, { type: "file-change" }>
  onOpen: (block: Extract<ChatConversationBlock, { type: "file-change" }>) => void
}

function ChatFileChangeBlockView({
  block,
  onOpen,
}: ChatFileChangeBlockProps) {
  const previewChanges = block.changes.slice(0, 3)

  return (
    <div className="flex justify-start">
      <button
        type="button"
        onClick={() => onOpen(block)}
        className="hover:bg-muted/30 w-full rounded-lg bg-muted/22 text-left transition-colors"
      >
        <div className="flex items-start justify-between gap-3 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 font-mono text-[12px] leading-5 text-foreground/88">
              <FileCode2Icon className="text-muted-foreground size-3.5 shrink-0" />
              <span className="truncate">
                {block.status === "success" ? "patch applied" : "patch failed"}
              </span>
            </p>

            <p className="text-muted-foreground mt-1 font-mono text-[11px] leading-5">
              {previewChanges.length === 0
                ? "No file metadata available"
                : `${block.changes.length} file${block.changes.length === 1 ? "" : "s"} changed`}
              {block.changeId ? ` · ${block.changeId}` : ""}
              {block.timestamp ? ` · ${formatChatTimestamp(block.timestamp)}` : ""}
            </p>

            {previewChanges.length > 0 ? (
              <div className="mt-2 space-y-1.5">
                {previewChanges.map((change) => (
                  <div
                    key={`${change.kind}-${change.path}`}
                    className="flex items-center gap-2 rounded-md bg-background/45 px-2.5 py-2"
                  >
                    <span className="inline-flex min-w-12 justify-center rounded-md bg-muted/38 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]">
                      {change.kind}
                    </span>
                    <span className="truncate font-mono text-[11px]">{change.path}</span>
                  </div>
                ))}
                {block.changes.length > previewChanges.length ? (
                  <p className="text-muted-foreground font-mono text-[11px]">
                    {`+${block.changes.length - previewChanges.length} more changes`}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <ArrowUpRightIcon className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
        </div>
      </button>
    </div>
  )
}

function areFileChangePropsEqual(
  previous: ChatFileChangeBlockProps,
  next: ChatFileChangeBlockProps,
) {
  return previous.block === next.block && previous.onOpen === next.onOpen
}

export const ChatFileChangeBlock = memo(
  ChatFileChangeBlockView,
  areFileChangePropsEqual,
)
