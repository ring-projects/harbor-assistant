"use client"

import type { ChatConversationBlock, ChatInspectorBlock } from "../types"
import { ChatCommandGroup } from "./chat-command-group"
import { ChatEvent } from "./chat-event"
import { ChatFileChangeBlock } from "./chat-file-change-block"
import { ChatMessage } from "./chat-message"
import { ChatMcpToolCallBlock } from "./chat-mcp-tool-call-block"
import { ChatWebSearchBlock } from "./chat-web-search-block"
import { TypingIndicator } from "./typing-indicator"

type ChatStreamProps = {
  blocks: ChatConversationBlock[]
  onOpenInspector: (block: ChatInspectorBlock) => void
}

export function ChatStream({ blocks, onOpenInspector }: ChatStreamProps) {
  return (
    <div className="space-y-2.5 pr-1">
      {blocks.map((block) => {
        if (block.type === "message") {
          return <ChatMessage key={block.id} block={block} />
        }

        if (block.type === "file-change") {
          return (
            <ChatFileChangeBlock
              key={block.id}
              block={block}
              onOpen={onOpenInspector}
            />
          )
        }

        if (block.type === "web-search") {
          return (
            <ChatWebSearchBlock
              key={block.id}
              block={block}
              onOpen={onOpenInspector}
            />
          )
        }

        if (block.type === "mcp-tool-call") {
          return (
            <ChatMcpToolCallBlock
              key={block.id}
              block={block}
              onOpen={onOpenInspector}
            />
          )
        }

        if (block.type === "command-group") {
          return (
            <ChatCommandGroup
              key={block.id}
              block={block}
              onOpen={onOpenInspector}
            />
          )
        }

        if (block.type === "typing") {
          return <TypingIndicator key={block.id} label={block.label} />
        }

        return <ChatEvent key={block.id} block={block} />
      })}
    </div>
  )
}
