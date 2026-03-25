"use client"

import { ArrowUpRightIcon, CheckCircle2Icon, CircleIcon, PlugZapIcon, XCircleIcon } from "lucide-react"

import { cn } from "@/lib/utils"

import type { ChatConversationBlock } from "../types"
import { formatChatTimestamp } from "../components/shared"

type ChatMcpToolCallBlockProps = {
  block: Extract<ChatConversationBlock, { type: "mcp-tool-call" }>
  onOpen: (block: Extract<ChatConversationBlock, { type: "mcp-tool-call" }>) => void
}

function previewText(value: string | null, maxLines: number) {
  if (!value) {
    return null
  }

  const lines = value.trim().split(/\r?\n/)
  if (lines.length <= maxLines) {
    return value
  }

  return `${lines.slice(0, maxLines).join("\n")}\n...`
}

export function ChatMcpToolCallBlock({
  block,
  onOpen,
}: ChatMcpToolCallBlockProps) {
  const statusMeta =
    block.status === "success"
      ? {
          label: "Completed",
          metaClassName: "text-emerald-700",
          icon: CheckCircle2Icon,
        }
      : block.status === "failed"
        ? {
            label: "Failed",
            metaClassName: "text-rose-700",
            icon: XCircleIcon,
          }
        : {
            label: "Running",
            metaClassName: "text-sky-700",
            icon: CircleIcon,
          }
  const StatusIcon = statusMeta.icon
  const toolLabel =
    block.server && block.tool
      ? `${block.server}.${block.tool}`
      : block.tool ?? block.server ?? "MCP tool"
  const preview = previewText(block.resultText ?? block.argumentsText, 4)

  return (
    <div className="flex justify-start">
      <button
        type="button"
        onClick={() => onOpen(block)}
        className="hover:bg-muted/30 w-full rounded-lg bg-muted/22 text-left transition-colors"
      >
        <div className="flex items-start justify-between gap-3 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 font-mono text-[12px] leading-5 text-foreground/88">
              <PlugZapIcon className="text-muted-foreground size-3.5 shrink-0" />
              <span className="truncate">{`tool: ${toolLabel}`}</span>
            </p>

            <p className="text-muted-foreground mt-1 font-mono text-[11px] leading-5">
              <span className={cn("inline-flex items-center gap-1", statusMeta.metaClassName)}>
                <StatusIcon className="size-3" />
                {statusMeta.label.toLowerCase()}
              </span>
              {block.callId ? ` · ${block.callId}` : ""}
              {block.timestamp ? ` · ${formatChatTimestamp(block.timestamp)}` : ""}
            </p>

            {preview ? (
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-background/45 p-2.5 font-mono text-[11px] leading-5 text-foreground/78">
                {preview}
              </pre>
            ) : null}

            {block.errorText ? (
              <p className="mt-2 font-mono text-[11px] text-rose-700">
                {block.errorText}
              </p>
            ) : null}
          </div>

          <ArrowUpRightIcon className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
        </div>
      </button>
    </div>
  )
}
