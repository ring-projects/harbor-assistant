"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"

import { useTasksSessionStore } from "@/modules/tasks/store"

import type { ChatConversationBlock } from "@/modules/tasks/view-models"

const CHAT_WINDOW_INITIAL_SIZE = 160
const CHAT_WINDOW_EXPAND_STEP = 120
const CHAT_WINDOW_TOP_LOAD_THRESHOLD = 96

export function useTaskConversationViewport(args: {
  blocks: ChatConversationBlock[]
  stickToBottom: boolean
  taskId: string | null
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const stickToBottomRef = useRef(args.stickToBottom)
  const pendingWindowExpansionRef = useRef<{
    previousScrollHeight: number
    previousScrollTop: number
  } | null>(null)
  const [windowState, setWindowState] = useState(() => ({
    taskId: args.taskId,
    visibleCount: CHAT_WINDOW_INITIAL_SIZE,
  }))

  const visibleCount =
    args.stickToBottom
      ? CHAT_WINDOW_INITIAL_SIZE
      : windowState.taskId === args.taskId
        ? Math.max(CHAT_WINDOW_INITIAL_SIZE, windowState.visibleCount)
        : CHAT_WINDOW_INITIAL_SIZE
  const conversationWindowStart = Math.max(0, args.blocks.length - visibleCount)
  const visibleBlocks = useMemo(
    () => args.blocks.slice(conversationWindowStart),
    [args.blocks, conversationWindowStart],
  )
  const hiddenBlockCount = Math.max(0, args.blocks.length - visibleBlocks.length)

  useLayoutEffect(() => {
    stickToBottomRef.current = args.stickToBottom
  }, [args.stickToBottom])

  useLayoutEffect(() => {
    const pendingExpansion = pendingWindowExpansionRef.current
    if (!pendingExpansion) {
      return
    }

    const node = scrollerRef.current
    if (!node) {
      pendingWindowExpansionRef.current = null
      return
    }

    const scrollHeightDelta = node.scrollHeight - pendingExpansion.previousScrollHeight
    node.scrollTop = pendingExpansion.previousScrollTop + scrollHeightDelta
    pendingWindowExpansionRef.current = null
  }, [visibleBlocks])

  useEffect(() => {
    if (!args.stickToBottom) {
      return
    }

    const node = scrollerRef.current
    if (!node) {
      return
    }

    node.scrollTo({
      top: node.scrollHeight,
      behavior: "auto",
    })
  }, [args.blocks, args.stickToBottom])

  useEffect(() => {
    if (!args.stickToBottom) {
      return
    }

    const node = scrollerRef.current
    const contentNode = contentRef.current
    if (!node || !contentNode || typeof ResizeObserver === "undefined") {
      return
    }

    const resizeObserver = new ResizeObserver(() => {
      if (!stickToBottomRef.current) {
        return
      }

      node.scrollTo({
        top: node.scrollHeight,
        behavior: "auto",
      })
    })

    resizeObserver.observe(contentNode)
    return () => {
      resizeObserver.disconnect()
    }
  }, [args.stickToBottom, args.taskId])

  const loadEarlier = useCallback(() => {
    if (!args.taskId) {
      return
    }

    const node = scrollerRef.current
    if (!node) {
      return
    }

    pendingWindowExpansionRef.current = {
      previousScrollHeight: node.scrollHeight,
      previousScrollTop: node.scrollTop,
    }
    setWindowState((current) => ({
      taskId: args.taskId,
      visibleCount:
        (current.taskId === args.taskId
          ? current.visibleCount
          : CHAT_WINDOW_INITIAL_SIZE) + CHAT_WINDOW_EXPAND_STEP,
    }))
  }, [args.taskId])

  const jumpToLatest = useCallback(() => {
    const node = scrollerRef.current
    if (!node) {
      return
    }

    stickToBottomRef.current = true

    node.scrollTo({
      top: node.scrollHeight,
      behavior: "smooth",
    })

    if (args.taskId) {
      useTasksSessionStore.getState().setStickToBottom(args.taskId, true)
    }
  }, [args.taskId])

  const handleScroll = useCallback(() => {
    if (!args.taskId) {
      return
    }

    const node = scrollerRef.current
    if (!node) {
      return
    }

    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight
    const nextStickToBottom = distanceFromBottom < 48
    stickToBottomRef.current = nextStickToBottom
    useTasksSessionStore
      .getState()
      .setStickToBottom(args.taskId, nextStickToBottom)

    if (
      node.scrollTop <= CHAT_WINDOW_TOP_LOAD_THRESHOLD &&
      conversationWindowStart > 0 &&
      !pendingWindowExpansionRef.current
    ) {
      loadEarlier()
    }
  }, [args.taskId, conversationWindowStart, loadEarlier])

  return {
    handleScroll,
    hiddenBlockCount,
    jumpToLatest,
    loadEarlier,
    contentRef,
    scrollerRef,
    visibleBlocks,
  }
}
