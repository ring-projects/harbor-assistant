"use client"

import {
  isValidElement,
  memo,
  type ComponentProps,
  type ReactNode,
} from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { ShikiCodeBlock } from "@/components/code"
import { cn } from "@/lib/utils"

import type { ChatConversationBlock } from "../types"
import { formatChatTimestamp } from "../components/shared"
import styles from "./chat-message.module.css"

type ChatMessageProps = {
  block: Extract<ChatConversationBlock, { type: "message" }>
}

type MarkdownCodeElementProps = {
  className?: string
  children?: ReactNode
}

function ChatMessageView({ block }: ChatMessageProps) {
  const isUser = block.role === "user"
  const label = isUser ? "you" : "assistant"
  const markdownClassName =
    `${styles.markdownBody} space-y-3 text-[14px] [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:italic [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_li]:leading-7 [&_ol]:space-y-1 [&_ol]:pl-5 [&_p]:leading-7 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:p-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:bg-muted/45 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_ul]:space-y-1 [&_ul]:pl-5`

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          styles.messageShell,
          isUser ? styles.userShell : styles.agentShell,
          block.pending && styles.pendingShell,
          isUser ? "max-w-[min(78%,42rem)]" : "max-w-[min(100%,52rem)]",
        )}
        aria-label={`${label} message`}
      >
        <div className={styles.messageMeta}>
          <span className={styles.messageLabel}>{label}</span>
          <span className={styles.messageDivider}>·</span>
          <span>{block.pending ? "sending…" : formatChatTimestamp(block.timestamp)}</span>
        </div>

        <div className={cn(styles.messageBody, isUser ? styles.userBody : styles.agentBody)}>
          {isUser ? (
            <pre className={styles.userContent}>
              {block.content}
            </pre>
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
    previous.block.timestamp === next.block.timestamp &&
    previous.block.pending === next.block.pending
  )
}

export const ChatMessage = memo(ChatMessageView, areMessagePropsEqual)
