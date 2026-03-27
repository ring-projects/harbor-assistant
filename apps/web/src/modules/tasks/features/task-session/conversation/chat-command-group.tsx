"use client"

import { memo } from "react"

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

function ChatCommandGroupView({ block, onOpen }: ChatCommandGroupProps) {
  const hasOutput = Boolean(block.outputPreview)

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
      <div className="w-full max-w-[52rem] rounded-xl border border-border/55 bg-card/60 px-3.5 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="flex items-start gap-3">
          <StatusIcon className={cn("mt-0.5 size-4 shrink-0", statusMeta.iconClassName)} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-mono text-[12px] leading-5 text-foreground/88">
                {block.command}
              </p>
              <span
                className={cn(
                  "inline-flex rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium",
                  block.status === "success" && "border-emerald-200 bg-emerald-50/75 text-emerald-700",
                  block.status === "failed" && "border-rose-200 bg-rose-50/80 text-rose-700",
                  block.status === "running" && "border-sky-200 bg-sky-50/75 text-sky-700",
                )}
              >
                {statusMeta.label}
              </span>
            </div>

            <p className="text-muted-foreground mt-1 font-mono text-[11px] leading-5">
              {block.startedAt ? ` · Started ${formatChatTimestamp(block.startedAt)}` : ""}
              {hasOutput ? ` · ${block.outputLineCount} lines captured` : " · No output yet"}
            </p>

            {block.outputPreview ? (
              <pre className="mt-2 overflow-hidden whitespace-pre-wrap break-words rounded-md bg-background/45 p-2.5 font-mono text-[11px] leading-5 text-foreground/78">
                {block.outputPreview}
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
                View details
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function areCommandGroupPropsEqual(
  previous: ChatCommandGroupProps,
  next: ChatCommandGroupProps,
) {
  return previous.block === next.block && previous.onOpen === next.onOpen
}

export const ChatCommandGroup = memo(
  ChatCommandGroupView,
  areCommandGroupPropsEqual,
)
