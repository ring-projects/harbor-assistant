"use client"

import { memo } from "react"

import type { ChatConversationBlock, ChatInspectorBlock } from "@/modules/tasks/view-models"
import { ChatCommandGroup } from "./chat-command-group"
import { ChatEvent } from "./chat-event"
import { ChatFileChangeBlock } from "./chat-file-change-block"
import { ChatMessage } from "./chat-message"
import { ChatMcpToolCallBlock } from "./chat-mcp-tool-call-block"
import { ChatTodoListBlock } from "./chat-todo-list-block"
import { ChatWebSearchBlock } from "./chat-web-search-block"
import { TypingIndicator } from "./typing-indicator"

type ChatStreamProps = {
  blocks: ChatConversationBlock[]
  onOpenInspector: (block: ChatInspectorBlock) => void
}

function ChatStreamView({ blocks, onOpenInspector }: ChatStreamProps) {
  return (
    <div>
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

        if (block.type === "todo-list") {
          return <ChatTodoListBlock key={block.id} block={block} />
        }

        if (block.type === "typing") {
          return <TypingIndicator key={block.id} label={block.label} />
        }

        return <ChatEvent key={block.id} block={block} />
      })}
    </div>
  )
}

function areChatStreamPropsEqual(
  previous: ChatStreamProps,
  next: ChatStreamProps,
) {
  return previous.blocks === next.blocks && previous.onOpenInspector === next.onOpenInspector
}

export const ChatStream = memo(ChatStreamView, areChatStreamPropsEqual)
