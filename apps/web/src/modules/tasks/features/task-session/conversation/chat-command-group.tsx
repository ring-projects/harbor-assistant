"use client"

import {
  CheckCircle2Icon,
  LoaderCircleIcon,
  TerminalSquareIcon,
  XCircleIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { formatChatTimestamp } from "../components/shared"
import type { ChatConversationBlock } from "../types"

type ChatCommandGroupProps = {
  block: Extract<ChatConversationBlock, { type: "command-group" }>
  onOpen: (block: Extract<ChatConversationBlock, { type: "command-group" }>) => void
}

function countOutputLines(output: string) {
  const trimmed = output.trim()
  if (!trimmed) {
    return 0
  }

  return trimmed.split(/\r?\n/).length
}

function previewOutput(output: string, maxLines: number) {
  const trimmed = output.trim()
  if (!trimmed) {
    return null
  }

  const lines = trimmed.split(/\r?\n/)
  if (lines.length <= maxLines) {
    return trimmed
  }

  return `${lines.slice(0, maxLines).join("\n")}\n...`
}

export function ChatCommandGroup({ block, onOpen }: ChatCommandGroupProps) {
  const outputLineCount = countOutputLines(block.output)
  const outputPreview = previewOutput(block.output, 4)
  const hasOutput = Boolean(outputPreview)

  const statusMeta =
    block.status === "success"
      ? {
          label: block.exitCode === null ? "Completed" : `Completed (exit ${block.exitCode})`,
          icon: CheckCircle2Icon,
          iconClassName: "text-emerald-600",
          metaClassName: "text-emerald-700",
        }
      : block.status === "failed"
        ? {
            label: block.exitCode === null ? "Failed" : `Failed (exit ${block.exitCode})`,
            icon: XCircleIcon,
            iconClassName: "text-rose-600",
            metaClassName: "text-rose-700",
          }
        : {
            label: "Running",
            icon: LoaderCircleIcon,
            iconClassName: "animate-spin text-sky-600",
            metaClassName: "text-sky-700",
          }

  const StatusIcon = statusMeta.icon

  return (
    <div className="flex justify-start">
      <div className="w-full rounded-lg bg-muted/22 px-3 py-2.5">
        <div className="flex items-start gap-3">
          <StatusIcon className={cn("mt-0.5 size-4 shrink-0", statusMeta.iconClassName)} />

          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-[12px] leading-5 text-foreground/88">
              {block.command}
            </p>

            <p className="text-muted-foreground mt-1 font-mono text-[11px] leading-5">
              <span className={cn("font-medium", statusMeta.metaClassName)}>
                {statusMeta.label}
              </span>
              {block.startedAt ? ` · Started ${formatChatTimestamp(block.startedAt)}` : ""}
              {hasOutput ? ` · ${outputLineCount} lines captured` : " · No output yet"}
            </p>

            {outputPreview ? (
              <pre className="mt-2 overflow-hidden whitespace-pre-wrap break-words rounded-md bg-background/45 p-2.5 font-mono text-[11px] leading-5 text-foreground/78">
                {outputPreview}
              </pre>
            ) : null}

            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="text-muted-foreground flex items-center gap-2 font-mono text-[11px] leading-5">
                <TerminalSquareIcon className="size-3.5" />
                <span>
                  {block.completedAt
                    ? `Updated ${formatChatTimestamp(block.completedAt)}`
                    : "Waiting for completion"}
                </span>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground h-6 rounded-md px-2 font-mono text-[11px]"
                onClick={() => onOpen(block)}
              >
                Show more
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
