import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { UploadedTaskInputImage } from "@/modules/tasks/lib"

import { useTaskInputAttachments } from "./use-task-input-attachments"

const uploadMutateAsync = vi.fn()
const uploadTaskInputImageMutation = {
  isPending: false,
  isError: false,
  error: null as unknown,
  mutateAsync: uploadMutateAsync,
}

vi.mock("./use-task-queries", () => ({
  useUploadTaskInputImageMutation: vi.fn(() => uploadTaskInputImageMutation),
}))

describe("useTaskInputAttachments", () => {
  beforeEach(() => {
    uploadMutateAsync.mockReset()
    uploadMutateAsync.mockResolvedValue({
      path: ".harbor/task-input-images/example.png",
      mediaType: "image/png",
      name: "example.png",
      size: 1024,
    })
    uploadTaskInputImageMutation.isPending = false
    uploadTaskInputImageMutation.isError = false
    uploadTaskInputImageMutation.error = null
  })

  it("appends uploaded images to the current attachment list", async () => {
    let attachments: UploadedTaskInputImage[] = [
      {
        path: ".harbor/task-input-images/original.png",
        mediaType: "image/png",
        name: "original.png",
        size: 512,
      },
    ]

    const { result } = renderHook(() =>
      useTaskInputAttachments({
        projectId: "project-1",
        getAttachments: () => attachments,
        onAttachmentsChange: (nextAttachments) => {
          attachments = nextAttachments
        },
      }),
    )

    const file = new File([new Uint8Array([1, 2, 3])], "example.png", {
      type: "image/png",
    })

    await act(async () => {
      await result.current.uploadFiles([file])
    })

    expect(uploadMutateAsync).toHaveBeenCalledWith({ file })
    expect(attachments).toEqual([
      {
        path: ".harbor/task-input-images/original.png",
        mediaType: "image/png",
        name: "original.png",
        size: 512,
      },
      {
        path: ".harbor/task-input-images/example.png",
        mediaType: "image/png",
        name: "example.png",
        size: 1024,
      },
    ])
  })

  it("removes an attachment by path", () => {
    let attachments: UploadedTaskInputImage[] = [
      {
        path: ".harbor/task-input-images/keep.png",
        mediaType: "image/png",
        name: "keep.png",
        size: 512,
      },
      {
        path: ".harbor/task-input-images/remove.png",
        mediaType: "image/png",
        name: "remove.png",
        size: 256,
      },
    ]

    const { result } = renderHook(() =>
      useTaskInputAttachments({
        projectId: "project-1",
        getAttachments: () => attachments,
        onAttachmentsChange: (nextAttachments) => {
          attachments = nextAttachments
        },
      }),
    )

    act(() => {
      result.current.removeAttachment(".harbor/task-input-images/remove.png")
    })

    expect(attachments).toEqual([
      {
        path: ".harbor/task-input-images/keep.png",
        mediaType: "image/png",
        name: "keep.png",
        size: 512,
      },
    ])
  })

  it("skips uploads when uploading is disabled", async () => {
    let attachments: UploadedTaskInputImage[] = []

    const { result } = renderHook(() =>
      useTaskInputAttachments({
        canUpload: false,
        projectId: "project-1",
        getAttachments: () => attachments,
        onAttachmentsChange: (nextAttachments) => {
          attachments = nextAttachments
        },
      }),
    )

    const file = new File([new Uint8Array([1, 2, 3])], "example.png", {
      type: "image/png",
    })

    await act(async () => {
      await result.current.handlePasteFiles([file])
    })

    expect(uploadMutateAsync).not.toHaveBeenCalled()
    expect(attachments).toEqual([])
  })
})
