import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useTasksSessionStore } from "@/modules/tasks/store"
import type { TaskDetail } from "@/modules/tasks/contracts"

import { TaskSessionConversationPane } from "./task-session-conversation-pane"

const mockHandleScroll = vi.fn()

vi.mock("../hooks/use-task-conversation-viewport", () => ({
  useTaskConversationViewport: ({ blocks }: { blocks: unknown[] }) => ({
    contentRef: { current: null },
    handleScroll: mockHandleScroll,
    hiddenBlockCount: 0,
    jumpToLatest: vi.fn(),
    loadEarlier: vi.fn(),
    scrollerRef: { current: null },
    visibleBlocks: blocks,
  }),
}))

vi.mock("./chat-detail-drawer", () => ({
  ChatDetailDrawer: () => null,
}))

function buildTaskDetail(overrides: Partial<TaskDetail> = {}): TaskDetail {
  return {
    taskId: "task-1",
    projectId: "project-1",
    orchestrationId: "orch-1",
    prompt: "Ship it",
    title: "Ship it",
    titleSource: "prompt",
    model: null,
    executor: "codex",
    executionMode: "connected",
    effort: null,
    status: "running",
    archivedAt: null,
    createdAt: "2026-03-13T00:00:00.000Z",
    startedAt: "2026-03-13T00:00:01.000Z",
    finishedAt: null,
    ...overrides,
  }
}

afterEach(() => {
  mockHandleScroll.mockReset()
  useTasksSessionStore.setState({
    tasksById: {},
    taskIdsByOrchestration: {},
    eventStreamsByTaskId: {},
    chatUiByTaskId: {},
  })
})

describe("TaskSessionConversationPane", () => {
  it("renders the running state inside the chat stream instead of a separate status bar", () => {
    render(<TaskSessionConversationPane taskId="task-1" detail={buildTaskDetail()} />)

    expect(screen.getByText("Codex is working...")).toBeInTheDocument()
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(
      screen.queryByText("No messages are available for this chat yet."),
    ).not.toBeInTheDocument()
  })

  it("wires the scroll handler to the conversation scroller", () => {
    render(<TaskSessionConversationPane taskId="task-1" detail={buildTaskDetail()} />)

    fireEvent.scroll(screen.getByRole("log").parentElement as HTMLElement)

    expect(mockHandleScroll).toHaveBeenCalledTimes(1)
  })
})
