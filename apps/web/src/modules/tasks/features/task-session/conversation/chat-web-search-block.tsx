"use client"

import { ArrowUpRightIcon, SearchIcon } from "lucide-react"

import type { ChatConversationBlock } from "../types"
import { formatChatTimestamp } from "../components/shared"

type ChatWebSearchBlockProps = {
  block: Extract<ChatConversationBlock, { type: "web-search" }>
  onOpen: (block: Extract<ChatConversationBlock, { type: "web-search" }>) => void
}

export function ChatWebSearchBlock({
  block,
  onOpen,
}: ChatWebSearchBlockProps) {
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
              <SearchIcon className="text-muted-foreground size-3.5 shrink-0" />
              <span className="truncate">{`search: ${block.query}`}</span>
            </p>

            <p className="text-muted-foreground mt-1 font-mono text-[11px] leading-5">
              {block.status === "completed" ? "completed" : "running"}
              {block.searchId ? ` · ${block.searchId}` : ""}
              {block.timestamp ? ` · ${formatChatTimestamp(block.timestamp)}` : ""}
            </p>
          </div>

          <ArrowUpRightIcon className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
        </div>
      </button>
    </div>
  )
}
