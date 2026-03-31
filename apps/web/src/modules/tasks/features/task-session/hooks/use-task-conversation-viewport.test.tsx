import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useTaskConversationViewport } from "./use-task-conversation-viewport"

type ResizeObserverCallback = ConstructorParameters<typeof ResizeObserver>[0]

const setStickToBottom = vi.fn()
let resizeObserverCallback: ResizeObserverCallback | null = null

vi.mock("@/modules/tasks/store", () => ({
  useTasksSessionStore: {
    getState: () => ({
      setStickToBottom,
    }),
  },
}))

class ResizeObserverMock {
  constructor(callback: ResizeObserverCallback) {
    resizeObserverCallback = callback
  }

  observe() {}

  disconnect() {}
}

describe("useTaskConversationViewport", () => {
  beforeEach(() => {
    resizeObserverCallback = null
    setStickToBottom.mockReset()
    vi.stubGlobal("ResizeObserver", ResizeObserverMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("stops auto-scrolling immediately after the user scrolls away from bottom", () => {
    const scrollTo = vi.fn()
    const scroller = {
      clientHeight: 400,
      scrollHeight: 1000,
      scrollTop: 600,
      scrollTo,
    } as unknown as HTMLDivElement
    const content = document.createElement("div")

    const { result, rerender } = renderHook(
      ({ stickToBottom, taskId }) =>
        useTaskConversationViewport({
          blocks: [
            {
              id: "assistant-1",
              type: "typing",
              label: "Codex is working...",
            },
          ],
          stickToBottom,
          taskId,
        }),
      {
        initialProps: {
          stickToBottom: true,
          taskId: null as string | null,
        },
      },
    )

    act(() => {
      result.current.scrollerRef.current = scroller
      result.current.contentRef.current = content
    })

    rerender({
      stickToBottom: true,
      taskId: "task-1",
    })

    expect(resizeObserverCallback).not.toBeNull()
    scrollTo.mockClear()

    act(() => {
      scroller.scrollTop = 120
      result.current.handleScroll()
    })

    expect(setStickToBottom).toHaveBeenCalledWith("task-1", false)

    act(() => {
      resizeObserverCallback?.([], {} as ResizeObserver)
    })

    expect(scrollTo).not.toHaveBeenCalled()
  })
})
