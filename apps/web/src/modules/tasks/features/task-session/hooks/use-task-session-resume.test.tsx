import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { TaskDetail } from "@/modules/tasks/contracts"
import { useTasksSessionStore } from "@/modules/tasks/store"

import { useTaskSessionResume } from "./use-task-session-resume"

const mutateAsync = vi.fn()
const cancelMutateAsync = vi.fn()
const uploadMutateAsync = vi.fn()
const cancelTaskMutation = {
  isPending: false,
  isError: false,
  error: null as unknown,
  mutateAsync: cancelMutateAsync,
}
const resumeTaskMutation = {
  isPending: false,
  isError: false,
  error: null as unknown,
  mutateAsync,
}
const uploadTaskInputImageMutation = {
  isPending: false,
  isError: false,
  error: null as unknown,
  mutateAsync: uploadMutateAsync,
}

vi.mock("@/modules/tasks/hooks/use-task-queries", () => ({
  useCancelTaskMutation: vi.fn(() => cancelTaskMutation),
  useResumeTaskMutation: vi.fn(() => resumeTaskMutation),
  useUploadTaskInputImageMutation: vi.fn(() => uploadTaskInputImageMutation),
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
    effort: null,
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
    cancelMutateAsync.mockReset()
    uploadMutateAsync.mockReset()
    cancelMutateAsync.mockResolvedValue(buildTask({ status: "cancelled" }))
    mutateAsync.mockResolvedValue(buildTask({ status: "queued" }))
    uploadMutateAsync.mockResolvedValue({
      path: ".harbor/task-input-images/example.png",
      mediaType: "image/png",
      name: "example.png",
      size: 1024,
    })
    cancelTaskMutation.isPending = false
    cancelTaskMutation.isError = false
    cancelTaskMutation.error = null
    resumeTaskMutation.isPending = false
    resumeTaskMutation.isError = false
    resumeTaskMutation.error = null
    uploadTaskInputImageMutation.isPending = false
    uploadTaskInputImageMutation.isError = false
    uploadTaskInputImageMutation.error = null
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
          input: "follow up",
        },
        pendingPrompt: null,
      })
    })
  })

  it("cancels a running task through the break action instead of resuming", async () => {
    const { result } = renderHook(() =>
      useTaskSessionResume({
        detail: buildTask({ status: "running" }),
        draft: "",
        lastSequence: 4,
        projectId: "project-1",
        taskId: "task-1",
      }),
    )

    await act(async () => {
      await result.current.handleCancelTask()
    })

    expect(cancelMutateAsync).toHaveBeenCalledWith({
      taskId: "task-1",
    })
    expect(mutateAsync).not.toHaveBeenCalled()
    expect(result.current.isCancelling).toBe(false)
  })

  it("auto-submits a queued prompt when running finishes", async () => {
    act(() => {
      useTasksSessionStore.getState().setDraft("task-1", "continue please")
      useTasksSessionStore.getState().setQueuedPrompt("task-1", {
        content: "continue please",
        input: "continue please",
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
      draftAttachments: [],
      queuedPrompt: null,
      pendingPrompt: {
        content: "continue please",
        baselineSequence: 7,
        input: "continue please",
      },
    })
  })

  it("uploads pasted images and resumes with structured items", async () => {
    const { result } = renderHook(() =>
      useTaskSessionResume({
        detail: buildTask({ status: "completed" }),
        draft: "review this screenshot",
        lastSequence: 2,
        projectId: "project-1",
        taskId: "task-1",
      }),
    )

    const file = new File([new Uint8Array([1, 2, 3])], "example.png", {
      type: "image/png",
    })

    await act(async () => {
      await result.current.handlePasteFiles([file])
    })

    expect(uploadMutateAsync).toHaveBeenCalledWith({
      file,
    })
    expect(result.current.draftAttachments).toEqual([
      {
        path: ".harbor/task-input-images/example.png",
        mediaType: "image/png",
        name: "example.png",
        size: 1024,
      },
    ])

    await act(async () => {
      await result.current.handleResumeTask()
    })

    expect(mutateAsync).toHaveBeenCalledWith({
      taskId: "task-1",
      items: [
        {
          type: "text",
          text: "review this screenshot",
        },
        {
          type: "local_image",
          path: ".harbor/task-input-images/example.png",
        },
      ],
    })
    expect(useTasksSessionStore.getState().chatUiByTaskId["task-1"]).toMatchObject({
      draft: "",
      draftAttachments: [],
      pendingPrompt: {
        content: "review this screenshot",
        baselineSequence: 2,
        input: [
          {
            type: "text",
            text: "review this screenshot",
          },
          {
            type: "local_image",
            path: ".harbor/task-input-images/example.png",
          },
        ],
      },
    })
  })
})
