"use client"

import { cn } from "@/lib/utils"

import type { ChatConversationBlock } from "../types"
import { formatChatTimestamp } from "./shared"

type ChatEventProps = {
  block: Extract<ChatConversationBlock, { type: "event" }>
}

export function ChatEvent({ block }: ChatEventProps) {
  return (
    <div className="flex justify-center py-1">
      <div
        className={cn(
          "max-w-[80%] rounded-full border px-3 py-1.5 text-center text-xs",
          block.tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-700",
          block.tone === "error" && "border-rose-200 bg-rose-50 text-rose-700",
          block.tone === "neutral" && "border-border bg-muted/50 text-muted-foreground",
        )}
      >
        <span className="font-medium">{block.label}</span>
        <span className="mx-1.5 text-muted-foreground/60">·</span>
        <span>{block.content}</span>
        {block.timestamp ? (
          <>
            <span className="mx-1.5 text-muted-foreground/60">·</span>
            <span>{formatChatTimestamp(block.timestamp)}</span>
          </>
        ) : null}
      </div>
    </div>
  )
}
