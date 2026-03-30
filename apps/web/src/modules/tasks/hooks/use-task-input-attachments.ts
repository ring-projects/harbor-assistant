"use client"

import { useCallback } from "react"

import type { UploadedTaskInputImage } from "@/modules/tasks/lib"

import { useUploadTaskInputImageMutation } from "./use-task-queries"

type UseTaskInputAttachmentsArgs = {
  canUpload?: boolean
  projectId: string
  getAttachments: () => UploadedTaskInputImage[]
  onAttachmentsChange: (attachments: UploadedTaskInputImage[]) => void
}

export function useTaskInputAttachments(args: UseTaskInputAttachmentsArgs) {
  const { canUpload: canUploadArg, getAttachments, onAttachmentsChange, projectId } = args
  const uploadTaskInputImageMutation = useUploadTaskInputImageMutation(projectId)
  const canUpload = canUploadArg ?? true

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!canUpload || files.length === 0) {
        return []
      }

      const uploaded = await Promise.all(
        files.map((file) =>
          uploadTaskInputImageMutation.mutateAsync({
            file,
          }),
        ),
      )

      onAttachmentsChange([...getAttachments(), ...uploaded])

      return uploaded
    },
    [canUpload, getAttachments, onAttachmentsChange, uploadTaskInputImageMutation],
  )

  const removeAttachment = useCallback(
    (path: string) => {
      onAttachmentsChange(getAttachments().filter((attachment) => attachment.path !== path))
    },
    [getAttachments, onAttachmentsChange],
  )

  return {
    handleDropFiles: uploadFiles,
    handlePasteFiles: uploadFiles,
    isUploading: uploadTaskInputImageMutation.isPending,
    removeAttachment,
    uploadFiles,
    uploadTaskInputImageMutation,
  }
}
