"use client"

import { FileTextIcon, ImageIcon } from "lucide-react"
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
    <div className={styles["attachment-list"]}>
      {block.attachments.map((attachment) => (
        <div key={attachment.path} className={styles["attachment-card"]}>
          <div className={styles["attachment-icon-wrap"]}>
            {attachment.type === "local_image" ? (
              <ImageIcon className="size-4" />
            ) : (
              <FileTextIcon className="size-4" />
            )}
          </div>
          <div className={styles["attachment-meta"]}>
            <div className={styles["attachment-name"]}>
              {getAttachmentDisplayName({
                path: attachment.path,
                mediaType: "",
                name: attachment.path.split("/").at(-1) ?? attachment.path,
                size: 0,
              })}
            </div>
            <div className={styles["attachment-path"]}>{attachment.path}</div>
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
        block.pending && styles["pending-shell"],
        isUser ? "bg-surface-success" : "bg-surface-info",
      )}
      aria-label={`${label} message`}
    >
      <div className={styles["message-meta"]}>
        <span className={styles["message-label"]}>{label}</span>
        <span className={styles["message-divider"]}>·</span>
        <span>
          {block.pending ? "sending…" : formatTimeShort(block.timestamp)}
        </span>
      </div>

      <div
        className={cn(
          styles["message-body"],
          isUser ? styles["user-body"] : styles["agent-body"],
        )}
      >
        {isUser ? (
          <>
            {block.content.trim() ? (
              <pre className={styles["user-content"]}>{block.content}</pre>
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
