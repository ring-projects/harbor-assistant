"use client"

import {
  BotIcon,
  ChevronDownIcon,
  PlusIcon,
  Settings2Icon,
  SparklesIcon,
  WifiIcon,
} from "lucide-react"
import { type ReactNode, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { TaskEffort } from "@/modules/tasks/contracts"
import {
  useAgentCapabilitiesQuery,
  useCreateTaskMutation,
  useUploadTaskInputImageMutation,
} from "@/modules/tasks/hooks/use-task-queries"
import {
  buildTaskInput,
  summarizeTaskInput,
  type UploadedTaskInputImage,
} from "@/modules/tasks/lib"
import {
  formatExecutionModeLabel,
  formatEffortLabel,
  formatExecutorLabel,
  formatModelSummary,
  getErrorMessage,
} from "@/modules/tasks/view-models"

const EXECUTOR_OPTIONS = [
  {
    value: "codex",
    label: "Codex",
    description: "OpenAI Codex runtime",
  },
  {
    value: "claude-code",
    label: "Claude Code",
    description: "Anthropic Claude Code runtime",
  },
] as const

const EXECUTION_MODE_OPTIONS = [
  {
    value: "safe",
    label: "Safe",
    description: "Write workspace, no shell network, cached search",
  },
  {
    value: "connected",
    label: "Normal",
    description: "Write workspace, allow network, live search",
  },
  {
    value: "full-access",
    label: "Full Access",
    description: "Minimal restrictions, highest risk",
  },
] as const

const DEFAULT_TASK_EXECUTOR = "codex"
const DEFAULT_TASK_EXECUTION_MODE = "connected"

type TaskCreateDialogProps = {
  projectId: string
  onTaskCreated: (taskId: string) => void
  trigger?: ReactNode
}

function getLastSelectedModelStorageKey(projectId: string, executor: string) {
  return `harbor.task-create.last-selected-model.${projectId}.${executor}`
}

function readLastSelectedModel(projectId: string, executor: string) {
  if (typeof window === "undefined") {
    return null
  }

  const value = window.localStorage.getItem(
    getLastSelectedModelStorageKey(projectId, executor),
  )

  return value?.trim() || null
}

function writeLastSelectedModel(
  projectId: string,
  executor: string,
  model: string | null,
) {
  if (typeof window === "undefined") {
    return
  }

  const storageKey = getLastSelectedModelStorageKey(projectId, executor)
  if (model?.trim()) {
    window.localStorage.setItem(storageKey, model)
    return
  }

  window.localStorage.removeItem(storageKey)
}

function resolveModelSelection(
  models: {
    id: string
    isDefault: boolean
  }[],
  selectedModel: string | null,
) {
  if (selectedModel && models.some((model) => model.id === selectedModel)) {
    return selectedModel
  }

  return models.find((model) => model.isDefault)?.id ?? models[0]?.id ?? null
}

function resolveEffortSelection(
  efforts: readonly TaskEffort[],
  selectedEffort: TaskEffort | null,
) {
  if (selectedEffort && efforts.includes(selectedEffort)) {
    return selectedEffort
  }

  if (efforts.includes("medium")) {
    return "medium"
  }

  return efforts[0] ?? null
}

export function TaskCreateDialog({
  projectId,
  onTaskCreated,
  trigger,
}: TaskCreateDialogProps) {
  const [open, setOpen] = useState(false)
  const [newTaskPrompt, setNewTaskPrompt] = useState("")
  const [newTaskAttachments, setNewTaskAttachments] = useState<
    UploadedTaskInputImage[]
  >([])
  const [newTaskExecutor, setNewTaskExecutor] = useState<string>(DEFAULT_TASK_EXECUTOR)
  const [selectedModel, setSelectedModel] = useState<string | null>(() =>
    readLastSelectedModel(projectId, DEFAULT_TASK_EXECUTOR),
  )
  const [newTaskExecutionMode, setNewTaskExecutionMode] = useState<
    "safe" | "connected" | "full-access"
  >(DEFAULT_TASK_EXECUTION_MODE)
  const [selectedEffort, setSelectedEffort] = useState<TaskEffort | null>(null)
  const [createTaskError, setCreateTaskError] = useState<string | null>(null)

  const agentCapabilitiesQuery = useAgentCapabilitiesQuery({
    enabled: open,
  })
  const createTaskMutation = useCreateTaskMutation(projectId)
  const uploadTaskInputImageMutation = useUploadTaskInputImageMutation(projectId)
  const selectedExecutorCapabilities =
    newTaskExecutor === "claude-code"
      ? agentCapabilitiesQuery.data?.agents["claude-code"] ?? null
      : agentCapabilitiesQuery.data?.agents.codex ?? null
  const selectedExecutorModels = useMemo(
    () => selectedExecutorCapabilities?.models ?? [],
    [selectedExecutorCapabilities],
  )
  const selectedExecutorModelIds = useMemo(
    () => new Set(selectedExecutorModels.map((model) => model.id)),
    [selectedExecutorModels],
  )
  const resolvedSelectedModel = useMemo(() => {
    if (selectedExecutorModels.length === 0) {
      return null
    }

    if (selectedModel && selectedExecutorModelIds.has(selectedModel)) {
      return selectedModel
    }

    return resolveModelSelection(selectedExecutorModels, selectedModel)
  }, [selectedExecutorModelIds, selectedExecutorModels, selectedModel])
  const resolvedModelConfig = useMemo(() => {
    if (resolvedSelectedModel) {
      return (
        selectedExecutorModels.find((model) => model.id === resolvedSelectedModel) ?? null
      )
    }

    return null
  }, [resolvedSelectedModel, selectedExecutorModels])
  const selectedEffortOptions = useMemo(
    () => resolvedModelConfig?.efforts ?? [],
    [resolvedModelConfig],
  )
  const resolvedSelectedEffort = useMemo(() => {
    return resolveEffortSelection(selectedEffortOptions, selectedEffort)
  }, [selectedEffort, selectedEffortOptions])
  const hasResolvedRuntimeConfig = Boolean(
    resolvedSelectedModel &&
    resolvedSelectedEffort &&
    newTaskExecutionMode &&
    newTaskExecutor,
  )
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
    setNewTaskExecutor(DEFAULT_TASK_EXECUTOR)
    setSelectedModel(readLastSelectedModel(projectId, DEFAULT_TASK_EXECUTOR))
    setNewTaskExecutionMode(DEFAULT_TASK_EXECUTION_MODE)
    setSelectedEffort(null)
  }

  async function handleCreateTask() {
    if (!createTaskInput) {
      setCreateTaskError("Enter a prompt or attach an image before creating the task.")
      return
    }

    if (!resolvedSelectedModel || !resolvedSelectedEffort) {
      setCreateTaskError("Wait for runtime options to load before creating the task.")
      return
    }

    try {
      setCreateTaskError(null)
      const result = await createTaskMutation.mutateAsync(
        typeof createTaskInput === "string"
          ? {
              prompt: createTaskInput,
              model: resolvedSelectedModel,
              executor: newTaskExecutor,
              executionMode: newTaskExecutionMode,
              effort: resolvedSelectedEffort,
            }
          : {
              items: createTaskInput,
              title: summarizeTaskInput(createTaskInput),
              model: resolvedSelectedModel,
              executor: newTaskExecutor,
              executionMode: newTaskExecutionMode,
              effort: resolvedSelectedEffort,
            },
      )

      writeLastSelectedModel(projectId, newTaskExecutor, resolvedSelectedModel)
      resetCreateComposer()
      setOpen(false)
      onTaskCreated(result.taskId)
    } catch (error) {
      setCreateTaskError(getErrorMessage(error))
    }
  }

  async function uploadFiles(files: File[]) {
    const uploaded = await Promise.all(
      files.map((file) =>
        uploadTaskInputImageMutation.mutateAsync({
          file,
        }),
      ),
    )

    setNewTaskAttachments((current) => [...current, ...uploaded])
  }

  function removeAttachment(path: string) {
    setNewTaskAttachments((current) =>
      current.filter((attachment) => attachment.path !== path),
    )
  }

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
          <Button type="button" variant="outline" size="sm">
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
              !uploadTaskInputImageMutation.isPending &&
              Boolean(createTaskInput) &&
              hasResolvedRuntimeConfig
            }
            inputDisabled={createTaskMutation.isPending}
            isSubmitting={
              createTaskMutation.isPending || uploadTaskInputImageMutation.isPending
            }
            autoFocus
            placeholder="Describe the task you want the agent to start with..."
            value={newTaskPrompt}
            errorMessage={createTaskError}
            attachments={
              <TaskInputAttachmentList
                attachments={newTaskAttachments}
                disabled={
                  createTaskMutation.isPending || uploadTaskInputImageMutation.isPending
                }
                onRemove={removeAttachment}
              />
            }
            controls={
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-full border-border/70 bg-background/80 px-3 text-xs font-medium shadow-none"
                      disabled={createTaskMutation.isPending}
                    >
                      <BotIcon className="size-3.5" />
                      <span className="max-w-36 truncate">
                        {formatExecutorLabel(newTaskExecutor)}
                      </span>
                      <ChevronDownIcon className="size-3.5 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-72 rounded-2xl p-2">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      Executor
                    </DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={newTaskExecutor}
                      onValueChange={(nextValue) => {
                        setNewTaskExecutor(nextValue)
                        setSelectedModel(readLastSelectedModel(projectId, nextValue))
                        setSelectedEffort(null)
                      }}
                    >
                      {EXECUTOR_OPTIONS.map((option) => (
                        <DropdownMenuRadioItem key={option.value} value={option.value}>
                          {option.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-full border-border/70 bg-background/80 px-3 text-xs font-medium shadow-none"
                      disabled={createTaskMutation.isPending}
                    >
                      <Settings2Icon className="size-3.5" />
                      <span className="max-w-52 truncate">
                        {formatModelSummary(resolvedSelectedModel)}
                      </span>
                      <ChevronDownIcon className="size-3.5 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-80 rounded-2xl p-2">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      Model
                    </DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={resolvedSelectedModel ?? ""}
                      onValueChange={(nextValue) => {
                        setSelectedModel(nextValue || null)
                        setSelectedEffort(null)
                      }}
                    >
                      {selectedExecutorModels.map((model) => (
                        <DropdownMenuRadioItem
                          key={`${newTaskExecutor}:${model.id}`}
                          value={model.id}
                        >
                          {model.isDefault
                            ? `${model.displayName} (${model.id}, default)`
                            : `${model.displayName} (${model.id})`}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-full border-border/70 bg-background/80 px-3 text-xs font-medium shadow-none"
                      disabled={createTaskMutation.isPending}
                    >
                      <SparklesIcon className="size-3.5" />
                      <span>{formatEffortLabel(resolvedSelectedEffort)}</span>
                      <ChevronDownIcon className="size-3.5 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-72 rounded-2xl p-2">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      Effort
                    </DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={resolvedSelectedEffort ?? ""}
                      onValueChange={(nextValue) => {
                        if (
                          nextValue === "minimal" ||
                          nextValue === "low" ||
                          nextValue === "medium" ||
                          nextValue === "high" ||
                          nextValue === "xhigh"
                        ) {
                          setSelectedEffort(nextValue)
                        }
                      }}
                    >
                      {selectedEffortOptions.map((effort) => (
                        <DropdownMenuRadioItem key={effort} value={effort}>
                          {formatEffortLabel(effort)}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-full border-border/70 bg-background/80 px-3 text-xs font-medium shadow-none"
                      disabled={createTaskMutation.isPending}
                    >
                      <WifiIcon className="size-3.5" />
                      <span>{formatExecutionModeLabel(newTaskExecutionMode)}</span>
                      <ChevronDownIcon className="size-3.5 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-72 rounded-2xl p-2">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      Execution Mode
                    </DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={newTaskExecutionMode}
                      onValueChange={(nextValue) => {
                        if (
                          nextValue === "safe" ||
                          nextValue === "connected" ||
                          nextValue === "full-access"
                        ) {
                          setNewTaskExecutionMode(nextValue)
                        }
                      }}
                    >
                      {EXECUTION_MODE_OPTIONS.map((option) => (
                        <DropdownMenuRadioItem key={option.value} value={option.value}>
                          {option.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            }
            onChange={setNewTaskPrompt}
            onPasteFiles={(files) => {
              void uploadFiles(files)
            }}
            onDropFiles={(files) => {
              void uploadFiles(files)
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
