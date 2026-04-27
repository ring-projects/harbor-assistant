"use client"

import { useMemo } from "react"

import {
  selectChatUi,
  selectLastSequence,
  selectTaskDetail,
  useTasksSessionStore,
} from "@/modules/tasks/store"
import {
  formatExecutorLabel,
  selectConversationBlocks,
  selectSelectedInspectorBlock,
  type ChatConversationBlock,
} from "@/modules/tasks/view-models"
import {
  useTaskDetailQuery,
  useTaskEventStream,
  useTaskEventsQuery,
} from "@/modules/tasks/hooks/use-task-queries"

function getRunningLabel(executor: string | null | undefined) {
  if (!executor) {
    return "Agent is working..."
  }

  return `${formatExecutorLabel(executor)} is working...`
}

export function useTaskSessionData(args: {
  projectId: string
  taskId: string | null
}) {
  const detailQuery = useTaskDetailQuery(args.taskId)
  const eventsQuery = useTaskEventsQuery({
    taskId: args.taskId,
    enabled: Boolean(args.taskId),
  })

  useTaskEventStream({
    projectId: args.projectId,
    taskId: args.taskId,
    enabled: Boolean(args.taskId),
  })

  const detail = useTasksSessionStore((state) =>
    selectTaskDetail(state, args.taskId),
  )
  const blocksFromStore = useTasksSessionStore((state) =>
    selectConversationBlocks(state, args.taskId),
  )
  const chatUi = useTasksSessionStore((state) =>
    selectChatUi(state, args.taskId),
  )
  const selectedInspectorBlock = useTasksSessionStore((state) =>
    selectSelectedInspectorBlock(state, args.taskId),
  )
  const lastSequence = useTasksSessionStore((state) =>
    selectLastSequence(state, args.taskId),
  )

  const blocks = useMemo(() => {
    const nextBlocks: ChatConversationBlock[] = [...blocksFromStore]

    if (detail?.status === "running") {
      nextBlocks.push({
        id: "assistant-typing",
        type: "typing",
        label: getRunningLabel(detail.executor),
      })
    }

    return nextBlocks
  }, [blocksFromStore, detail])

  return {
    blocks,
    chatUi,
    detail,
    detailQuery,
    eventsQuery,
    isError:
      Boolean(args.taskId) && (detailQuery.isError || eventsQuery.isError),
    isLoading:
      Boolean(args.taskId) && (detailQuery.isLoading || eventsQuery.isLoading),
    lastSequence,
    selectedInspectorBlock,
  }
}
