import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { TaskDetail } from "@/modules/tasks/contracts"
import { useTasksSessionStore } from "@/modules/tasks/domain/store"

import { useTaskSessionResume } from "./use-task-session-resume"

const mutateAsync = vi.fn()
const resumeTaskMutation = {
  isPending: false,
  isError: false,
  error: null as unknown,
  mutateAsync,
}

vi.mock("@/modules/tasks/hooks/use-task-queries", () => ({
  useResumeTaskMutation: vi.fn(() => resumeTaskMutation),
}))

function buildTask(overrides: Partial<TaskDetail> = {}): TaskDetail {
  return {
    taskId: "task-1",
    projectId: "project-1",
    prompt: "Ship it",
    title: "Ship it",
    titleSource: "prompt",
    model: null,
    executor: "codex",
    executionMode: "connected",
    status: "queued",
    archivedAt: null,
    createdAt: "2026-03-13T00:00:00.000Z",
    startedAt: null,
    finishedAt: null,
    ...overrides,
  }
}

function resetTasksSessionStore() {
  act(() => {
    useTasksSessionStore.setState({
      tasksById: {},
      taskIdsByProject: {},
      eventStreamsByTaskId: {},
      chatUiByTaskId: {},
    })
  })
}

describe("useTaskSessionResume", () => {
  beforeEach(() => {
    resetTasksSessionStore()
    mutateAsync.mockReset()
    mutateAsync.mockResolvedValue(buildTask({ status: "queued" }))
    resumeTaskMutation.isPending = false
    resumeTaskMutation.isError = false
    resumeTaskMutation.error = null
  })

  afterEach(() => {
    resetTasksSessionStore()
  })

  it("keeps the input enabled and queues the next prompt while running", async () => {
    const { result } = renderHook(() =>
      useTaskSessionResume({
        detail: buildTask({ status: "running" }),
        draft: "follow up",
        lastSequence: 4,
        projectId: "project-1",
        taskId: "task-1",
      }),
    )

    expect(result.current.inputDisabled).toBe(false)
    expect(result.current.canResume).toBe(true)

    await act(async () => {
      await result.current.handleResumeTask()
    })

    expect(mutateAsync).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(useTasksSessionStore.getState().chatUiByTaskId["task-1"]).toMatchObject({
        draft: "",
        queuedPrompt: {
          content: "follow up",
        },
        pendingPrompt: null,
      })
    })
  })

  it("auto-submits a queued prompt when running finishes", async () => {
    act(() => {
      useTasksSessionStore.getState().setDraft("task-1", "continue please")
      useTasksSessionStore.getState().setQueuedPrompt("task-1", {
        content: "continue please",
      })
    })

    const { rerender } = renderHook(
      ({ detail, draft }) =>
        useTaskSessionResume({
          detail,
          draft,
          lastSequence: 7,
          projectId: "project-1",
          taskId: "task-1",
        }),
      {
        initialProps: {
          detail: buildTask({ status: "running" }),
          draft: "continue please",
        },
      },
    )

    rerender({
      detail: buildTask({ status: "completed" }),
      draft: "continue please",
    })

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        taskId: "task-1",
        prompt: "continue please",
      })
    })

    expect(useTasksSessionStore.getState().chatUiByTaskId["task-1"]).toMatchObject({
      draft: "",
      queuedPrompt: null,
      pendingPrompt: {
        content: "continue please",
        baselineSequence: 7,
      },
    })
  })
})
