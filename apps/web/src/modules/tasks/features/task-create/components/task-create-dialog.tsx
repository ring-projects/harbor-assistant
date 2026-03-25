"use client"

import {
  BotIcon,
  ChevronDownIcon,
  ImageIcon,
  PlusIcon,
  Settings2Icon,
  WifiIcon,
  XIcon,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { storeTaskInputImage } from "@/modules/tasks/api"
import { ChatInteraction } from "@/modules/tasks/features/task-session/composer"
import {
  useAgentCapabilitiesQuery,
  useCreateTaskMutation,
} from "@/modules/tasks/hooks/use-task-queries"
import {
  formatExecutionModeLabel,
  formatExecutorLabel,
  getErrorMessage,
} from "@/modules/tasks/domain/lib"

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

type PendingImageAttachment = {
  id: string
  file: File
  previewUrl: string
}

const ACCEPTED_IMAGE_MEDIA_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
])

function describePendingPrompt(text: string, imageCount: number) {
  if (text) {
    return text
  }

  if (imageCount === 1) {
    return "Shared 1 image"
  }

  if (imageCount > 1) {
    return `Shared ${imageCount} images`
  }

  return ""
}

async function fileToBase64(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onerror = () => reject(new Error(`Failed to read ${file.name}.`))
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.readAsDataURL(file)
  })

  const [, encoded = ""] = dataUrl.split(",", 2)
  return encoded
}

type TaskCreateDialogProps = {
  projectId: string
  onTaskCreated: (taskId: string) => void
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
  const [newTaskExecutor, setNewTaskExecutor] = useState<string>(defaultExecutor)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [newTaskExecutionMode, setNewTaskExecutionMode] = useState<
    "safe" | "connected" | "full-access"
  >(defaultExecutionMode)
  const [createTaskError, setCreateTaskError] = useState<string | null>(null)
  const [pendingImages, setPendingImages] = useState<PendingImageAttachment[]>([])
  const pendingImagesRef = useRef<PendingImageAttachment[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const agentCapabilitiesQuery = useAgentCapabilitiesQuery({
    enabled: open,
  })
  const createTaskMutation = useCreateTaskMutation(projectId)
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

  useEffect(() => {
    pendingImagesRef.current = pendingImages
  }, [pendingImages])

  useEffect(() => {
    return () => {
      for (const item of pendingImagesRef.current) {
        URL.revokeObjectURL(item.previewUrl)
      }
    }
  }, [])

  function resetCreateComposer() {
    setCreateTaskError(null)
    setNewTaskPrompt("")
    setNewTaskExecutor(defaultExecutor)
    setSelectedModel(readLastSelectedModel(projectId, defaultExecutor))
    setNewTaskExecutionMode(defaultExecutionMode)
    setPendingImages((current) => {
      for (const item of current) {
        URL.revokeObjectURL(item.previewUrl)
      }

      return []
    })
  }

  function appendPendingImages(files: File[]) {
    if (files.length === 0) {
      return
    }

    const acceptedFiles = files.filter((file) =>
      ACCEPTED_IMAGE_MEDIA_TYPES.has(file.type),
    )

    if (acceptedFiles.length === 0) {
      return
    }

    setPendingImages((current) => [
      ...current,
      ...acceptedFiles.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ])
  }

  function removePendingImage(id: string) {
    setPendingImages((current) => {
      const next = current.filter((item) => item.id !== id)
      const removed = current.find((item) => item.id === id)

      if (removed) {
        URL.revokeObjectURL(removed.previewUrl)
      }

      return next
    })
  }

  async function handleCreateTask() {
    const prompt = newTaskPrompt.trim()
    if (!prompt && pendingImages.length === 0) {
      setCreateTaskError("Enter a prompt or add at least one image.")
      return
    }

    try {
      setCreateTaskError(null)
      const uploadedImages = await Promise.all(
        pendingImages.map(async (item) => {
          const dataBase64 = await fileToBase64(item.file)
          return storeTaskInputImage(projectId, {
            name: item.file.name,
            mediaType: item.file.type || "image/png",
            dataBase64,
          })
        }),
      )

      const result = await createTaskMutation.mutateAsync({
        input: [
          ...(prompt
            ? [
                {
                  type: "text" as const,
                  text: prompt,
                },
              ]
            : []),
          ...uploadedImages.map((item) => ({
            type: "local_image" as const,
            path: item.path,
          })),
        ],
        model: resolvedSelectedModel ?? undefined,
        executor: newTaskExecutor,
        executionMode: newTaskExecutionMode,
      })

      writeLastSelectedModel(projectId, newTaskExecutor, resolvedSelectedModel)
      resetCreateComposer()
      setOpen(false)
      onTaskCreated(result.taskId)
    } catch (error) {
      setCreateTaskError(getErrorMessage(error))
    }
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          resetCreateComposer()
          setOpen(true)
        }}
      >
        <PlusIcon className="size-4" />
        New Task
      </Button>

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
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={(event) => {
              const files = event.target.files
              if (files) {
                appendPendingImages(Array.from(files))
              }
              event.target.value = ""
            }}
          />

          <ChatInteraction
            canSubmit={
              !createTaskMutation.isPending &&
              (newTaskPrompt.trim().length > 0 || pendingImages.length > 0)
            }
            inputDisabled={createTaskMutation.isPending}
            isSubmitting={createTaskMutation.isPending}
            autoFocus
            helperText={
              agentCapabilitiesQuery.isLoading
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
              pendingImages.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {pendingImages.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 rounded-2xl border border-border/70 bg-muted/20 px-2 py-2"
                    >
                      <img
                        src={item.previewUrl}
                        alt={item.file.name}
                        className="size-10 rounded-xl object-cover"
                      />
                      <div className="min-w-0">
                        <p className="max-w-40 truncate text-xs font-medium">
                          {item.file.name}
                        </p>
                        <p className="text-muted-foreground text-[11px]">
                          {(item.file.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => removePendingImage(item.id)}
                        disabled={createTaskMutation.isPending}
                        aria-label={`Remove ${item.file.name}`}
                      >
                        <XIcon className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null
            }
            controls={
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="h-9 w-9 rounded-full border-border/70 bg-background/80 shadow-none"
                  disabled={createTaskMutation.isPending}
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Add images"
                >
                  <PlusIcon className="size-4" />
                </Button>

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
                          return
                        }

                        if (nextValue.startsWith("custom:")) {
                          setSelectedModel(nextValue.slice("custom:".length) || null)
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
                {selectedExecutorCapabilities?.version ? (
                  <span className="inline-flex h-8 items-center rounded-full border border-border/70 bg-muted/30 px-3 text-[11px] font-medium text-foreground/80">
                    {selectedExecutorCapabilities.version}
                  </span>
                ) : null}
                {pendingImages.length > 0 ? (
                  <span className="inline-flex h-8 items-center gap-1 rounded-full border border-border/70 bg-muted/30 px-3 text-[11px] font-medium text-foreground/80">
                    <ImageIcon className="size-3.5 text-muted-foreground" />
                    {describePendingPrompt(newTaskPrompt.trim(), pendingImages.length)}
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
            onPasteFiles={appendPendingImages}
            onDropFiles={appendPendingImages}
            onSubmit={() => {
              void handleCreateTask()
            }}
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}
