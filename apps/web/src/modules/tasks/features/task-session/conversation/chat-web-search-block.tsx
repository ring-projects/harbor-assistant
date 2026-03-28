"use client"

import { memo } from "react"

import { ArrowUpRightIcon, SearchIcon } from "lucide-react"

import { formatTimeShort } from "@/lib/date-time"
import type { ChatConversationBlock } from "@/modules/tasks/view-models"

type ChatWebSearchBlockProps = {
  block: Extract<ChatConversationBlock, { type: "web-search" }>
  onOpen: (block: Extract<ChatConversationBlock, { type: "web-search" }>) => void
}

function ChatWebSearchBlockView({
  block,
  onOpen,
}: ChatWebSearchBlockProps) {
  return (
    <div className="flex justify-start">
      <button
        type="button"
        onClick={() => onOpen(block)}
        className="hover:bg-muted/20 w-full bg-card text-left transition-colors"
      >
        <div className="flex items-start justify-between gap-3 px-3.5 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="flex min-w-0 items-center gap-2 font-mono text-[12px] leading-5 text-foreground/88">
                <SearchIcon className="text-muted-foreground size-3.5 shrink-0" />
                <span className="truncate">{`search: ${block.query}`}</span>
              </p>
              <span className="inline-flex rounded-full border border-sky-200 bg-sky-50/75 px-2 py-0.5 font-mono text-[10px] font-medium text-sky-700">
                {block.status === "completed" ? "Completed" : "Running"}
              </span>
            </div>

            <p className="text-muted-foreground mt-1 font-mono text-[11px] leading-5">
              {block.searchId ? `Search ${block.searchId}` : "Web search"}
              {block.timestamp ? ` · ${formatTimeShort(block.timestamp)}` : ""}
            </p>

            <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-foreground/78">
              Query preserved as an evidence block. Open details to inspect the full payload.
            </p>
          </div>

          <ArrowUpRightIcon className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
        </div>
      </button>
    </div>
  )
}

function areWebSearchPropsEqual(
  previous: ChatWebSearchBlockProps,
  next: ChatWebSearchBlockProps,
) {
  return previous.block === next.block && previous.onOpen === next.onOpen
}

export const ChatWebSearchBlock = memo(
  ChatWebSearchBlockView,
  areWebSearchPropsEqual,
)
