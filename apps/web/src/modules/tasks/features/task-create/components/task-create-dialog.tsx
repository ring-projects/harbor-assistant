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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useProjectSettingsQuery } from "@/modules/projects"
import type { TaskEffort } from "@/modules/tasks/contracts"
import {
  ChatInteraction,
  TaskInputAttachmentList,
} from "@/modules/tasks/features/task-session/composer"
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
  formatExecutorLabel,
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

function formatModelSummary(model: string | null | undefined) {
  return model?.trim() || "Runtime Default"
}

function formatEffortLabel(effort: TaskEffort | null | undefined) {
  switch (effort) {
    case "minimal":
      return "Minimal"
    case "low":
      return "Low"
    case "medium":
      return "Medium"
    case "high":
      return "High"
    case "xhigh":
      return "X-High"
    default:
      return "Provider Default"
  }
}

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

export function TaskCreateDialog({
  projectId,
  onTaskCreated,
  trigger,
}: TaskCreateDialogProps) {
  const projectSettingsQuery = useProjectSettingsQuery(projectId)
  const defaultExecutor =
    projectSettingsQuery.data?.execution.defaultExecutor ?? "codex"
  const defaultExecutionMode =
    projectSettingsQuery.data?.execution.defaultExecutionMode === "full-access"
      ? "full-access"
      : "connected"
  const [open, setOpen] = useState(false)
  const [newTaskPrompt, setNewTaskPrompt] = useState("")
  const [newTaskAttachments, setNewTaskAttachments] = useState<
    UploadedTaskInputImage[]
  >([])
  const [newTaskExecutor, setNewTaskExecutor] = useState<string>(defaultExecutor)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [newTaskExecutionMode, setNewTaskExecutionMode] = useState<
    "safe" | "connected" | "full-access"
  >(defaultExecutionMode)
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
    if (!selectedModel) {
      return null
    }

    if (selectedExecutorModels.length === 0 || selectedExecutorModelIds.has(selectedModel)) {
      return selectedModel
    }

    return null
  }, [selectedExecutorModelIds, selectedExecutorModels.length, selectedModel])
  const resolvedModelConfig = useMemo(() => {
    if (resolvedSelectedModel) {
      return (
        selectedExecutorModels.find((model) => model.id === resolvedSelectedModel) ?? null
      )
    }

    return selectedExecutorModels.find((model) => model.isDefault) ?? null
  }, [resolvedSelectedModel, selectedExecutorModels])
  const selectedEffortOptions = useMemo(
    () => resolvedModelConfig?.efforts ?? [],
    [resolvedModelConfig],
  )
  const resolvedSelectedEffort = useMemo(() => {
    if (!selectedEffort) {
      return null
    }

    return selectedEffortOptions.includes(selectedEffort) ? selectedEffort : null
  }, [selectedEffort, selectedEffortOptions])
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
    setNewTaskExecutor(defaultExecutor)
    setSelectedModel(readLastSelectedModel(projectId, defaultExecutor))
    setNewTaskExecutionMode(defaultExecutionMode)
    setSelectedEffort(null)
  }

  async function handleCreateTask() {
    if (!createTaskInput) {
      setCreateTaskError("Enter a prompt or attach an image before creating the task.")
      return
    }

    try {
      setCreateTaskError(null)
      const result = await createTaskMutation.mutateAsync(
        typeof createTaskInput === "string"
          ? {
              prompt: createTaskInput,
              model: resolvedSelectedModel ?? undefined,
              executor: newTaskExecutor,
              executionMode: newTaskExecutionMode,
              effort: resolvedSelectedEffort,
            }
          : {
              items: createTaskInput,
              title: summarizeTaskInput(createTaskInput),
              model: resolvedSelectedModel ?? undefined,
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

      <DialogContent className="sm:max-w-xl">
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
          <ChatInteraction
            canSubmit={
              !createTaskMutation.isPending &&
              !uploadTaskInputImageMutation.isPending &&
              Boolean(createTaskInput)
            }
            inputDisabled={createTaskMutation.isPending}
            isSubmitting={
              createTaskMutation.isPending || uploadTaskInputImageMutation.isPending
            }
            autoFocus
            helperText={
              uploadTaskInputImageMutation.isPending
                ? "Uploading image attachment..."
                : agentCapabilitiesQuery.isLoading
                ? `Loading available models for ${formatExecutorLabel(newTaskExecutor)}...`
                : agentCapabilitiesQuery.isError
                  ? "Model list unavailable. Task creation still works with the current defaults."
                  : open && selectedExecutorModels.length === 0
                    ? `No explicit model list was detected for ${formatExecutorLabel(newTaskExecutor)}.`
                    : "Press Enter to create the task. Use Shift+Enter for a new line."
            }
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
                      value={resolvedSelectedModel ? `custom:${resolvedSelectedModel}` : "runtime-default"}
                      onValueChange={(nextValue) => {
                        if (nextValue === "runtime-default") {
                          setSelectedModel(null)
                          setSelectedEffort(null)
                          return
                        }

                        if (nextValue.startsWith("custom:")) {
                          setSelectedModel(nextValue.slice("custom:".length) || null)
                          setSelectedEffort(null)
                        }
                      }}
                    >
                      <DropdownMenuRadioItem value="runtime-default">
                        Runtime Default
                      </DropdownMenuRadioItem>
                      {selectedExecutorModels.length > 0 ? <DropdownMenuSeparator /> : null}
                      {selectedExecutorModels.map((model) => (
                        <DropdownMenuRadioItem
                          key={`${newTaskExecutor}:${model.id}`}
                          value={`custom:${model.id}`}
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
                      value={resolvedSelectedEffort ?? "provider-default"}
                      onValueChange={(nextValue) => {
                        if (nextValue === "provider-default") {
                          setSelectedEffort(null)
                          return
                        }

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
                      <DropdownMenuRadioItem value="provider-default">
                        Provider Default
                      </DropdownMenuRadioItem>
                      {selectedEffortOptions.length > 0 ? <DropdownMenuSeparator /> : null}
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
            footer={
              <div className="flex flex-wrap items-center gap-2">
                {agentCapabilitiesQuery.isLoading ? (
                  <span className="inline-flex h-8 items-center rounded-full border border-border/70 bg-muted/30 px-3 text-[11px] font-medium text-foreground/80">
                    Refreshing runtime capabilities...
                  </span>
                ) : null}
                {agentCapabilitiesQuery.isError ? (
                  <span className="inline-flex h-8 items-center rounded-full border border-border/70 bg-muted/30 px-3 text-[11px] font-medium text-foreground/80">
                    Runtime capability check unavailable
                  </span>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-full px-3 text-[11px]"
                  onClick={() => {
                    setOpen(false)
                    resetCreateComposer()
                  }}
                  disabled={createTaskMutation.isPending}
                >
                  Cancel
                </Button>
              </div>
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
