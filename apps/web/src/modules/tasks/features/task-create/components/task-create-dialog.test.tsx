import type { ReactNode } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { TaskCreateDialog } from "./task-create-dialog"

const createTaskMutateAsync = vi.fn()

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    disabled,
    onClick,
    type = "button",
  }: {
    children: ReactNode
    disabled?: boolean
    onClick?: () => void
    type?: "button" | "submit" | "reset"
  }) => (
    <button type={type} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h1>{children}</h1>,
}))

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuRadioGroup: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuRadioItem: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}))

vi.mock("@/modules/tasks/components", () => ({
  ExecutorDropdown: ({ value }: { value: string }) => (
    <div>{value === "codex" ? "Codex" : "Claude Code"}</div>
  ),
  ModelDropdown: ({ value }: { value: string | null }) => <div>{value}</div>,
  EffortDropdown: ({ value }: { value: string | null }) => (
    <div>
      {value === "medium"
        ? "Medium"
        : value === "high"
          ? "High"
          : value === "low"
            ? "Low"
            : value === "minimal"
              ? "Minimal"
              : value === "xhigh"
                ? "X-High"
                : value}
    </div>
  ),
  ExecutionModeDropdown: ({ value }: { value: string }) => (
    <div>{value === "connected" ? "Normal" : value}</div>
  ),
  TaskInputComposer: ({
    attachments,
    canSubmit,
    controls,
    errorMessage,
    onChange,
    onSubmit,
    value,
  }: {
    attachments?: ReactNode
    canSubmit: boolean
    controls?: ReactNode
    errorMessage?: string | null
    onChange: (value: string) => void
    onSubmit: () => void
    value: string
  }) => (
    <div>
      <div>{controls}</div>
      <label>
        Prompt
        <textarea
          aria-label="Prompt"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      {attachments}
      {errorMessage ? <div>{errorMessage}</div> : null}
      <button type="button" disabled={!canSubmit} onClick={onSubmit}>
        Submit task
      </button>
    </div>
  ),
  TaskInputAttachmentList: () => null,
}))

vi.mock("@/modules/tasks/hooks/use-task-queries", () => ({
  useAgentCapabilitiesQuery: vi.fn(() => ({
    data: {
      agents: {
        codex: {
          models: [
            {
              id: "gpt-5.3-codex",
              displayName: "GPT-5.3 Codex",
              isDefault: true,
              efforts: ["low", "medium", "high"],
            },
          ],
        },
        "claude-code": {
          models: [
            {
              id: "claude-sonnet-4-6",
              displayName: "Claude Sonnet 4.6",
              isDefault: true,
              efforts: ["low", "medium", "high"],
            },
          ],
        },
      },
    },
  })),
  useCreateTaskMutation: vi.fn(() => ({
    isPending: false,
    mutateAsync: createTaskMutateAsync,
  })),
  useUploadTaskInputImageMutation: vi.fn(() => ({
    isPending: false,
    mutateAsync: vi.fn(),
  })),
}))

describe("TaskCreateDialog", () => {
  afterEach(() => {
    createTaskMutateAsync.mockReset()
    window.localStorage.clear()
  })

  it("initializes explicit runtime defaults and submits the full runtime config", async () => {
    createTaskMutateAsync.mockResolvedValue({
      id: "task-1",
    })

    const onTaskCreated = vi.fn()

    render(
      <TaskCreateDialog
        projectId="project-1"
        orchestrationId="orch-1"
        onTaskCreated={onTaskCreated}
      />,
    )

    expect(screen.getAllByText("Codex").length).toBeGreaterThan(0)
    expect(screen.getAllByText("gpt-5.3-codex").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Medium").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Normal").length).toBeGreaterThan(0)

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "Investigate runtime drift" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Submit task" }))

    await waitFor(() => {
      expect(createTaskMutateAsync).toHaveBeenCalledWith({
        prompt: "Investigate runtime drift",
        executor: "codex",
        model: "gpt-5.3-codex",
        executionMode: "connected",
        effort: "medium",
      })
    })

    expect(onTaskCreated).toHaveBeenCalledWith("task-1")
  })
})
