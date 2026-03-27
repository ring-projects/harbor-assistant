"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"

import { TERMINAL_TASK_STATUSES, type TaskDetail } from "@/modules/tasks/contracts"
import {
  selectChatUi,
  useTasksSessionStore,
} from "@/modules/tasks/domain/store"
import { useResumeTaskMutation } from "@/modules/tasks/hooks/use-task-queries"

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return "Failed to load. Please try again."
}

export function useTaskSessionResume(args: {
  detail: TaskDetail | null | undefined
  draft: string
  lastSequence: number
  projectId: string
  taskId: string | null
}) {
  const resumeTaskMutation = useResumeTaskMutation(args.projectId)
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
    !resumeTaskMutation.isPending

  const inputDisabled =
    !args.taskId ||
    !args.detail ||
    !(
      args.detail.status === "running" ||
      TERMINAL_TASK_STATUSES.includes(args.detail.status)
    ) ||
    args.detail.archivedAt !== null

  const errorMessage = useMemo(
    () =>
      resumeTaskMutation.isError ? getErrorMessage(resumeTaskMutation.error) : null,
    [resumeTaskMutation.error, resumeTaskMutation.isError],
  )

  const updateDraft = useCallback(
    (value: string) => {
      if (!args.taskId) {
        return
      }

      const trimmedValue = value.trim()
      const store = useTasksSessionStore.getState()

      store.setDraft(args.taskId, value)

      if (!store.chatUiByTaskId[args.taskId]?.queuedPrompt) {
        return
      }

      store.setQueuedPrompt(
        args.taskId,
        trimmedValue ? { content: value } : null,
      )
    },
    [args.taskId],
  )

  const submitPrompt = useCallback(
    async (prompt: string, options?: { restoreQueuedPromptOnFailure?: boolean }) => {
      if (!args.taskId) {
        return
      }

      const store = useTasksSessionStore.getState()

      store.setQueuedPrompt(args.taskId, null)
      store.setPendingPrompt(args.taskId, {
        content: prompt,
        baselineSequence: args.lastSequence,
      })

      try {
        await resumeTaskMutation.mutateAsync({
          taskId: args.taskId,
          prompt,
        })
        store.setDraft(args.taskId, "")
      } catch {
        store.setPendingPrompt(args.taskId, null)

        if (options?.restoreQueuedPromptOnFailure) {
          store.setQueuedPrompt(args.taskId, { content: prompt })
        }
      }
    },
    [args.lastSequence, args.taskId, resumeTaskMutation],
  )

  const handleResumeTask = useCallback(async () => {
    if (!args.taskId || !args.detail) {
      return
    }

    const prompt = args.draft.trim()
    if (!prompt) {
      return
    }

    if (args.detail.status === "running") {
      useTasksSessionStore.getState().setQueuedPrompt(args.taskId, {
        content: args.draft,
      })
      return
    }

    if (!TERMINAL_TASK_STATUSES.includes(args.detail.status)) {
      return
    }

    await submitPrompt(prompt, {
      restoreQueuedPromptOnFailure: Boolean(queuedPrompt),
    })
  }, [args.detail, args.draft, args.taskId, queuedPrompt, submitPrompt])

  useEffect(() => {
    const previousStatus = previousStatusRef.current
    const currentStatus = args.detail?.status ?? null

    previousStatusRef.current = currentStatus

    if (
      previousStatus !== "running" ||
      !currentStatus ||
      !TERMINAL_TASK_STATUSES.includes(currentStatus) ||
      !queuedPrompt ||
      resumeTaskMutation.isPending
    ) {
      return
    }

    const prompt = queuedPrompt.content.trim()
    if (!prompt) {
      if (args.taskId) {
        useTasksSessionStore.getState().setQueuedPrompt(args.taskId, null)
      }
      return
    }

    void submitPrompt(prompt, {
      restoreQueuedPromptOnFailure: true,
    })
  }, [args.detail?.status, args.taskId, queuedPrompt, resumeTaskMutation.isPending, submitPrompt])

  return {
    canResume,
    errorMessage,
    handleResumeTask,
    inputDisabled,
    isSubmitting: resumeTaskMutation.isPending,
    updateDraft,
  }
}
