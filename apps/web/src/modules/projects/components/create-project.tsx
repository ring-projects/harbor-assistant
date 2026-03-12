"use client"

import { DirectoryPicker } from "@/components/directory-picker"
import { cn } from "@/lib/utils"
import {
  getProjectActionError,
  useCreateProjectMutation,
} from "@/modules/projects/hooks"
import type { Project } from "@/modules/projects/types"

type CreateProjectProps = {
  className?: string
  submitLabel?: string
  cancelLabel?: string
  pickerTitle?: string | null
  defaultPath?: string
  defaultName?: string
  onCancel?: () => void
  onCreated?: (projects: Project[]) => void
}

export function CreateProject(props: CreateProjectProps) {
  const {
    className,
    submitLabel = "Confirm and Launch",
    cancelLabel = "Cancel",
    pickerTitle = "Select Project Directory",
    onCreated,
  } = props
  const createMutation = useCreateProjectMutation()

  async function handleConfirm(path: string) {
    try {
      const projects = await createMutation.mutateAsync({
        path,
        name: props.defaultName?.trim() || undefined,
      })

      onCreated?.(projects)
    } catch (error) {
      throw new Error(getProjectActionError(error))
    }
  }

  return (
    <DirectoryPicker
      className={cn(className)}
      initialPath={props.defaultPath}
      onConfirm={handleConfirm}
      onCancel={props.onCancel}
      confirmLabel={createMutation.isPending ? "Launching..." : submitLabel}
      cancelLabel={cancelLabel}
      disabled={createMutation.isPending}
      title={pickerTitle}
    />
  )
}
