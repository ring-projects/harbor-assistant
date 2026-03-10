"use client"

import { cn } from "@/lib/utils"

import type { ChatConversationBlock } from "../types"
import { formatChatTimestamp } from "./shared"

type ChatMessageProps = {
  block: Extract<ChatConversationBlock, { type: "message" }>
}

export function ChatMessage({ block }: ChatMessageProps) {
  const isUser = block.role === "user"

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[78%] min-w-0", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "rounded-2xl border px-4 py-3 text-sm leading-6 shadow-sm",
            isUser
              ? "bg-primary text-primary-foreground border-primary/70 rounded-br-md"
              : "bg-card border-border text-card-foreground rounded-bl-md",
            block.pending && "opacity-75",
          )}
        >
          <pre className="font-sans whitespace-pre-wrap break-words">
            {block.content}
          </pre>
        </div>
        <div
          className={cn(
            "text-muted-foreground mt-1 px-1 text-[11px]",
            isUser ? "text-right" : "text-left",
          )}
        >
          {block.pending ? "sending..." : formatChatTimestamp(block.timestamp)}
        </div>
      </div>
    </div>
  )
}
