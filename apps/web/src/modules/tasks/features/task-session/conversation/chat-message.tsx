"use client"

import { ImageIcon } from "lucide-react"
import {
  isValidElement,
  memo,
  type ComponentProps,
  type ReactNode,
} from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { ShikiCodeBlock } from "@/components/code"
import { formatTimeShort } from "@/lib/date-time"
import { cn } from "@/lib/utils"
import { getAttachmentDisplayName } from "@/modules/tasks/lib"

import type { ChatConversationBlock } from "@/modules/tasks/view-models"
import styles from "./chat-message.module.css"

type ChatMessageProps = {
  block: Extract<ChatConversationBlock, { type: "message" }>
}

type MarkdownCodeElementProps = {
  className?: string
  children?: ReactNode
}

function renderUserAttachments(
  block: Extract<ChatConversationBlock, { type: "message" }>,
) {
  if (block.role !== "user" || !block.attachments || block.attachments.length === 0) {
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
  const markdownClassName =
    `${styles.markdownBody} space-y-3 text-[14px] [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:italic [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_li]:leading-7 [&_ol]:space-y-1 [&_ol]:pl-5 [&_p]:leading-7 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:p-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:bg-muted/45 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_ul]:space-y-1 [&_ul]:pl-5`

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
        <span>{block.pending ? "sending…" : formatTimeShort(block.timestamp)}</span>
      </div>

      <div className={cn(styles.messageBody, isUser ? styles.userBody : styles.agentBody)}>
        {isUser ? (
          <>
            {block.content.trim() ? (
              <pre className={styles.userContent}>
                {block.content}
              </pre>
            ) : null}
            {renderUserAttachments(block)}
          </>
        ) : (
          <div className={markdownClassName}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: function ChatMessageLink(
                  props: ComponentProps<"a">,
                ) {
                  return (
                    <a
                      {...props}
                      target="_blank"
                      rel="noreferrer"
                    />
                  )
                },
                pre: function ChatMessagePre({
                  children,
                  ...props
                }: ComponentProps<"pre">) {
                  if (isValidElement(children) && children.type === "code") {
                    const codeProps = children.props as MarkdownCodeElementProps
                    const className =
                      typeof codeProps.className === "string"
                        ? codeProps.className
                        : undefined
                    const languageMatch = /language-([\w-]+)/.exec(className ?? "")
                    const code = String(codeProps.children ?? "")

                    return (
                      <ShikiCodeBlock
                        code={code}
                        language={languageMatch?.[1] ?? null}
                      />
                    )
                  }

                  return <pre {...props}>{children}</pre>
                },
                code: function ChatMessageCode({
                  className,
                  children,
                  ...props
                }) {
                  return (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  )
                },
              }}
            >
              {block.content}
            </ReactMarkdown>
          </div>
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
