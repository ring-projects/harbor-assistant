"use client"

import { ArrowUpRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"

import type { ChatConversationBlock } from "../types"
import { formatChatTimestamp } from "./shared"

type ChatExecutionBlockProps = {
  block: Extract<ChatConversationBlock, { type: "execution" }>
  onOpen: (block: Extract<ChatConversationBlock, { type: "execution" }>) => void
}

function previewContent(content: string) {
  const lines = content.trim().split(/\r?\n/)
  if (lines.length <= 4 && content.length <= 280) {
    return content
  }

  return `${lines.slice(0, 4).join("\n")}\n...`
}

export function ChatExecutionBlock({ block, onOpen }: ChatExecutionBlockProps) {
  const preview = previewContent(block.content)

  return (
    <div className="flex justify-start">
      <button
        type="button"
        onClick={() => onOpen(block)}
        className={cn(
          "w-full max-w-[88%] rounded-xl border text-left transition-colors",
          block.tone === "success" && "border-emerald-200 bg-emerald-50/60",
          block.tone === "error" && "border-rose-200 bg-rose-50/60",
          block.tone === "neutral" && "border-border bg-muted/40",
          "hover:bg-muted/60",
        )}
      >
        <div className="flex w-full items-center justify-between gap-3 px-3 py-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded-full border bg-background/80 px-2 py-0.5 text-[11px] font-medium">
                {block.label}
              </span>
              {block.source ? (
                <span className="text-muted-foreground truncate text-[11px]">
                  {block.source}
                </span>
              ) : null}
            </div>
            <p className="text-muted-foreground mt-1 text-[11px]">
              {formatChatTimestamp(block.timestamp)}
            </p>
          </div>
          <ArrowUpRightIcon className="text-muted-foreground size-4 shrink-0" />
        </div>

        <div className="px-3 pb-3">
          <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg border bg-background/80 p-3 text-xs leading-5">
            {preview}
          </pre>
          <p className="text-muted-foreground mt-2 text-[11px]">
            在右侧抽屉中查看完整内容
          </p>
        </div>
      </button>
    </div>
  )
}
