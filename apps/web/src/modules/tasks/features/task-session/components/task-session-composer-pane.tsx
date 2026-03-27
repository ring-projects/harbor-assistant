"use client"

import { WifiIcon } from "lucide-react"
import { memo } from "react"

import {
  selectChatUi,
  selectLastSequence,
  useTasksSessionStore,
} from "@/modules/tasks/domain/store"
import {
  TERMINAL_TASK_STATUSES,
  type TaskDetail,
} from "@/modules/tasks/contracts"
import {
  formatExecutionModeLabel,
  formatExecutorLabel,
} from "@/modules/tasks/domain/lib"

import { ChatInteraction } from "../composer"
import { useTaskSessionResume } from "../hooks/use-task-session-resume"

function helperText(detail: TaskDetail | null | undefined) {
  if (!detail) {
    return "Loading task session details..."
  }

  if (detail.archivedAt) {
    return "Archived tasks are read-only and cannot be resumed."
  }

  if (detail.status === "running") {
    return "This task is still running. You can draft and queue the next prompt now."
  }

  if (TERMINAL_TASK_STATUSES.includes(detail.status)) {
    return ""
  }

  return "This task is not ready to accept new input yet."
}

function queuedHelperText(detail: TaskDetail | null | undefined, hasQueuedPrompt: boolean) {
  if (!hasQueuedPrompt) {
    return helperText(detail)
  }

  if (detail?.status === "running") {
    return "Next prompt is queued. It will send automatically when the current turn finishes."
  }

  return helperText(detail)
}

type TaskSessionComposerPaneProps = {
  detail: TaskDetail | null | undefined
  projectId: string
  taskId: string
}

export const TaskSessionComposerPane = memo(function TaskSessionComposerPane({
  detail,
  projectId,
  taskId,
}: TaskSessionComposerPaneProps) {
  const draft = useTasksSessionStore((state) => selectChatUi(state, taskId).draft)
  const queuedPrompt = useTasksSessionStore(
    (state) => selectChatUi(state, taskId).queuedPrompt,
  )
  const lastSequence = useTasksSessionStore((state) => selectLastSequence(state, taskId))
  const {
    canResume,
    errorMessage,
    handleResumeTask,
    inputDisabled,
    isSubmitting,
    updateDraft,
  } = useTaskSessionResume({
    detail,
    draft,
    lastSequence,
    projectId,
    taskId,
  })

  return (
    <div className="min-h-0">
      <ChatInteraction
        canSubmit={canResume && draft.trim().length > 0}
        inputDisabled={inputDisabled}
        isSubmitting={isSubmitting}
        helperText={queuedHelperText(detail, Boolean(queuedPrompt))}
        placeholder={
          detail?.status === "running"
            ? queuedPrompt
              ? "Queued prompt will auto-send when this turn finishes..."
              : "Draft the next prompt while this turn finishes..."
            : "Resume this execution with a new prompt..."
        }
        value={draft}
        controls={
          detail ? (
            <>
              {detail.executor ? (
                <span className="inline-flex h-8 items-center gap-2 rounded-md bg-background/35 px-3 font-mono text-[11px] font-medium text-foreground/80">
                  <span>{formatExecutorLabel(detail.executor)}</span>
                </span>
              ) : null}
              <span className="inline-flex h-8 items-center gap-2 rounded-md bg-background/35 px-3 font-mono text-[11px] font-medium text-foreground/80">
                <WifiIcon className="size-3.5 text-muted-foreground" />
                <span>{formatExecutionModeLabel(detail.executionMode ?? "connected")}</span>
              </span>
              {detail.model ? (
                <span className="inline-flex h-8 items-center gap-2 rounded-md bg-background/35 px-3 font-mono text-[11px] font-medium text-foreground/80">
                  <span>{detail.model}</span>
                </span>
              ) : null}
            </>
          ) : null
        }
        footer={
          queuedPrompt ? (
            <p className="font-mono text-[11px] leading-5 text-amber-700">
              Queued for auto-send. Edits here update the pending next turn.
            </p>
          ) : null
        }
        errorMessage={errorMessage}
        onChange={updateDraft}
        onSubmit={() => {
          void handleResumeTask()
        }}
      />
    </div>
  )
})
