"use client"

import type { ComponentProps } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { HighlightedCodeText } from "@/components/code"
import { cn } from "@/lib/utils"

import type { ChatConversationBlock } from "../types"
import { formatChatTimestamp } from "./shared"
import styles from "./chat-message.module.css"

type ChatMessageProps = {
  block: Extract<ChatConversationBlock, { type: "message" }>
}

export function ChatMessage({ block }: ChatMessageProps) {
  const isUser = block.role === "user"
  const markdownClassName =
    `${styles.markdownBody} space-y-3 text-sm [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_li]:leading-6 [&_ol]:space-y-1 [&_ol]:pl-5 [&_p]:leading-6 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:p-3 [&_ul]:space-y-1 [&_ul]:pl-5`

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
          {isUser ? (
            <pre className="font-sans whitespace-pre-wrap break-words">
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
                  code: function ChatMessageCode({
                    className,
                    children,
                    ...props
                  }) {
                    const languageMatch = /language-([\w-]+)/.exec(className ?? "")
                    const code = String(children).replace(/\n$/, "")

                    if (!languageMatch) {
                      return (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      )
                    }

                    return (
                      <code className={cn("block whitespace-pre", className)} {...props}>
                        <HighlightedCodeText
                          code={code}
                          language={languageMatch[1] ?? null}
                        />
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
