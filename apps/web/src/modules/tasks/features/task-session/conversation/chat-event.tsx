"use client"

import { memo } from "react"

import { cn } from "@/lib/utils"

import type { ChatConversationBlock } from "../types"
import { formatChatTimestamp } from "../components/shared"

type ChatEventProps = {
  block: Extract<ChatConversationBlock, { type: "event" }>
}

function ChatEventView({ block }: ChatEventProps) {
  const isStructuredEvent =
    block.label === "reasoning" || block.label === "todo_list"

  if (isStructuredEvent) {
    return (
      <div className="flex justify-start py-1">
        <div
          className={cn(
            "w-full max-w-[52rem] rounded-xl border px-3.5 py-3",
            block.tone === "success" && "border-emerald-200/80 bg-emerald-50/55 text-emerald-800",
            block.tone === "error" && "border-rose-200/80 bg-rose-50/70 text-rose-800",
            block.tone === "neutral" && "border-border/55 bg-card/55 text-foreground/82",
          )}
        >
          <div className="text-muted-foreground mb-1.5 flex items-center gap-1.5 font-mono text-[11px] leading-5">
            <span className="font-semibold lowercase">{block.label}</span>
            {block.timestamp ? (
              <>
                <span className="opacity-50">·</span>
                <span>{formatChatTimestamp(block.timestamp)}</span>
              </>
            ) : null}
          </div>
          <div className="whitespace-pre-wrap break-words text-[13px] leading-6">
            {block.content}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-center py-1">
      <div
        className={cn(
          "inline-flex max-w-[min(100%,40rem)] items-center rounded-full border px-3 py-1.5 font-mono text-[11px] leading-5 shadow-none",
          block.tone === "success" && "border-emerald-200/80 bg-emerald-50/75 text-emerald-700",
          block.tone === "error" && "border-rose-200/80 bg-rose-50/80 text-rose-700",
          block.tone === "neutral" && "border-border/55 bg-background/72 text-muted-foreground",
        )}
      >
        <span className="font-semibold lowercase">{block.label}</span>
        <span className="mx-1.5 opacity-50">·</span>
        <span>{block.content}</span>
        {block.timestamp ? (
          <>
            <span className="mx-1.5 opacity-50">·</span>
            <span>{formatChatTimestamp(block.timestamp)}</span>
          </>
        ) : null}
      </div>
    </div>
  )
}

function areEventPropsEqual(previous: ChatEventProps, next: ChatEventProps) {
  return previous.block === next.block
}

export const ChatEvent = memo(ChatEventView, areEventPropsEqual)
