"use client"

import { memo } from "react"

import { formatTimeShort } from "@/lib/date-time"
import { cn } from "@/lib/utils"

import type { ChatConversationBlock } from "@/modules/tasks/view-models"
import Markdown from "react-markdown"

type ChatEventProps = {
  block: Extract<ChatConversationBlock, { type: "event" }>
}

function ChatEventView({ block }: ChatEventProps) {
  const isStructuredEvent = block.label === "reasoning"

  if (isStructuredEvent) {
    return (
      <div
        className={cn(
          "w-full min-w-0 bg-slate-100/55 p-2 text-xs whitespace-pre-wrap break-all",
          block.tone === "success" && "text-emerald-900/80",
          block.tone === "error" && "text-rose-900/80",
          block.tone === "neutral" && "text-slate-700",
        )}
      >
        <Markdown>{block.content}</Markdown>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "bg-slate-100/55 p-2 text-xs break-all",
        block.tone === "success" && "text-emerald-900/75",
        block.tone === "error" && " text-rose-900/75",
        block.tone === "neutral" && " text-slate-600",
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
