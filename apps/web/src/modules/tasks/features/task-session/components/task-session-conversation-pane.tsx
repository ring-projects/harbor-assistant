"use client"

import { ArrowDownIcon, ArrowUpIcon } from "lucide-react"
import { memo, useCallback, useMemo } from "react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  selectChatUi,
  selectConversationBlocks,
  selectSelectedInspectorBlock,
  useTasksSessionStore,
} from "@/modules/tasks/domain/store"
import type { TaskDetail } from "@/modules/tasks/contracts"
import { formatExecutorLabel } from "@/modules/tasks/domain/lib"

import { ChatStream } from "../conversation"
import { useTaskConversationViewport } from "../hooks/use-task-conversation-viewport"
import type { ChatConversationBlock } from "../types"
import { ChatDetailDrawer } from "./chat-detail-drawer"

type InspectorBlock = Extract<
  ChatConversationBlock,
  {
    type: "file-change" | "web-search" | "mcp-tool-call" | "command-group"
  }
>

type TaskSessionConversationPaneProps = {
  taskId: string
  detail: TaskDetail | null | undefined
}

function getRunningLabel(detail: TaskDetail | null | undefined) {
  if (!detail) {
    return "Agent is working..."
  }

  return `${formatExecutorLabel(detail.executor)} is working...`
}

export const TaskSessionConversationPane = memo(
  function TaskSessionConversationPane({
    taskId,
    detail,
  }: TaskSessionConversationPaneProps) {
    const blocksFromStore = useTasksSessionStore((state) =>
      selectConversationBlocks(state, taskId),
    )
    const stickToBottom = useTasksSessionStore(
      (state) => selectChatUi(state, taskId).stickToBottom,
    )
    const selectedInspectorBlock = useTasksSessionStore((state) =>
      selectSelectedInspectorBlock(state, taskId),
    )
    const blocks = useMemo(() => {
      if (detail?.status !== "running") {
        return blocksFromStore
      }

      return [
        ...blocksFromStore,
        {
          id: "assistant-typing",
          type: "typing",
          label: getRunningLabel(detail),
        },
      ]
    }, [blocksFromStore, detail])

    const {
      handleScroll,
      hiddenBlockCount,
      jumpToLatest,
      loadEarlier,
      scrollerRef,
      visibleBlocks,
    } = useTaskConversationViewport({
      blocks,
      stickToBottom,
      taskId,
    })

    const openInspectorDrawer = useCallback(
      (block: InspectorBlock) => {
        useTasksSessionStore.getState().setSelectedInspectorBlockId(taskId, block.id)
      },
      [taskId],
    )

    return (
      <>
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <ScrollArea
            viewportRef={scrollerRef}
            onViewportScroll={handleScroll}
            className="h-full min-h-0"
            viewportClassName="h-full min-h-0 px-3 py-3"
          >
            {blocks.length === 0 ? (
              <div className="text-muted-foreground flex min-h-full items-center justify-center font-mono text-[12px]">
                No messages are available for this chat yet.
              </div>
            ) : (
              <div
                role="log"
                aria-label="Task conversation"
                aria-live={stickToBottom ? "polite" : "off"}
                aria-relevant="additions text"
                aria-busy={detail?.status === "running"}
                className="space-y-2.5"
              >
                {hiddenBlockCount > 0 ? (
                  <div className="flex items-center justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-md border-dashed border-border/45 bg-background/45 px-2.5 font-mono text-[11px]"
                      onClick={loadEarlier}
                      aria-label={`Load ${Math.min(120, hiddenBlockCount)} earlier messages`}
                    >
                      <ArrowUpIcon className="size-3.5" />
                      {`Load ${Math.min(120, hiddenBlockCount)} earlier messages`}
                    </Button>
                  </div>
                ) : null}

                <ChatStream
                  blocks={visibleBlocks}
                  onOpenInspector={openInspectorDrawer}
                />
              </div>
            )}
          </ScrollArea>

          {!stickToBottom && blocks.length > 0 ? (
            <div className="absolute right-4 bottom-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-md border-border/45 bg-background/75 font-mono text-[11px]"
                onClick={jumpToLatest}
                aria-label="Jump to latest messages"
              >
                <ArrowDownIcon className="size-4" />
                {hiddenBlockCount > 0
                  ? `Jump to latest (${hiddenBlockCount} hidden)`
                  : "Jump to latest"}
              </Button>
            </div>
          ) : null}
        </div>

        <ChatDetailDrawer
          block={selectedInspectorBlock}
          open={selectedInspectorBlock !== null}
          onOpenChange={(open) => {
            if (!open) {
              useTasksSessionStore.getState().setSelectedInspectorBlockId(taskId, null)
            }
          }}
        />
      </>
    )
  },
)
