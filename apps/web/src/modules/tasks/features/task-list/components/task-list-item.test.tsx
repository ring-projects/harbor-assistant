import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import type { TaskListItem as TaskListItemRecord } from "@/modules/tasks/contracts"

vi.mock("@/components/ui/button", () => ({
  Button: ({
    "aria-label": ariaLabel,
    children,
    className,
    disabled,
    onClick,
  }: {
    "aria-label"?: string
    children: ReactNode
    className?: string
    disabled?: boolean
    onClick?: () => void
  }) => (
    <div
      role="button"
      aria-label={ariaLabel}
      aria-disabled={disabled}
      className={className}
      onClick={onClick}
    >
      {children}
    </div>
  ),
}))

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: ReactNode
    onClick?: () => void
  }) => (
    <div role="menuitem" onClick={onClick}>
      {children}
    </div>
  ),
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

import { TaskListItem } from "./task-list-item"

function buildTask(overrides: Partial<TaskListItemRecord> = {}): TaskListItemRecord {
  return {
    id: "task-1",
    projectId: "project-1",
    orchestrationId: "orch-1",
    prompt: "Summarize the current release plan",
    title:
      "This is a very long task title meant to verify the task item title only shows up to two lines in the sidebar list",
    titleSource: "prompt",
    model: "gpt-5",
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

describe("TaskListItem", () => {
  it("clamps the task title to two lines", () => {
    const task = buildTask()

    render(
      <TaskListItem
        task={task}
        isActive={false}
        onSelectTask={vi.fn()}
        onDeleteTask={vi.fn()}
      />,
    )

    expect(screen.getByText(task.title)).toHaveClass("line-clamp-2")
  })

  it("supports keyboard selection on the task item", () => {
    const task = buildTask()
    const onSelectTask = vi.fn()

    render(
      <TaskListItem
        task={task}
        isActive={false}
        onSelectTask={onSelectTask}
        onDeleteTask={vi.fn()}
      />,
    )

    const taskItem = screen.getByRole("button", { name: task.title })

    fireEvent.keyDown(taskItem, { key: "Enter" })
    fireEvent.keyDown(taskItem, { key: " " })

    expect(onSelectTask).toHaveBeenCalledTimes(2)
    expect(onSelectTask).toHaveBeenNthCalledWith(1, task.id)
    expect(onSelectTask).toHaveBeenNthCalledWith(2, task.id)
  })

  it("does not select the task when opening the actions menu", () => {
    const task = buildTask()
    const onSelectTask = vi.fn()

    render(
      <TaskListItem
        task={task}
        isActive={false}
        onSelectTask={onSelectTask}
        onDeleteTask={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByLabelText(`Task actions for ${task.title}`))

    expect(onSelectTask).not.toHaveBeenCalled()
  })
})
