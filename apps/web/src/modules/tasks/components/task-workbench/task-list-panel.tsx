"use client"

import {
  ArchiveIcon,
  MoreHorizontalIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { useEffect, useMemo, useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useProjectSettingsQuery } from "@/modules/projects"
import {
  useAgentCapabilitiesQuery,
  useArchiveTaskMutation,
  useCreateTaskMutation,
  useDeleteTaskMutation,
  useProjectTaskListStream,
  useTaskListQuery,
} from "@/modules/tasks/hooks/use-task-queries"
import {
  selectProjectTasks,
  useTasksSessionStore,
} from "@/modules/tasks/store"

import {
  formatDateTime,
  formatExecutorLabel,
  formatExecutionModeLabel,
  getErrorMessage,
  getTaskDisplayTitle,
  getPromptSummary,
  STATUS_META,
} from "./shared"

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

type TaskListPanelProps = {
  projectId: string
  selectedTaskId: string | null
  onSelectTask: (taskId: string | null) => void
}

type ModelSelectionMode = "project-default" | "runtime-default" | "custom"

export function TaskListPanel({
  projectId,
  selectedTaskId,
  onSelectTask,
}: TaskListPanelProps) {
  const projectSettingsQuery = useProjectSettingsQuery(projectId)
  const defaultExecutor = projectSettingsQuery.data?.defaultExecutor ?? "codex"
  const defaultModel = projectSettingsQuery.data?.defaultModel?.trim() || null
  const defaultExecutionMode =
    projectSettingsQuery.data?.defaultExecutionMode === "full-access"
      ? "full-access"
      : "connected"
  const [isCreateComposerOpen, setIsCreateComposerOpen] = useState(false)
  const [newTaskPrompt, setNewTaskPrompt] = useState("")
  const [newTaskExecutor, setNewTaskExecutor] = useState<string>(defaultExecutor)
  const [newTaskModelMode, setNewTaskModelMode] =
    useState<ModelSelectionMode>("runtime-default")
  const [newTaskModel, setNewTaskModel] = useState<string | null>(null)
  const [newTaskExecutionMode, setNewTaskExecutionMode] = useState<
    "safe" | "connected" | "full-access"
  >(defaultExecutionMode)
  const [createTaskError, setCreateTaskError] = useState<string | null>(null)
  const [taskActionError, setTaskActionError] = useState<string | null>(null)
  const [taskPendingDelete, setTaskPendingDelete] = useState<
    | {
        taskId: string
        title: string
      }
    | null
  >(null)

  const archiveTaskMutation = useArchiveTaskMutation(projectId)
  const agentCapabilitiesQuery = useAgentCapabilitiesQuery({
    enabled: isCreateComposerOpen,
  })
  const createTaskMutation = useCreateTaskMutation(projectId)
  const deleteTaskMutation = useDeleteTaskMutation(projectId)
  const listQuery = useTaskListQuery({
    projectId,
  })
  useProjectTaskListStream({
    projectId,
    enabled: true,
  })

  const allTasks = useTasksSessionStore((state) => selectProjectTasks(state, projectId))
  const [showArchivedTasks, setShowArchivedTasks] = useState(false)

  const activeTasks = useMemo(
    () => allTasks.filter((task) => task.archivedAt === null),
    [allTasks],
  )
  const archivedTasks = useMemo(
    () => allTasks.filter((task) => task.archivedAt !== null),
    [allTasks],
  )
  const selectedExecutorCapabilities =
    newTaskExecutor === "claude-code"
      ? agentCapabilitiesQuery.data?.agents["claude-code"] ?? null
      : agentCapabilitiesQuery.data?.agents.codex ?? null
  const selectedExecutorModels = selectedExecutorCapabilities?.models ?? []
  const selectedExecutorModelIds = useMemo(
    () => new Set(selectedExecutorModels.map((model) => model.id)),
    [selectedExecutorModels],
  )
  const isProjectDefaultCompatible =
    !defaultModel ||
    selectedExecutorModels.length === 0 ||
    selectedExecutorModelIds.has(defaultModel)

  const resolvedSelectedTaskId = useMemo(() => {
    if (allTasks.length === 0) {
      return null
    }

    if (selectedTaskId && allTasks.some((task) => task.taskId === selectedTaskId)) {
      return selectedTaskId
    }

    return activeTasks[0]?.taskId ?? allTasks[0]?.taskId ?? null
  }, [activeTasks, allTasks, selectedTaskId])

  useEffect(() => {
    if (resolvedSelectedTaskId !== selectedTaskId) {
      onSelectTask(resolvedSelectedTaskId)
    }
  }, [onSelectTask, resolvedSelectedTaskId, selectedTaskId])

  function resetCreateComposer() {
    setCreateTaskError(null)
    setNewTaskPrompt("")
    setNewTaskExecutor(defaultExecutor)
    setNewTaskModelMode(defaultModel ? "project-default" : "runtime-default")
    setNewTaskModel(null)
    setNewTaskExecutionMode(defaultExecutionMode)
  }

  useEffect(() => {
    if (newTaskModelMode !== "project-default") {
      return
    }

    if (!defaultModel || !isProjectDefaultCompatible) {
      setNewTaskModelMode("runtime-default")
    }
  }, [defaultModel, isProjectDefaultCompatible, newTaskModelMode])

  useEffect(() => {
    if (newTaskModelMode !== "custom" || !newTaskModel) {
      return
    }

    if (selectedExecutorModels.length === 0 || selectedExecutorModelIds.has(newTaskModel)) {
      return
    }

    setNewTaskModel(null)
    setNewTaskModelMode(
      defaultModel && isProjectDefaultCompatible
        ? "project-default"
        : "runtime-default",
    )
  }, [
    defaultModel,
    isProjectDefaultCompatible,
    newTaskModel,
    newTaskModelMode,
    selectedExecutorModelIds,
    selectedExecutorModels.length,
  ])

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const prompt = newTaskPrompt.trim()
    if (!prompt) {
      setCreateTaskError("Enter an initial prompt.")
      return
    }

    try {
      setCreateTaskError(null)
      const result = await createTaskMutation.mutateAsync({
        prompt,
        model: newTaskModelMode === "custom" ? newTaskModel ?? undefined : undefined,
        modelSource:
          newTaskModelMode === "custom" ? undefined : newTaskModelMode,
        executor: newTaskExecutor,
        executionMode: newTaskExecutionMode,
      })

      resetCreateComposer()
      setIsCreateComposerOpen(false)
      onSelectTask(result.taskId)
    } catch (error) {
      setCreateTaskError(getErrorMessage(error))
    }
  }

  async function handleArchiveTask(taskId: string) {
    try {
      setTaskActionError(null)
      await archiveTaskMutation.mutateAsync(taskId)
    } catch (error) {
      setTaskActionError(getErrorMessage(error))
    }
  }

  async function handleDeleteTask() {
    if (!taskPendingDelete) {
      return
    }

    try {
      setTaskActionError(null)
      await deleteTaskMutation.mutateAsync(taskPendingDelete.taskId)
      setTaskPendingDelete(null)
    } catch (error) {
      setTaskActionError(getErrorMessage(error))
    }
  }

  return (
    <section className="bg-background min-h-0 p-3">
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Task List</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowArchivedTasks((current) => !current)}
            >
              {showArchivedTasks ? "Hide Archived" : `Show Archived (${archivedTasks.length})`}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                resetCreateComposer()
                setIsCreateComposerOpen(true)
              }}
            >
              <PlusIcon className="size-4" />
              New Task
            </Button>
          </div>
        </div>

        <Dialog
          open={isCreateComposerOpen}
          onOpenChange={(open) => {
            setIsCreateComposerOpen(open)
            if (!open && !createTaskMutation.isPending) {
              resetCreateComposer()
            }
          }}
        >
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
            </DialogHeader>

            <form className="grid gap-3" onSubmit={handleCreateTask}>
              <div className="grid gap-2">
                <p className="text-sm font-medium">Executor</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {EXECUTOR_OPTIONS.map((option) => {
                    const isActive = newTaskExecutor === option.value

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setNewTaskExecutor(option.value)}
                        disabled={createTaskMutation.isPending}
                        className={cn(
                          "rounded-xl border px-3 py-3 text-left transition-colors",
                          isActive
                            ? "border-primary bg-primary/5"
                            : "hover:border-muted-foreground/40",
                        )}
                      >
                        <p className="text-sm font-medium">{option.label}</p>
                        <p className="text-muted-foreground pt-1 text-xs">
                          {option.description}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid gap-2">
                <p className="text-sm font-medium">Execution Mode</p>
                <div className="grid gap-2">
                  {EXECUTION_MODE_OPTIONS.map((option) => {
                    const isActive = newTaskExecutionMode === option.value

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setNewTaskExecutionMode(option.value)}
                        disabled={createTaskMutation.isPending}
                        className={cn(
                          "rounded-xl border px-3 py-3 text-left transition-colors",
                          isActive
                            ? "border-primary bg-primary/5"
                            : "hover:border-muted-foreground/40",
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">{option.label}</p>
                          <span className="text-muted-foreground text-[11px] uppercase tracking-wide">
                            {option.label}
                          </span>
                        </div>
                        <p className="text-muted-foreground pt-1 text-xs">
                          {option.description}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">Model</p>
                  {selectedExecutorCapabilities?.version ? (
                    <span className="text-muted-foreground text-[11px]">
                      {selectedExecutorCapabilities.version}
                    </span>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewTaskModelMode("project-default")
                      setNewTaskModel(null)
                    }}
                    disabled={
                      createTaskMutation.isPending ||
                      !defaultModel ||
                      !isProjectDefaultCompatible
                    }
                    className={cn(
                      "rounded-xl border px-3 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                      newTaskModelMode === "project-default"
                        ? "border-primary bg-primary/5"
                        : "hover:border-muted-foreground/40",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">Project Default</p>
                      {defaultModel ? (
                        <span className="text-muted-foreground text-[11px] uppercase tracking-wide">
                          {defaultModel}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-muted-foreground pt-1 text-xs">
                      {!defaultModel
                        ? "No project default model is configured."
                        : !isProjectDefaultCompatible
                          ? `Project default model is not available for ${formatExecutorLabel(newTaskExecutor)}.`
                          : "Use the model configured in project settings."}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewTaskModelMode("runtime-default")
                      setNewTaskModel(null)
                    }}
                    disabled={createTaskMutation.isPending}
                    className={cn(
                      "rounded-xl border px-3 py-3 text-left transition-colors",
                      newTaskModelMode === "runtime-default"
                        ? "border-primary bg-primary/5"
                        : "hover:border-muted-foreground/40",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">Runtime Default</p>
                      <span className="text-muted-foreground text-[11px] uppercase tracking-wide">
                        Auto
                      </span>
                    </div>
                    <p className="text-muted-foreground pt-1 text-xs">
                      Let {formatExecutorLabel(newTaskExecutor)} choose its own default model.
                    </p>
                  </button>

                  {selectedExecutorModels.map((model) => {
                    const isActive =
                      newTaskModelMode === "custom" && newTaskModel === model.id

                    return (
                      <button
                        key={`${newTaskExecutor}:${model.id}`}
                        type="button"
                        onClick={() => {
                          setNewTaskModelMode("custom")
                          setNewTaskModel(model.id)
                        }}
                        disabled={createTaskMutation.isPending}
                        className={cn(
                          "rounded-xl border px-3 py-3 text-left transition-colors",
                          isActive
                            ? "border-primary bg-primary/5"
                            : "hover:border-muted-foreground/40",
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">{model.displayName}</p>
                          {model.isDefault ? (
                            <span className="text-muted-foreground text-[11px] uppercase tracking-wide">
                              Default
                            </span>
                          ) : null}
                        </div>
                        <p className="text-muted-foreground pt-1 text-xs">{model.id}</p>
                      </button>
                    )
                  })}
                </div>

                {agentCapabilitiesQuery.isLoading ? (
                  <p className="text-muted-foreground text-xs">
                    Loading available models for {formatExecutorLabel(newTaskExecutor)}...
                  </p>
                ) : null}

                {isCreateComposerOpen &&
                !agentCapabilitiesQuery.isLoading &&
                !agentCapabilitiesQuery.isError &&
                selectedExecutorModels.length === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    No explicit model list was detected for {formatExecutorLabel(newTaskExecutor)}.
                    You can still create the task with the default options above.
                  </p>
                ) : null}

                {agentCapabilitiesQuery.isError ? (
                  <p className="text-muted-foreground text-xs">
                    Failed to load model options. Task creation still works with the default
                    choices.
                  </p>
                ) : null}
              </div>

              <Textarea
                value={newTaskPrompt}
                onChange={(event) => setNewTaskPrompt(event.target.value)}
                placeholder="Enter an initial prompt"
                disabled={createTaskMutation.isPending}
                autoFocus
                rows={6}
                className="min-h-32 resize-y"
              />

              {createTaskError ? (
                <div className="rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-700">
                  {createTaskError}
                </div>
              ) : null}

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setIsCreateComposerOpen(false)
                    setCreateTaskError(null)
                    setNewTaskPrompt("")
                    setNewTaskExecutor(defaultExecutor)
                    setNewTaskModelMode(defaultModel ? "project-default" : "runtime-default")
                    setNewTaskModel(null)
                    setNewTaskExecutionMode(defaultExecutionMode)
                  }}
                  disabled={createTaskMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createTaskMutation.isPending || newTaskPrompt.trim().length === 0}
                >
                  <PlusIcon className="size-4" />
                  {createTaskMutation.isPending ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(taskPendingDelete)}
          onOpenChange={(open) => {
            if (!open && !deleteTaskMutation.isPending) {
              setTaskPendingDelete(null)
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Task</DialogTitle>
              <DialogDescription>
                Delete &quot;{taskPendingDelete?.title ?? "this task"}&quot; permanently?
                This also removes its event history from Harbor.
              </DialogDescription>
            </DialogHeader>

            {taskActionError ? (
              <div className="rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-700">
                {taskActionError}
              </div>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setTaskPendingDelete(null)}
                disabled={deleteTaskMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void handleDeleteTask()
                }}
                disabled={deleteTaskMutation.isPending}
              >
                <Trash2Icon className="size-4" />
                {deleteTaskMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
          {listQuery.isLoading ? (
            Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-20 w-full rounded-md" />
            ))
          ) : null}

          {!listQuery.isLoading && listQuery.isError ? (
            <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700">
              {getErrorMessage(listQuery.error)}
            </div>
          ) : null}

          {!listQuery.isLoading && !listQuery.isError && activeTasks.length === 0 ? (
            <div className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
              No tasks yet.
            </div>
          ) : null}

          {taskActionError ? (
            <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700">
              {taskActionError}
            </div>
          ) : null}

          {!listQuery.isLoading && !listQuery.isError
            ? activeTasks.map((task) => {
                const isActive = task.taskId === resolvedSelectedTaskId
                const canManageTask =
                  task.status === "completed" ||
                  task.status === "failed" ||
                  task.status === "cancelled"
                const taskTitle = getTaskDisplayTitle({
                  title: task.title,
                  prompt: task.prompt,
                })

                return (
                  <div
                    key={task.taskId}
                    className={cn(
                      "w-full rounded-md border transition-colors",
                      isActive
                        ? "border-primary bg-primary/5"
                        : "hover:border-muted-foreground/40",
                    )}
                  >
                    <div className="flex items-start gap-2 p-3">
                      <button
                        type="button"
                        onClick={() => onSelectTask(task.taskId)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2 py-0.5 text-[11px]",
                              STATUS_META[task.status].badgeClassName,
                            )}
                          >
                            {STATUS_META[task.status].label}
                          </span>
                        </div>

                        <p className="pt-2 text-sm font-medium">
                          {taskTitle}
                        </p>
                        <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 pt-2 text-[11px]">
                          <span>Created: {formatDateTime(task.createdAt)}</span>
                          <span>Executor: {formatExecutorLabel(task.executor)}</span>
                          <span>Mode: {formatExecutionModeLabel(task.executionMode)}</span>
                          <span>Model: {task.model ?? "-"}</span>
                        </div>
                      </button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            aria-label={`Task actions for ${taskTitle}`}
                          >
                            <MoreHorizontalIcon className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            disabled={!canManageTask || archiveTaskMutation.isPending}
                            onClick={() => {
                              void handleArchiveTask(task.taskId)
                            }}
                          >
                            <ArchiveIcon className="mr-2 size-4" />
                            Archive
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!canManageTask || deleteTaskMutation.isPending}
                            onClick={() => {
                              setTaskActionError(null)
                              setTaskPendingDelete({
                                taskId: task.taskId,
                                title: taskTitle,
                              })
                            }}
                          >
                            <Trash2Icon className="mr-2 size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                )
              })
            : null}

          {!listQuery.isLoading && !listQuery.isError && showArchivedTasks && archivedTasks.length > 0 ? (
            <div className="space-y-2 pt-3">
              <div className="text-muted-foreground px-1 text-[11px] font-medium uppercase tracking-wide">
                Archived
              </div>
              {archivedTasks.map((task) => {
                const isActive = task.taskId === resolvedSelectedTaskId
                const canManageTask =
                  task.status === "completed" ||
                  task.status === "failed" ||
                  task.status === "cancelled"
                const taskTitle = getTaskDisplayTitle({
                  title: task.title,
                  prompt: task.prompt,
                })

                return (
                  <div
                    key={task.taskId}
                    className={cn(
                      "w-full rounded-md border border-dashed transition-colors",
                      isActive
                        ? "border-primary bg-primary/5"
                        : "hover:border-muted-foreground/40",
                    )}
                  >
                    <div className="flex items-start gap-2 p-3">
                      <button
                        type="button"
                        onClick={() => onSelectTask(task.taskId)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground inline-flex rounded-full border px-2 py-0.5 text-[11px]">
                            Archived
                          </span>
                        </div>

                        <p className="pt-2 text-sm font-medium">
                          {taskTitle}
                        </p>
                        <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 pt-2 text-[11px]">
                          <span>Created: {formatDateTime(task.createdAt)}</span>
                          <span>Archived: {formatDateTime(task.archivedAt)}</span>
                          <span>Status: {STATUS_META[task.status].label}</span>
                        </div>
                      </button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            aria-label={`Task actions for ${taskTitle}`}
                          >
                            <MoreHorizontalIcon className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            disabled={!canManageTask || deleteTaskMutation.isPending}
                            onClick={() => {
                              setTaskActionError(null)
                              setTaskPendingDelete({
                                taskId: task.taskId,
                                title: taskTitle,
                              })
                            }}
                          >
                            <Trash2Icon className="mr-2 size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
