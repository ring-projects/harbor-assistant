"use client"

import { memo } from "react"

import {
  CheckCircle2Icon,
  LoaderCircleIcon,
  TerminalSquareIcon,
  XCircleIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { formatTimeShort } from "@/lib/date-time"
import { cn } from "@/lib/utils"

import type { ChatConversationBlock } from "@/modules/tasks/view-models"

type ChatCommandGroupProps = {
  block: Extract<ChatConversationBlock, { type: "command-group" }>
  onOpen: (block: Extract<ChatConversationBlock, { type: "command-group" }>) => void
}

function ChatCommandGroupView({ block }: ChatCommandGroupProps) {

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
    <div className="w-full bg-slate-100/55 p-2">
      <div className="flex items-start gap-3">
        <StatusIcon className={cn("mt-0.5 size-4 shrink-0", statusMeta.iconClassName)} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-mono text-[12px] leading-5 text-foreground/88">
              {block.command}
            </p>
          </div>

          {/* <div className="mt-2 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground h-6 rounded-md px-2 font-mono text-[11px]"
              onClick={() => onOpen(block)}
            >
              View details
            </Button>
          </div> */}
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
