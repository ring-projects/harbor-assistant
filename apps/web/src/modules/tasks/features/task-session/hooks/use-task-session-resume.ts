"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"

import { TERMINAL_TASK_STATUSES, type TaskDetail } from "@/modules/tasks/contracts"
import {
  selectChatUi,
  useTasksSessionStore,
} from "@/modules/tasks/store"
import {
  buildTaskInput,
  summarizeTaskInput,
  type TaskInput,
  type UploadedTaskInputImage,
} from "@/modules/tasks/lib"
import { getErrorMessage } from "@/modules/tasks/view-models"
import {
  useResumeTaskMutation,
  useUploadTaskInputImageMutation,
} from "@/modules/tasks/hooks/use-task-queries"

export function useTaskSessionResume(args: {
  detail: TaskDetail | null | undefined
  draft: string
  lastSequence: number
  projectId: string
  taskId: string | null
}) {
  const resumeTaskMutation = useResumeTaskMutation(args.projectId)
  const uploadTaskInputImageMutation = useUploadTaskInputImageMutation(args.projectId)
  const draftAttachments = useTasksSessionStore((state) =>
    selectChatUi(state, args.taskId).draftAttachments,
  )
  const queuedPrompt = useTasksSessionStore((state) =>
    selectChatUi(state, args.taskId).queuedPrompt,
  )
  const previousStatusRef = useRef<TaskDetail["status"] | null>(
    args.detail?.status ?? null,
  )

  const canResume =
    Boolean(args.taskId) &&
    args.detail?.archivedAt === null &&
    Boolean(
      args.detail?.status &&
        (args.detail.status === "running" ||
          TERMINAL_TASK_STATUSES.includes(args.detail.status)),
    ) &&
    !resumeTaskMutation.isPending &&
    !uploadTaskInputImageMutation.isPending

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

  const errorMessage = useMemo(
    () => {
      if (uploadTaskInputImageMutation.isError) {
        return getErrorMessage(uploadTaskInputImageMutation.error)
      }

      return resumeTaskMutation.isError
        ? getErrorMessage(resumeTaskMutation.error)
        : null
    },
    [
      resumeTaskMutation.error,
      resumeTaskMutation.isError,
      uploadTaskInputImageMutation.error,
      uploadTaskInputImageMutation.isError,
    ],
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
          })
        } else {
          await resumeTaskMutation.mutateAsync({
            taskId: args.taskId,
            items: input,
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
    [args.lastSequence, args.taskId, resumeTaskMutation],
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

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!args.taskId || files.length === 0) {
        return
      }

      const uploaded = await Promise.all(
        files.map((file) =>
          uploadTaskInputImageMutation.mutateAsync({
            file,
          }),
        ),
      )

      const currentDraftAttachments =
        useTasksSessionStore.getState().chatUiByTaskId[args.taskId]?.draftAttachments ??
        draftAttachments

      updateDraftAttachments([...currentDraftAttachments, ...uploaded])
    },
    [
      args.taskId,
      draftAttachments,
      updateDraftAttachments,
      uploadTaskInputImageMutation,
    ],
  )

  const handlePasteFiles = useCallback(
    async (files: File[]) => {
      await uploadFiles(files)
    },
    [uploadFiles],
  )

  const handleDropFiles = useCallback(
    async (files: File[]) => {
      await uploadFiles(files)
    },
    [uploadFiles],
  )

  const removeDraftAttachment = useCallback(
    (path: string) => {
      updateDraftAttachments(
        draftAttachments.filter((attachment) => attachment.path !== path),
      )
    },
    [draftAttachments, updateDraftAttachments],
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
      uploadTaskInputImageMutation.isPending
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
    uploadTaskInputImageMutation.isPending,
  ])

  return {
    canResume,
    draftAttachments,
    errorMessage,
    handleDropFiles,
    handlePasteFiles,
    handleResumeTask,
    inputDisabled,
    isSubmitting:
      resumeTaskMutation.isPending || uploadTaskInputImageMutation.isPending,
    removeDraftAttachment,
    updateDraft,
  }
}
