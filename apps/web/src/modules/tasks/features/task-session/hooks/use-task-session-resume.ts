"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"

import {
  TERMINAL_TASK_STATUSES,
  type TaskDetail,
  type TaskEffort,
} from "@/modules/tasks/contracts"
import { selectChatUi, useTasksSessionStore } from "@/modules/tasks/store"
import {
  buildTaskInput,
  summarizeTaskInput,
  type TaskInput,
  type UploadedTaskInputImage,
} from "@/modules/tasks/lib"
import { getErrorMessage } from "@/modules/tasks/view-models"
import {
  useCancelTaskMutation,
  useResumeTaskMutation,
} from "@/modules/tasks/hooks/use-task-queries"
import { useTaskInputAttachments } from "@/modules/tasks/hooks/use-task-input-attachments"
import { trackTaskEvent } from "@/modules/tasks/telemetry"

export function useTaskSessionResume(args: {
  detail: TaskDetail | null | undefined
  draft: string
  lastSequence: number
  projectId: string
  taskId: string | null
  runtimeConfig: {
    model: string | null
    effort: TaskEffort | null
  }
}) {
  const cancelTaskMutation = useCancelTaskMutation(args.projectId)
  const resumeTaskMutation = useResumeTaskMutation(args.projectId)
  const draftAttachments = useTasksSessionStore(
    (state) => selectChatUi(state, args.taskId).draftAttachments,
  )
  const queuedPrompt = useTasksSessionStore(
    (state) => selectChatUi(state, args.taskId).queuedPrompt,
  )
  const previousStatusRef = useRef<TaskDetail["status"] | null>(
    args.detail?.status ?? null,
  )

  const inputDisabled =
    !args.taskId ||
    !args.detail ||
    !(
      args.detail.status === "running" ||
      TERMINAL_TASK_STATUSES.includes(args.detail.status)
    ) ||
    args.detail.archivedAt !== null

  const currentInput = useMemo(
    () =>
      buildTaskInput({
        text: args.draft,
        attachments: draftAttachments,
      }),
    [args.draft, draftAttachments],
  )

  const updateDraft = useCallback(
    (value: string) => {
      if (!args.taskId) {
        return
      }

      const store = useTasksSessionStore.getState()

      store.setDraft(args.taskId, value)

      if (!store.chatUiByTaskId[args.taskId]?.queuedPrompt) {
        return
      }

      const nextInput = buildTaskInput({
        text: value,
        attachments: store.chatUiByTaskId[args.taskId]?.draftAttachments ?? [],
      })
      store.setQueuedPrompt(
        args.taskId,
        nextInput
          ? {
              content: summarizeTaskInput(nextInput),
              input: nextInput,
            }
          : null,
      )
    },
    [args.taskId],
  )

  const updateDraftAttachments = useCallback(
    (nextDraftAttachments: UploadedTaskInputImage[]) => {
      if (!args.taskId) {
        return
      }

      const store = useTasksSessionStore.getState()
      store.setDraftAttachments(args.taskId, nextDraftAttachments)

      if (!store.chatUiByTaskId[args.taskId]?.queuedPrompt) {
        return
      }

      const nextInput = buildTaskInput({
        text: store.chatUiByTaskId[args.taskId]?.draft ?? "",
        attachments: nextDraftAttachments,
      })
      store.setQueuedPrompt(
        args.taskId,
        nextInput
          ? {
              content: summarizeTaskInput(nextInput),
              input: nextInput,
            }
          : null,
      )
    },
    [args.taskId],
  )

  const {
    handleDropFiles,
    handlePasteFiles,
    isUploading,
    removeAttachment,
    uploadTaskInputImageMutation,
  } = useTaskInputAttachments({
    canUpload: Boolean(args.taskId),
    projectId: args.projectId,
    getAttachments: () => {
      if (!args.taskId) {
        return []
      }

      return (
        useTasksSessionStore.getState().chatUiByTaskId[args.taskId]
          ?.draftAttachments ?? []
      )
    },
    onAttachmentsChange: updateDraftAttachments,
  })

  const canResume =
    Boolean(args.taskId) &&
    args.detail?.archivedAt === null &&
    Boolean(
      args.detail?.status &&
      (args.detail.status === "running" ||
        TERMINAL_TASK_STATUSES.includes(args.detail.status)),
    ) &&
    !cancelTaskMutation.isPending &&
    !resumeTaskMutation.isPending &&
    !isUploading

  const errorMessage = useMemo(() => {
    if (uploadTaskInputImageMutation.isError) {
      return getErrorMessage(uploadTaskInputImageMutation.error)
    }

    if (cancelTaskMutation.isError) {
      return getErrorMessage(cancelTaskMutation.error)
    }

    return resumeTaskMutation.isError
      ? getErrorMessage(resumeTaskMutation.error)
      : null
  }, [
    cancelTaskMutation.error,
    cancelTaskMutation.isError,
    resumeTaskMutation.error,
    resumeTaskMutation.isError,
    uploadTaskInputImageMutation.error,
    uploadTaskInputImageMutation.isError,
  ])

  const submitInput = useCallback(
    async (
      input: TaskInput,
      options?: { restoreQueuedPromptOnFailure?: boolean },
    ) => {
      if (!args.taskId) {
        return
      }

      const store = useTasksSessionStore.getState()
      const content = summarizeTaskInput(input)

      store.setQueuedPrompt(args.taskId, null)
      store.setPendingPrompt(args.taskId, {
        content,
        baselineSequence: args.lastSequence,
        input,
      })

      try {
        if (typeof input === "string") {
          await resumeTaskMutation.mutateAsync({
            taskId: args.taskId,
            prompt: input,
            model: args.runtimeConfig.model,
            effort: args.runtimeConfig.effort,
          })
        } else {
          await resumeTaskMutation.mutateAsync({
            taskId: args.taskId,
            items: input,
            model: args.runtimeConfig.model,
            effort: args.runtimeConfig.effort,
          })
        }
        store.setDraft(args.taskId, "")
        store.setDraftAttachments(args.taskId, [])
      } catch {
        store.setPendingPrompt(args.taskId, null)

        if (options?.restoreQueuedPromptOnFailure) {
          store.setQueuedPrompt(args.taskId, { content, input })
        }
      }
    },
    [
      args.lastSequence,
      args.runtimeConfig.effort,
      args.runtimeConfig.model,
      args.taskId,
      resumeTaskMutation,
    ],
  )

  const handleResumeTask = useCallback(async () => {
    if (!args.taskId || !args.detail) {
      return
    }

    if (!currentInput) {
      return
    }

    const content = summarizeTaskInput(currentInput)

    if (args.detail.status === "running") {
      useTasksSessionStore.getState().setQueuedPrompt(args.taskId, {
        content,
        input: currentInput,
      })
      return
    }

    if (!TERMINAL_TASK_STATUSES.includes(args.detail.status)) {
      return
    }

    await submitInput(currentInput, {
      restoreQueuedPromptOnFailure: Boolean(queuedPrompt),
    })
  }, [args.detail, args.taskId, currentInput, queuedPrompt, submitInput])

  const handleCancelTask = useCallback(async () => {
    if (
      !args.taskId ||
      args.detail?.status !== "running" ||
      cancelTaskMutation.isPending
    ) {
      return
    }

    trackTaskEvent("task_break_clicked", {
      projectId: args.projectId,
      taskId: args.taskId,
    })

    try {
      await cancelTaskMutation.mutateAsync({
        taskId: args.taskId,
      })
      trackTaskEvent("task_break_succeeded", {
        projectId: args.projectId,
        taskId: args.taskId,
      })
    } catch (error) {
      trackTaskEvent("task_break_failed", {
        projectId: args.projectId,
        taskId: args.taskId,
        message: getErrorMessage(error),
      })
    }
  }, [args.detail?.status, args.projectId, args.taskId, cancelTaskMutation])

  const removeDraftAttachment = useCallback(
    (path: string) => {
      removeAttachment(path)
    },
    [removeAttachment],
  )

  useEffect(() => {
    const previousStatus = previousStatusRef.current
    const currentStatus = args.detail?.status ?? null

    previousStatusRef.current = currentStatus

    if (
      previousStatus !== "running" ||
      !currentStatus ||
      !TERMINAL_TASK_STATUSES.includes(currentStatus) ||
      !queuedPrompt ||
      resumeTaskMutation.isPending ||
      isUploading
    ) {
      return
    }

    if (!queuedPrompt.input) {
      if (args.taskId) {
        useTasksSessionStore.getState().setQueuedPrompt(args.taskId, null)
      }
      return
    }

    void submitInput(queuedPrompt.input, {
      restoreQueuedPromptOnFailure: true,
    })
  }, [
    args.detail?.status,
    args.taskId,
    queuedPrompt,
    resumeTaskMutation.isPending,
    submitInput,
    isUploading,
  ])

  return {
    canResume,
    draftAttachments,
    errorMessage,
    handleDropFiles,
    handleCancelTask,
    handlePasteFiles,
    handleResumeTask,
    inputDisabled,
    isSubmitting:
      cancelTaskMutation.isPending ||
      resumeTaskMutation.isPending ||
      isUploading,
    isCancelling: cancelTaskMutation.isPending,
    removeDraftAttachment,
    updateDraft,
  }
}
