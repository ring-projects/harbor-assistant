"use client"

import { PlusIcon } from "lucide-react"
import { type ReactNode, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  EffortDropdown,
  ExecutorDropdown,
  ModelDropdown,
  TaskInputAttachmentList,
  TaskInputComposer,
} from "@/modules/tasks/components"
import { useTaskInputAttachments } from "@/modules/tasks/hooks"
import {
  buildTaskInput,
  summarizeTaskInput,
  type UploadedTaskInputImage,
} from "@/modules/tasks/lib"
import { getErrorMessage } from "@/modules/tasks/view-models"
import { useBootstrapOrchestrationMutation } from "@/modules/orchestrations/hooks"
import { useTaskCreationParams } from "@/modules/tasks/features/task-create/use-task-creation-params"

type OrchestrationCreateDialogProps = {
  projectId: string
  onCreated: (orchestrationId: string) => void
  trigger?: ReactNode
}

export function OrchestrationCreateDialog({
  projectId,
  onCreated,
  trigger,
}: OrchestrationCreateDialogProps) {
  const [open, setOpen] = useState(false)
  const [initialTaskPrompt, setInitialTaskPrompt] = useState("")
  const [initialTaskAttachments, setInitialTaskAttachments] = useState<
    UploadedTaskInputImage[]
  >([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const taskCreationParams = useTaskCreationParams()
  const bootstrapMutation = useBootstrapOrchestrationMutation(projectId)
  const {
    handleDropFiles,
    handlePasteFiles,
    isUploading,
    uploadTaskInputImageMutation,
    removeAttachment,
  } = useTaskInputAttachments({
    projectId,
    getAttachments: () => initialTaskAttachments,
    onAttachmentsChange: setInitialTaskAttachments,
  })
  const initialTaskInput = useMemo(
    () =>
      buildTaskInput({
        text: initialTaskPrompt,
        attachments: initialTaskAttachments,
      }),
    [initialTaskAttachments, initialTaskPrompt],
  )

  function reset() {
    setInitialTaskPrompt("")
    setInitialTaskAttachments([])
    setErrorMessage(null)
  }

  async function handleSubmit() {
    if (!initialTaskInput) {
      setErrorMessage(
        "Enter a prompt or attach an image before starting the session.",
      )
      return
    }

    if (!taskCreationParams.model || !taskCreationParams.effort) {
      setErrorMessage(
        "Wait for runtime options to load before starting the session.",
      )
      return
    }

    try {
      setErrorMessage(null)
      const result = await bootstrapMutation.mutateAsync({
        initialTask:
          typeof initialTaskInput === "string"
            ? {
                prompt: initialTaskInput,
                model: taskCreationParams.model,
                executor: taskCreationParams.executor,
                executionMode: taskCreationParams.executionMode,
                effort: taskCreationParams.effort,
              }
            : {
                items: initialTaskInput,
                title: summarizeTaskInput(initialTaskInput),
                model: taskCreationParams.model,
                executor: taskCreationParams.executor,
                executionMode: taskCreationParams.executionMode,
                effort: taskCreationParams.effort,
              },
      })
      reset()
      setOpen(false)
      onCreated(result.orchestration.id)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    }
  }

  const composerErrorMessage =
    errorMessage ??
    (uploadTaskInputImageMutation.isError
      ? getErrorMessage(uploadTaskInputImageMutation.error)
      : null)

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen && !bootstrapMutation.isPending) {
          reset()
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" size="sm" className="shrink-0">
            <PlusIcon className="size-4" />
            New Session
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New Session</DialogTitle>
        </DialogHeader>

        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            void handleSubmit()
          }}
        >
          <div>
            <TaskInputComposer
              canSubmit={
                !bootstrapMutation.isPending &&
                !isUploading &&
                Boolean(initialTaskInput) &&
                taskCreationParams.hasResolvedRuntimeConfig
              }
              inputDisabled={bootstrapMutation.isPending}
              isSubmitting={bootstrapMutation.isPending || isUploading}
              autoFocus
              placeholder="Describe how you want to start this session..."
              value={initialTaskPrompt}
              errorMessage={composerErrorMessage}
              attachments={
                <TaskInputAttachmentList
                  attachments={initialTaskAttachments}
                  disabled={bootstrapMutation.isPending || isUploading}
                  onRemove={removeAttachment}
                />
              }
              controls={
                <>
                  <ExecutorDropdown
                    disabled={bootstrapMutation.isPending}
                    value={taskCreationParams.executor}
                    onValueChange={taskCreationParams.setExecutor}
                  />

                  <ModelDropdown
                    disabled={bootstrapMutation.isPending}
                    executor={taskCreationParams.executor}
                    models={taskCreationParams.availableModels}
                    value={taskCreationParams.model}
                    onValueChange={taskCreationParams.setModel}
                  />

                  <EffortDropdown
                    disabled={bootstrapMutation.isPending}
                    efforts={taskCreationParams.availableEfforts}
                    value={taskCreationParams.effort}
                    onValueChange={(nextEffort) => {
                      if (nextEffort) {
                        taskCreationParams.setEffort(nextEffort)
                      }
                    }}
                  />
                </>
              }
              onChange={setInitialTaskPrompt}
              onPasteFiles={(files) => {
                void handlePasteFiles(files)
              }}
              onDropFiles={(files) => {
                void handleDropFiles(files)
              }}
              onSubmit={() => {
                void handleSubmit()
              }}
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
