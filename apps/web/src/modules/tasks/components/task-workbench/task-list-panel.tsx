"use client"

import {
  PlusIcon,
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
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useProjectSettingsQuery } from "@/modules/projects"
import {
  useCreateTaskMutation,
  useProjectTaskListStream,
  useTaskListQuery,
} from "@/modules/tasks/hooks/use-task-queries"

import {
  formatDateTime,
  formatExecutorLabel,
  formatExecutionModeLabel,
  getErrorMessage,
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
    label: "Connected",
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

export function TaskListPanel({
  projectId,
  selectedTaskId,
  onSelectTask,
}: TaskListPanelProps) {
  const projectSettingsQuery = useProjectSettingsQuery(projectId)
  const defaultExecutor = projectSettingsQuery.data?.defaultExecutor ?? "codex"
  const defaultExecutionMode =
    projectSettingsQuery.data?.defaultExecutionMode ?? "safe"
  const [isCreateComposerOpen, setIsCreateComposerOpen] = useState(false)
  const [newTaskPrompt, setNewTaskPrompt] = useState("")
  const [newTaskExecutor, setNewTaskExecutor] = useState<string>(defaultExecutor)
  const [newTaskExecutionMode, setNewTaskExecutionMode] = useState<
    "safe" | "connected" | "full-access"
  >(defaultExecutionMode)
  const [createTaskError, setCreateTaskError] = useState<string | null>(null)

  const createTaskMutation = useCreateTaskMutation(projectId)
  const listQuery = useTaskListQuery({
    projectId,
  })
  useProjectTaskListStream({
    projectId,
    enabled: true,
  })

  const allTasks = useMemo(() => {
    const tasks = listQuery.data ?? []
    return [...tasks].sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )
  }, [listQuery.data])

  const resolvedSelectedTaskId = useMemo(() => {
    if (allTasks.length === 0) {
      return null
    }

    if (selectedTaskId && allTasks.some((task) => task.taskId === selectedTaskId)) {
      return selectedTaskId
    }

    return allTasks[0].taskId
  }, [allTasks, selectedTaskId])

  useEffect(() => {
    if (resolvedSelectedTaskId !== selectedTaskId) {
      onSelectTask(resolvedSelectedTaskId)
    }
  }, [onSelectTask, resolvedSelectedTaskId, selectedTaskId])

  function resetCreateComposer() {
    setCreateTaskError(null)
    setNewTaskPrompt("")
    setNewTaskExecutor(defaultExecutor)
    setNewTaskExecutionMode(defaultExecutionMode)
  }

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const prompt = newTaskPrompt.trim()
    if (!prompt) {
      setCreateTaskError("请输入初始化 prompt。")
      return
    }

    try {
      setCreateTaskError(null)
      const result = await createTaskMutation.mutateAsync({
        prompt,
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

  return (
    <section className="bg-background min-h-0 p-3">
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Task List</p>
            <p className="text-muted-foreground text-xs">
              Create and revisit tasks for the selected executor.
            </p>
          </div>

          <div className="flex items-center gap-2">
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
              <DialogDescription>
                输入初始化 prompt，并选择要使用的执行器。
              </DialogDescription>
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
                            {option.value}
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

              <Textarea
                value={newTaskPrompt}
                onChange={(event) => setNewTaskPrompt(event.target.value)}
                placeholder="输入初始化 prompt"
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
                    setNewTaskExecutor("codex")
                    setNewTaskExecutionMode("safe")
                  }}
                  disabled={createTaskMutation.isPending}
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  disabled={createTaskMutation.isPending || newTaskPrompt.trim().length === 0}
                >
                  <PlusIcon className="size-4" />
                  {createTaskMutation.isPending ? "创建中..." : "创建"}
                </Button>
              </DialogFooter>
            </form>
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

          {!listQuery.isLoading && !listQuery.isError && allTasks.length === 0 ? (
            <div className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
              当前还没有任务。
            </div>
          ) : null}

          {!listQuery.isLoading && !listQuery.isError
            ? allTasks.map((task) => {
                const isActive = task.taskId === resolvedSelectedTaskId

                return (
                  <button
                    key={task.taskId}
                    type="button"
                    onClick={() => onSelectTask(task.taskId)}
                    className={cn(
                      "w-full rounded-md border p-3 text-left transition-colors",
                      isActive
                        ? "border-primary bg-primary/5"
                        : "hover:border-muted-foreground/40",
                    )}
                  >
                    <div className="flex items-center justify-end gap-2">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-0.5 text-[11px]",
                          STATUS_META[task.status].badgeClassName,
                        )}
                      >
                        {STATUS_META[task.status].label}
                      </span>
                    </div>

                    <p className="pt-2 text-sm">{getPromptSummary(task.prompt)}</p>

                    <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 pt-2 text-[11px]">
                      <span>创建：{formatDateTime(task.createdAt)}</span>
                      <span>Executor：{formatExecutorLabel(task.executor)}</span>
                      <span>Mode：{formatExecutionModeLabel(task.executionMode)}</span>
                      <span>Model：{task.model ?? "-"}</span>
                    </div>
                  </button>
                )
              })
            : null}
        </div>
      </div>
    </section>
  )
}
