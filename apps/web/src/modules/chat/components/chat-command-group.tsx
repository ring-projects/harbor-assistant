"use client"

import { CheckCircle2Icon, ChevronDownIcon, CircleIcon, TerminalSquareIcon, XCircleIcon } from "lucide-react"
import { useMemo, useState } from "react"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

import type { ChatConversationBlock } from "../types"
import { formatChatTimestamp } from "./shared"

type ChatCommandGroupProps = {
  block: Extract<ChatConversationBlock, { type: "command-group" }>
}

function countOutputLines(output: string) {
  const trimmed = output.trim()
  if (!trimmed) {
    return 0
  }

  return trimmed.split(/\r?\n/).length
}

export function ChatCommandGroup({ block }: ChatCommandGroupProps) {
  const [open, setOpen] = useState(false)
  const outputLineCount = useMemo(() => countOutputLines(block.output), [block.output])
  const hasOutput = block.output.trim().length > 0

  const statusMeta =
    block.status === "success"
      ? {
          label: block.exitCode === null ? "Completed" : `Completed (exit ${block.exitCode})`,
          className: "border-emerald-200 bg-emerald-50/70 text-emerald-700",
          icon: CheckCircle2Icon,
        }
      : block.status === "failed"
        ? {
            label: block.exitCode === null ? "Failed" : `Failed (exit ${block.exitCode})`,
            className: "border-rose-200 bg-rose-50/70 text-rose-700",
            icon: XCircleIcon,
          }
        : {
            label: "Running",
            className: "border-sky-200 bg-sky-50/70 text-sky-700",
            icon: CircleIcon,
          }

  const StatusIcon = statusMeta.icon

  return (
    <div className="flex justify-start">
      <Collapsible
        open={open}
        onOpenChange={setOpen}
        className="w-full max-w-[88%] rounded-xl border bg-muted/30"
      >
        <div className="flex items-start justify-between gap-3 px-3 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="rounded-full border bg-background/80 px-2 py-0.5 text-[11px] font-medium">
                Command
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
                  statusMeta.className,
                )}
              >
                <StatusIcon className="size-3.5" />
                {statusMeta.label}
              </span>
            </div>

            <div className="mt-2 rounded-lg border bg-background px-3 py-2 font-mono text-xs leading-5 break-words">
              {block.command}
            </div>

            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2Icon className="size-4 text-emerald-600" />
                <span>Started</span>
                <span className="text-muted-foreground">
                  {formatChatTimestamp(block.startedAt)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {hasOutput ? (
                  <CheckCircle2Icon className="size-4 text-emerald-600" />
                ) : (
                  <CircleIcon className="size-4 text-slate-400" />
                )}
                <span>{hasOutput ? `Output (${outputLineCount} lines)` : "Output"}</span>
                <span className="text-muted-foreground">
                  {hasOutput ? "Available" : "No output yet"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {block.status === "success" ? (
                  <CheckCircle2Icon className="size-4 text-emerald-600" />
                ) : block.status === "failed" ? (
                  <XCircleIcon className="size-4 text-rose-600" />
                ) : (
                  <CircleIcon className="size-4 text-slate-400" />
                )}
                <span>
                  {block.status === "running" ? "Completed" : statusMeta.label}
                </span>
                <span className="text-muted-foreground">
                  {block.completedAt ? formatChatTimestamp(block.completedAt) : "Pending"}
                </span>
              </div>
            </div>
          </div>

          <CollapsibleTrigger
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors"
            disabled={!hasOutput}
          >
            <TerminalSquareIcon className="size-4" />
            <span>{open ? "Hide output" : "Show output"}</span>
            <ChevronDownIcon
              className={cn("size-4 transition-transform", open && "rotate-180")}
            />
          </CollapsibleTrigger>
        </div>

        {hasOutput ? (
          <CollapsibleContent className="px-3 pb-3">
            <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl border bg-background/80 p-3 text-xs leading-6">
              {block.output}
            </pre>
          </CollapsibleContent>
        ) : null}
      </Collapsible>
    </div>
  )
}
