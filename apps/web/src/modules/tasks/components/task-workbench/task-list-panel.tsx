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
import {
  useCreateTaskMutation,
  useProjectTaskListStream,
  useTaskListQuery,
} from "@/modules/tasks/hooks/use-task-queries"

import {
  formatDateTime,
  getErrorMessage,
  getPromptSummary,
  STATUS_META,
  truncateTaskId,
} from "./shared"

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
  const [isCreateComposerOpen, setIsCreateComposerOpen] = useState(false)
  const [newTaskPrompt, setNewTaskPrompt] = useState("")
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
      })

      setNewTaskPrompt("")
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
            <p className="text-muted-foreground text-xs">新建任务会开启一个新的 Codex thread</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setCreateTaskError(null)
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
              setCreateTaskError(null)
              setNewTaskPrompt("")
            }
          }}
        >
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
              <DialogDescription>
                输入初始化 prompt，创建一个新的 Codex thread。
              </DialogDescription>
            </DialogHeader>

            <form className="grid gap-3" onSubmit={handleCreateTask}>
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
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-xs">{truncateTaskId(task.taskId)}</p>
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
