"use client"

import { ImageIcon } from "lucide-react"
import { memo } from "react"

import { MarkdownRenderer } from "@/components/markdown"
import { formatTimeShort } from "@/lib/date-time"
import { cn } from "@/lib/utils"
import { getAttachmentDisplayName } from "@/modules/tasks/lib"

import type { ChatConversationBlock } from "@/modules/tasks/view-models"
import styles from "./chat-message.module.css"

type ChatMessageProps = {
  block: Extract<ChatConversationBlock, { type: "message" }>
}

function renderUserAttachments(
  block: Extract<ChatConversationBlock, { type: "message" }>,
) {
  if (
    block.role !== "user" ||
    !block.attachments ||
    block.attachments.length === 0
  ) {
    return null
  }

  return (
    <div className={styles.attachmentList}>
      {block.attachments.map((attachment) => (
        <div key={attachment.path} className={styles.attachmentCard}>
          <div className={styles.attachmentIconWrap}>
            <ImageIcon className="size-4" />
          </div>
          <div className={styles.attachmentMeta}>
            <div className={styles.attachmentName}>
              {getAttachmentDisplayName({
                path: attachment.path,
                mediaType: "",
                name: attachment.path.split("/").at(-1) ?? attachment.path,
                size: 0,
              })}
            </div>
            <div className={styles.attachmentPath}>{attachment.path}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ChatMessageView({ block }: ChatMessageProps) {
  const isUser = block.role === "user"
  const label = isUser ? "you" : "assistant"

  return (
    <div
      className={cn(
        "w-full p-2",
        block.pending && styles.pendingShell,
        isUser ? "bg-green-500/10" : "bg-sky-400/30",
      )}
      aria-label={`${label} message`}
    >
      <div className={styles.messageMeta}>
        <span className={styles.messageLabel}>{label}</span>
        <span className={styles.messageDivider}>·</span>
        <span>
          {block.pending ? "sending…" : formatTimeShort(block.timestamp)}
        </span>
      </div>

      <div
        className={cn(
          styles.messageBody,
          isUser ? styles.userBody : styles.agentBody,
        )}
      >
        {isUser ? (
          <>
            {block.content.trim() ? (
              <pre className={styles.userContent}>{block.content}</pre>
            ) : null}
            {renderUserAttachments(block)}
          </>
        ) : (
          <MarkdownRenderer
            content={block.content}
            isStreaming={Boolean(block.pending)}
          />
        )}
      </div>
    </div>
  )
}

function areMessagePropsEqual(
  previous: ChatMessageProps,
  next: ChatMessageProps,
) {
  return (
    previous.block.id === next.block.id &&
    previous.block.role === next.block.role &&
    previous.block.content === next.block.content &&
    JSON.stringify(previous.block.attachments ?? []) ===
      JSON.stringify(next.block.attachments ?? []) &&
    previous.block.timestamp === next.block.timestamp &&
    previous.block.pending === next.block.pending
  )
}

export const ChatMessage = memo(ChatMessageView, areMessagePropsEqual)
