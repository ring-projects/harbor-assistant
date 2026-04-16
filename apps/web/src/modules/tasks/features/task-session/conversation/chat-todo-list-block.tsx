"use client"

import { memo } from "react"

import {
  CheckCheckIcon,
  CircleDashedIcon,
  CircleIcon,
  LoaderCircleIcon,
} from "lucide-react"

import { formatTimeShort } from "@/lib/date-time"
import { cn } from "@/lib/utils"

import type { ChatConversationBlock } from "@/modules/tasks/view-models"

type ChatTodoListBlockProps = {
  block: Extract<ChatConversationBlock, { type: "todo-list" }>
}

function ChatTodoListBlockView({ block }: ChatTodoListBlockProps) {
  const completedCount = block.items.filter((item) => item.completed).length
  const totalCount = block.items.length
  const statusMeta =
    block.status === "completed"
      ? {
        label: "Completed",
        icon: CheckCheckIcon,
        iconClassName: "text-success",
        badgeClassName: "border-success/25 bg-surface-success text-success",
        metaClassName: "text-success",
      }
      : {
        label: "Running",
        icon: LoaderCircleIcon,
        iconClassName: "text-info animate-spin",
        badgeClassName: "border-info/25 bg-surface-info text-info",
        metaClassName: "text-info",
      }
  const StatusIcon = statusMeta.icon

  return (
    <div className="bg-surface-subtle w-full px-3.5 py-3">
      <div className="flex items-start gap-3">
        <StatusIcon className={cn("mt-0.5 size-4 shrink-0", statusMeta.iconClassName)} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-mono text-[12px] leading-5 text-foreground/88">
              Plan
            </p>
            <span
              className={cn(
                "inline-flex rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium",
                statusMeta.badgeClassName,
              )}
            >
              {statusMeta.label}
            </span>
            <span className="text-muted-foreground font-mono text-[11px] leading-5">
              {`${completedCount}/${totalCount} completed`}
            </span>
          </div>

          <p className="text-muted-foreground mt-1 font-mono text-[11px] leading-5">
            {block.startedAt ? `Started ${formatTimeShort(block.startedAt)}` : "Plan issued"}
            {block.timestamp ? ` · Updated ${formatTimeShort(block.timestamp)}` : ""}
          </p>

          <div className="mt-3 space-y-2">
            {block.items.map((item, index) => (
              <div
                key={`${block.todoListId}-${index}-${item.text}`}
                className={cn(
                  "flex items-start gap-2 rounded-lg border px-2.5 py-2",
                  item.completed
                    ? "border-success/20 bg-surface-success"
                    : "border-border bg-muted/15",
                )}
              >
                {item.completed ? (
                  <CheckCheckIcon className="text-success mt-0.5 size-3.5 shrink-0" />
                ) : block.status === "completed" ? (
                  <CircleDashedIcon className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
                ) : (
                  <CircleIcon className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
                )}
                <span
                  className={cn(
                    "text-[13px] leading-6",
                    item.completed
                      ? "text-foreground/78 line-through decoration-success/70"
                      : "text-foreground/88",
                  )}
                >
                  {item.text}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-2 flex items-center gap-2 font-mono text-[11px] leading-5">
            <span className={cn("font-medium", statusMeta.metaClassName)}>
              {block.status === "completed"
                ? "Plan execution finished"
                : "Waiting for further updates"}
            </span>
            {block.completedAt ? (
              <span className="text-muted-foreground">
                {`· ${formatTimeShort(block.completedAt)}`}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function areTodoListPropsEqual(
  previous: ChatTodoListBlockProps,
  next: ChatTodoListBlockProps,
) {
  return previous.block === next.block
}

export const ChatTodoListBlock = memo(
  ChatTodoListBlockView,
  areTodoListPropsEqual,
)
