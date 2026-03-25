"use client"

import { cn } from "@/lib/utils"

import type { ChatConversationBlock } from "../types"
import { formatChatTimestamp } from "../components/shared"

type ChatEventProps = {
  block: Extract<ChatConversationBlock, { type: "event" }>
}

export function ChatEvent({ block }: ChatEventProps) {
  return (
    <div className="flex justify-start py-0.5">
      <div
        className={cn(
          "w-full rounded-lg bg-muted/18 px-3 py-2 font-mono text-[11px] leading-5",
          block.tone === "success" && "text-emerald-700",
          block.tone === "error" && "text-rose-700",
          block.tone === "neutral" && "text-muted-foreground",
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
