"use client"

import { memo, useMemo, useState } from "react"

import {
  selectChatUi,
  selectLastSequence,
  useTasksSessionStore,
} from "@/modules/tasks/store"
import {
  type TaskDetail,
  type TaskEffort,
} from "@/modules/tasks/contracts"
import { buildTaskInput } from "@/modules/tasks/lib"
import { useAgentCapabilitiesQuery } from "@/modules/tasks/hooks/use-task-queries"

import {
  EffortDropdown,
  ExecutionModeBadge,
  ExecutorBadge,
  ModelDropdown,
  TaskInputAttachmentList,
  TaskInputComposer,
} from "@/modules/tasks/components"
import { useTaskSessionResume } from "../hooks/use-task-session-resume"

type TaskSessionComposerPaneProps = {
  detail: TaskDetail | null | undefined
  projectId: string
  taskId: string
}

type TaskSessionComposerPaneContentProps = TaskSessionComposerPaneProps

const TaskSessionComposerPaneContent = memo(function TaskSessionComposerPaneContent({
  detail,
  projectId,
  taskId,
}: TaskSessionComposerPaneContentProps) {
  const draft = useTasksSessionStore((state) => selectChatUi(state, taskId).draft)
  const queuedPrompt = useTasksSessionStore(
    (state) => selectChatUi(state, taskId).queuedPrompt,
  )
  const lastSequence = useTasksSessionStore((state) => selectLastSequence(state, taskId))
  const [selectedModel, setSelectedModel] = useState<string | null>(detail?.model ?? null)
  const [selectedEffort, setSelectedEffort] = useState<TaskEffort | null>(
    detail?.effort ?? null,
  )
  const agentCapabilitiesQuery = useAgentCapabilitiesQuery({
    enabled: Boolean(detail?.executor),
  })
  const selectedExecutorCapabilities = useMemo(() => {
    if (detail?.executor === "claude-code") {
      return agentCapabilitiesQuery.data?.agents["claude-code"] ?? null
    }

    if (detail?.executor === "codex") {
      return agentCapabilitiesQuery.data?.agents.codex ?? null
    }

    return null
  }, [agentCapabilitiesQuery.data?.agents, detail?.executor])
  const selectedExecutorModels = useMemo(
    () => selectedExecutorCapabilities?.models ?? [],
    [selectedExecutorCapabilities],
  )
  const resolvedModelConfig = useMemo(() => {
    if (selectedModel) {
      return selectedExecutorModels.find((model) => model.id === selectedModel) ?? null
    }

    return selectedExecutorModels.find((model) => model.isDefault) ?? null
  }, [selectedExecutorModels, selectedModel])
  const selectedEffortOptions = useMemo(
    () => resolvedModelConfig?.efforts ?? [],
    [resolvedModelConfig],
  )

  const {
    canResume,
    draftAttachments,
    errorMessage,
    handleCancelTask,
    handleDropFiles,
    handlePasteFiles,
    handleResumeTask,
    inputDisabled,
    isCancelling,
    isSubmitting,
    removeDraftAttachment,
    updateDraft,
  } = useTaskSessionResume({
    detail,
    draft,
    lastSequence,
    projectId,
    taskId,
    runtimeConfig: {
      model: selectedModel,
      effort: selectedEffort,
    },
  })
  const canSubmit = canResume && Boolean(buildTaskInput({
    text: draft,
    attachments: draftAttachments,
  }))

  return (
    <div className="min-h-0">
      <TaskInputComposer
        canSubmit={canSubmit}
        actionMode={detail?.status === "running" ? "break" : "send"}
        actionDisabled={
          detail?.status === "running"
            ? isCancelling
            : undefined
        }
        inputDisabled={inputDisabled}
        isSubmitting={isSubmitting}
        placeholder={
          detail?.status === "running"
            ? queuedPrompt
              ? "Queued prompt will auto-send when this turn finishes..."
              : "Draft the next prompt while this turn finishes..."
            : "Resume this execution with a new prompt..."
        }
        value={draft}
        attachments={
          <TaskInputAttachmentList
            attachments={draftAttachments}
            disabled={isSubmitting}
            onRemove={removeDraftAttachment}
          />
        }
        controls={
          detail ? (
            <>
              <ExecutorBadge value={detail.executor} />
              <ExecutionModeBadge value={detail.executionMode} />
              <ModelDropdown
                buttonClassName="h-8 rounded-md border-border/70 bg-background/60 px-3 text-[11px] font-medium shadow-none"
                defaultOptionLabel="Runtime Default"
                disabled={isSubmitting || inputDisabled}
                executor={detail.executor ?? "executor"}
                models={selectedExecutorModels}
                value={selectedModel}
                onValueChange={(nextModel) => {
                  const nextModelConfig = nextModel
                    ? selectedExecutorModels.find((model) => model.id === nextModel) ?? null
                    : selectedExecutorModels.find((model) => model.isDefault) ?? null

                  setSelectedModel(nextModel)
                  if (
                    selectedEffort &&
                    nextModelConfig &&
                    !nextModelConfig.efforts.includes(selectedEffort)
                  ) {
                    setSelectedEffort(null)
                  }
                }}
              />
              <EffortDropdown
                buttonClassName="h-8 rounded-md border-border/70 bg-background/60 px-3 text-[11px] font-medium shadow-none"
                defaultOptionLabel="Provider Default"
                disabled={isSubmitting || inputDisabled}
                efforts={selectedEffortOptions}
                value={selectedEffort}
                onValueChange={setSelectedEffort}
              />
            </>
          ) : null
        }
        errorMessage={errorMessage}
        onChange={updateDraft}
        onPasteFiles={(files) => {
          void handlePasteFiles(files)
        }}
        onDropFiles={(files) => {
          void handleDropFiles(files)
        }}
        onSubmit={() => {
          void handleResumeTask()
        }}
        onAction={() => {
          if (detail?.status === "running") {
            void handleCancelTask()
            return
          }

          void handleResumeTask()
        }}
      />
    </div>
  )
})

export const TaskSessionComposerPane = memo(function TaskSessionComposerPane(
  props: TaskSessionComposerPaneProps,
) {
  const runtimeSnapshotKey = `${props.taskId}:${props.detail?.model ?? "runtime-default"}:${props.detail?.effort ?? "provider-default"}`

  return (
    <TaskSessionComposerPaneContent
      key={runtimeSnapshotKey}
      detail={props.detail}
      projectId={props.projectId}
      taskId={props.taskId}
    />
  )
})
