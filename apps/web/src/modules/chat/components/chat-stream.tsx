"use client"

import type { ChatConversationBlock } from "../types"
import { ChatEvent } from "./chat-event"
import { ChatExecutionBlock } from "./chat-execution-block"
import { ChatMessage } from "./chat-message"
import { TypingIndicator } from "./typing-indicator"

type ChatStreamProps = {
  blocks: ChatConversationBlock[]
}

export function ChatStream({ blocks }: ChatStreamProps) {
  return (
    <div className="space-y-3 pr-1">
      {blocks.map((block) => {
        if (block.type === "message") {
          return <ChatMessage key={block.id} block={block} />
        }

        if (block.type === "execution") {
          return <ChatExecutionBlock key={block.id} block={block} />
        }

        if (block.type === "typing") {
          return <TypingIndicator key={block.id} label={block.label} />
        }

        return <ChatEvent key={block.id} block={block} />
      })}
    </div>
  )
}
