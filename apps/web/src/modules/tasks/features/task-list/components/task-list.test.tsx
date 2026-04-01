import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { TaskListItem } from "@/modules/tasks/contracts"
import { useTasksSessionStore } from "@/modules/tasks/store"

import { TaskList } from "./task-list"

const archiveMutateAsync = vi.fn()
const deleteMutateAsync = vi.fn()

vi.mock("@/modules/tasks/hooks/use-task-queries", () => ({
  useArchiveTaskMutation: vi.fn(() => ({
    isPending: false,
    mutateAsync: archiveMutateAsync,
  })),
  useDeleteTaskMutation: vi.fn(() => ({
    isPending: false,
    mutateAsync: deleteMutateAsync,
  })),
  useOrchestrationTaskListQuery: vi.fn(() => ({
    isLoading: false,
    isError: false,
    error: null,
  })),
}))

vi.mock("./delete-task-dialog", () => ({
  DeleteTaskDialog: () => null,
}))

vi.mock("./task-list-header", () => ({
  TaskListHeader: ({
    allCount,
    archivedCount,
    completedCount,
    onSelectTab,
    runningCount,
  }: {
    allCount: number
    archivedCount: number
    completedCount: number
    onSelectTab: (tab: "all" | "running" | "completed" | "archived") => void
    runningCount: number
  }) => (
    <div>
      <div data-testid="counts">
        {`all:${allCount}|running:${runningCount}|completed:${completedCount}|archived:${archivedCount}`}
      </div>
      <button type="button" onClick={() => onSelectTab("all")}>
        all
      </button>
      <button type="button" onClick={() => onSelectTab("archived")}>
        archived
      </button>
    </div>
  ),
}))

vi.mock("./task-list-item", () => ({
  TaskListItem: ({
    isArchived,
    task,
  }: {
    isArchived?: boolean
    task: TaskListItem
  }) => (
    <div data-testid="task-row">
      {`${task.title}|${isArchived ? "archived" : "active"}`}
    </div>
  ),
}))

function buildTask(overrides: Partial<TaskListItem> = {}): TaskListItem {
  return {
    id: "task-1",
    projectId: "project-1",
    orchestrationId: "orch-1",
    prompt: "Ship it",
    title: "Ship it",
    titleSource: "prompt",
    model: null,
    executor: "codex",
    executionMode: "connected",
    effort: null,
    status: "completed",
    archivedAt: null,
    createdAt: "2026-03-13T00:00:00.000Z",
    startedAt: null,
    finishedAt: "2026-03-13T00:10:00.000Z",
    ...overrides,
  }
}

function resetTasksSessionStore() {
  act(() => {
    useTasksSessionStore.setState({
      tasksById: {},
      taskIdsByOrchestration: {},
      eventStreamsByTaskId: {},
      chatUiByTaskId: {},
    })
  })
}

afterEach(() => {
  resetTasksSessionStore()
  archiveMutateAsync.mockReset()
  deleteMutateAsync.mockReset()
})

describe("TaskList", () => {
  it("renders an empty state when no orchestration is selected", () => {
    render(
      <TaskList
        projectId="project-1"
        orchestrationId={null}
        selectedTaskId={null}
        onSelectTask={vi.fn()}
      />,
    )

    expect(
      screen.getByText("Select an orchestration to view its tasks."),
    ).toBeInTheDocument()
  })

  it("excludes archived tasks from the all tab while keeping them in archived", () => {
    act(() => {
      useTasksSessionStore.getState().hydrateOrchestrationTasks("orch-1", [
        buildTask({
          id: "task-active",
          title: "Active task",
          archivedAt: null,
        }),
        buildTask({
          id: "task-archived",
          title: "Archived task",
          archivedAt: "2026-03-18T08:00:00.000Z",
        }),
      ])
    })

    render(
      <TaskList
        projectId="project-1"
        orchestrationId="orch-1"
        selectedTaskId={null}
        onSelectTask={vi.fn()}
      />,
    )

    expect(screen.getByTestId("counts")).toHaveTextContent(
      "all:1|running:0|completed:1|archived:1",
    )
    expect(screen.getByText("Active task|active")).toBeInTheDocument()
    expect(screen.queryByText("Archived task|archived")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "archived" }))

    expect(screen.getByText("Archived task|archived")).toBeInTheDocument()
    expect(screen.queryByText("Active task|active")).not.toBeInTheDocument()
  })
})
