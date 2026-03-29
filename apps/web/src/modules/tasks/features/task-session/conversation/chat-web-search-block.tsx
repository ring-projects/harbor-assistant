"use client"

import { memo } from "react"

import { ArrowUpRightIcon, NavigationIcon, SearchIcon, WebhookIcon } from "lucide-react"

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
    <button
      type="button"
      onClick={() => onOpen(block)}
      className="w-full bg-slate-100/55 flex items-center gap-1 p-2 text-xs"
    >
      <SearchIcon className="size-3" />
      <span className="font-semibold">search </span>
      <span className="truncate">{block.query}</span>
    </button>
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
