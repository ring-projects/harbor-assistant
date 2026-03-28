"use client"

import { memo } from "react"

import { ArrowUpRightIcon, CheckCircle2Icon, CircleIcon, PlugZapIcon, XCircleIcon } from "lucide-react"

import { formatTimeShort } from "@/lib/date-time"
import { cn } from "@/lib/utils"

import type { ChatConversationBlock } from "@/modules/tasks/view-models"

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

function ChatMcpToolCallBlockView({
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
        className="hover:bg-muted/20 w-full bg-card text-left"
      >
        <div className="flex items-start justify-between gap-3 px-3.5 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="flex min-w-0 items-center gap-2 font-mono text-[12px] leading-5 text-foreground/88">
                <PlugZapIcon className="text-muted-foreground size-3.5 shrink-0" />
                <span className="truncate">{`tool: ${toolLabel}`}</span>
              </p>
              <span className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium",
                block.status === "success" && "border-emerald-200 bg-emerald-50/75 text-emerald-700",
                block.status === "failed" && "border-rose-200 bg-rose-50/80 text-rose-700",
                block.status === "running" && "border-sky-200 bg-sky-50/75 text-sky-700",
              )}>
                <StatusIcon className="size-3" />
                {statusMeta.label}
              </span>
            </div>

            <p className="text-muted-foreground mt-1 font-mono text-[11px] leading-5">
              {block.callId ? ` · ${block.callId}` : ""}
              {block.timestamp ? ` · ${formatTimeShort(block.timestamp)}` : ""}
            </p>

            {preview ? (
              <pre className="bg-muted/25 mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-md p-2.5 font-mono text-[11px] leading-5 text-foreground/78">
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

function areMcpToolCallPropsEqual(
  previous: ChatMcpToolCallBlockProps,
  next: ChatMcpToolCallBlockProps,
) {
  return previous.block === next.block && previous.onOpen === next.onOpen
}

export const ChatMcpToolCallBlock = memo(
  ChatMcpToolCallBlockView,
  areMcpToolCallPropsEqual,
)
