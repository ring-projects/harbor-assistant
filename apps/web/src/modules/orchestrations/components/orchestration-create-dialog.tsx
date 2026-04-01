"use client"

import { PlusIcon } from "lucide-react"
import { type ReactNode, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { getErrorMessage } from "@/modules/tasks/view-models"
import { useCreateOrchestrationMutation } from "@/modules/orchestrations/hooks"

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
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [initPrompt, setInitPrompt] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const createMutation = useCreateOrchestrationMutation(projectId)

  function reset() {
    setTitle("")
    setDescription("")
    setInitPrompt("")
    setErrorMessage(null)
  }

  async function handleSubmit() {
    if (!title.trim()) {
      setErrorMessage("Enter a title before creating the orchestration.")
      return
    }

    try {
      setErrorMessage(null)
      const orchestration = await createMutation.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
        initPrompt: initPrompt.trim() || null,
      })
      reset()
      setOpen(false)
      onCreated(orchestration.id)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen && !createMutation.isPending) {
          reset()
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" size="sm" className="shrink-0">
            <PlusIcon className="size-4" />
            New Orchestration
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Orchestration</DialogTitle>
        </DialogHeader>

        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            void handleSubmit()
          }}
        >
          <label className="grid gap-2">
            <span className="text-sm font-medium">Title</span>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Runtime cleanup"
              disabled={createMutation.isPending}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium">Description</span>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What this orchestration is meant to coordinate."
              disabled={createMutation.isPending}
              rows={3}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium">Init Prompt</span>
            <Textarea
              value={initPrompt}
              onChange={(event) => setInitPrompt(event.target.value)}
              placeholder="Optional initial prompt template for new tasks in this orchestration."
              disabled={createMutation.isPending}
              rows={4}
            />
          </label>

          {errorMessage ? (
            <p className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {errorMessage}
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={createMutation.isPending}>
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
