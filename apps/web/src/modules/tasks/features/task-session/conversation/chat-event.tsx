"use client"

import { memo } from "react"

import { MarkdownRenderer } from "@/components/markdown"
import { formatTimeShort } from "@/lib/date-time"
import { cn } from "@/lib/utils"

import type { ChatConversationBlock } from "@/modules/tasks/view-models"

type ChatEventProps = {
  block: Extract<ChatConversationBlock, { type: "event" }>
}

function ChatEventView({ block }: ChatEventProps) {
  const isStructuredEvent = block.label === "reasoning"

  if (isStructuredEvent) {
    return (
      <div
        className={cn(
          "bg-surface-subtle w-full min-w-0 p-2 text-xs break-all whitespace-pre-wrap",
          block.tone === "success" && "text-success",
          block.tone === "error" && "text-destructive",
          block.tone === "neutral" && "text-muted-foreground",
        )}
      >
        <MarkdownRenderer compact content={block.content} />
      </div>
    )
  }

  return (
    <div
      className={cn(
        "bg-surface-subtle p-2 text-xs break-all",
        block.tone === "success" && "text-success",
        block.tone === "error" && "text-destructive",
        block.tone === "neutral" && "text-muted-foreground",
      )}
    >
      <span className="lowercase">{block.label}</span>
      <span className="mx-1.5 opacity-50">·</span>
      <span>{block.content}</span>
      {block.timestamp ? (
        <>
          <span className="mx-1.5 opacity-50">·</span>
          <span>{formatTimeShort(block.timestamp)}</span>
        </>
      ) : null}
    </div>
  )
}

function areEventPropsEqual(previous: ChatEventProps, next: ChatEventProps) {
  return previous.block === next.block
}

export const ChatEvent = memo(ChatEventView, areEventPropsEqual)
