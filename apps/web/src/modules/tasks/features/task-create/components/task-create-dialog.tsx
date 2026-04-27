"use client"

import { PlusIcon } from "lucide-react"
import { type ReactNode, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  EffortDropdown,
  ExecutorDropdown,
  ModelDropdown,
  TaskInputAttachmentList,
  TaskInputComposer,
} from "@/modules/tasks/components"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useCreateTaskMutation } from "@/modules/tasks/hooks/use-task-queries"
import { useTaskInputAttachments } from "@/modules/tasks/hooks/use-task-input-attachments"
import { useTaskCreationParams } from "../use-task-creation-params"
import {
  buildTaskInput,
  summarizeTaskInput,
  type UploadedTaskInputImage,
} from "@/modules/tasks/lib"
import { getErrorMessage } from "@/modules/tasks/view-models"

type TaskCreateDialogProps = {
  projectId: string
  orchestrationId: string | null
  disabled?: boolean
  onTaskCreated: (id: string) => void
  trigger?: ReactNode
}

export function TaskCreateDialog({
  projectId,
  orchestrationId,
  disabled = false,
  onTaskCreated,
  trigger,
}: TaskCreateDialogProps) {
  const [open, setOpen] = useState(false)
  const [newTaskPrompt, setNewTaskPrompt] = useState("")
  const [newTaskAttachments, setNewTaskAttachments] = useState<
    UploadedTaskInputImage[]
  >([])
  const [createTaskError, setCreateTaskError] = useState<string | null>(null)

  const taskCreationParams = useTaskCreationParams()
  const createTaskMutation = useCreateTaskMutation({
    projectId,
    orchestrationId,
  })
  const {
    handleDropFiles,
    handlePasteFiles,
    isUploading,
    uploadTaskInputImageMutation,
    removeAttachment,
  } = useTaskInputAttachments({
    projectId,
    getAttachments: () => newTaskAttachments,
    onAttachmentsChange: setNewTaskAttachments,
  })
  const createTaskInput = useMemo(
    () =>
      buildTaskInput({
        text: newTaskPrompt,
        attachments: newTaskAttachments,
      }),
    [newTaskAttachments, newTaskPrompt],
  )

  function resetCreateComposer() {
    setCreateTaskError(null)
    setNewTaskPrompt("")
    setNewTaskAttachments([])
  }

  async function handleCreateTask() {
    if (!createTaskInput) {
      setCreateTaskError(
        "Enter a prompt or attach an image before creating the task.",
      )
      return
    }

    if (!taskCreationParams.model || !taskCreationParams.effort) {
      setCreateTaskError(
        "Wait for runtime options to load before creating the task.",
      )
      return
    }

    try {
      setCreateTaskError(null)
      const result = await createTaskMutation.mutateAsync(
        typeof createTaskInput === "string"
          ? {
              prompt: createTaskInput,
              model: taskCreationParams.model,
              executor: taskCreationParams.executor,
              executionMode: taskCreationParams.executionMode,
              effort: taskCreationParams.effort,
            }
          : {
              items: createTaskInput,
              title: summarizeTaskInput(createTaskInput),
              model: taskCreationParams.model,
              executor: taskCreationParams.executor,
              executionMode: taskCreationParams.executionMode,
              effort: taskCreationParams.effort,
            },
      )
      resetCreateComposer()
      setOpen(false)
      onTaskCreated(result.id)
    } catch (error) {
      setCreateTaskError(getErrorMessage(error))
    }
  }
  const composerErrorMessage =
    createTaskError ??
    (uploadTaskInputImageMutation.isError
      ? getErrorMessage(uploadTaskInputImageMutation.error)
      : null)

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen && !createTaskMutation.isPending) {
          resetCreateComposer()
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" size="sm" disabled={disabled}>
            <PlusIcon className="size-4" />
            New Task
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
        </DialogHeader>

        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            void handleCreateTask()
          }}
        >
          <TaskInputComposer
            canSubmit={
              !createTaskMutation.isPending &&
              !isUploading &&
              Boolean(createTaskInput) &&
              taskCreationParams.hasResolvedRuntimeConfig
            }
            inputDisabled={createTaskMutation.isPending}
            isSubmitting={createTaskMutation.isPending || isUploading}
            autoFocus
            placeholder="Describe the task you want the agent to start with..."
            value={newTaskPrompt}
            errorMessage={composerErrorMessage}
            attachments={
              <TaskInputAttachmentList
                attachments={newTaskAttachments}
                disabled={createTaskMutation.isPending || isUploading}
                onRemove={removeAttachment}
              />
            }
            controls={
              <>
                <ExecutorDropdown
                  disabled={createTaskMutation.isPending}
                  value={taskCreationParams.executor}
                  onValueChange={taskCreationParams.setExecutor}
                />

                <ModelDropdown
                  disabled={createTaskMutation.isPending}
                  executor={taskCreationParams.executor}
                  models={taskCreationParams.availableModels}
                  value={taskCreationParams.model}
                  onValueChange={taskCreationParams.setModel}
                />

                <EffortDropdown
                  disabled={createTaskMutation.isPending}
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
            onChange={setNewTaskPrompt}
            onPasteFiles={(files) => {
              void handlePasteFiles(files)
            }}
            onDropFiles={(files) => {
              void handleDropFiles(files)
            }}
            onSubmit={() => {
              void handleCreateTask()
            }}
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}
