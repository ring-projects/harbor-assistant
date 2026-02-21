"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { FormEvent } from "react"

import { createCodexTaskAction } from "@/app/actions/tasks"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type TaskRunnerFormProps = {
  workspaceId: string
}

export function TaskRunnerForm(props: TaskRunnerFormProps) {
  const { workspaceId } = props
  const router = useRouter()
  const [prompt, setPrompt] = useState("")
  const [model, setModel] = useState("")
  const [feedback, setFeedback] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)
  const [isPending, startTransition] = useTransition()

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedPrompt = prompt.trim()
    if (!trimmedPrompt) {
      setFeedback({
        type: "error",
        message: "Prompt cannot be empty.",
      })
      return
    }

    startTransition(async () => {
      const result = await createCodexTaskAction({
        workspaceId,
        prompt: trimmedPrompt,
        model: model.trim() || undefined,
      })

      if (!result.ok) {
        setFeedback({
          type: "error",
          message: result.error?.message ?? "Failed to create task.",
        })
        return
      }

      setPrompt("")
      setFeedback({
        type: "success",
        message: `Task created${result.taskId ? `: ${result.taskId}` : "."}`,
      })
      router.refresh()
    })
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <div className="space-y-1">
        <p className="text-sm font-medium">Prompt</p>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Describe the task for Codex..."
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 min-h-[120px] w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
          disabled={isPending}
          required
        />
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium">Model (optional)</p>
        <Input
          value={model}
          onChange={(event) => setModel(event.target.value)}
          placeholder='e.g. "o3"'
          disabled={isPending}
        />
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Starting..." : "Create & Run Task"}
        </Button>
      </div>

      {feedback ? (
        <div
          className={
            feedback.type === "error"
              ? "border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-xs"
              : "rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700"
          }
        >
          {feedback.message}
        </div>
      ) : null}
    </form>
  )
}
