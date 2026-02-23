"use server"

import { z } from "zod"

import {
  browseDirectory,
  FileBrowserServiceError,
} from "@/services/file-browser/file-browser.service"
import {
  createFileExplorerState,
  DEFAULT_FILE_EXPLORER_ROOT_DEPTH,
  DEFAULT_FILE_EXPLORER_VALUES,
  type FileExplorerState,
  type FileExplorerValues,
} from "@/services/file-browser/file-explorer-state"

const FormBooleanSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.toLowerCase() : value),
  z.stringbool({
    truthy: ["1", "true", "on"],
    falsy: ["0", "false", "off"],
  }),
)

function normalizeValues(formData: FormData): FileExplorerValues {
  const includeHiddenValue = formData.get("includeHidden")
  const parsedIncludeHidden = FormBooleanSchema.safeParse(includeHiddenValue)

  return {
    includeHidden: parsedIncludeHidden.success
      ? parsedIncludeHidden.data
      : false,
  }
}

type LoadDirectorySubtreeInput = {
  path: string
  depth: number
  includeHidden: boolean
}

type LoadDirectorySubtreeResponse =
  | {
      ok: true
      result: Awaited<ReturnType<typeof browseDirectory>>
    }
  | {
      ok: false
      error: string
    }

export async function loadDirectorySubtreeAction(
  input: LoadDirectorySubtreeInput,
): Promise<LoadDirectorySubtreeResponse> {
  try {
    const result = await browseDirectory({
      path: input.path,
      depth: input.depth,
      includeHidden: input.includeHidden,
    })

    return {
      ok: true,
      result,
    }
  } catch (error) {
    if (error instanceof FileBrowserServiceError) {
      return {
        ok: false,
        error: error.message,
      }
    }

    return {
      ok: false,
      error: "Unexpected error occurred while loading folder children.",
    }
  }
}

export async function browseDirectoryAction(
  previousState: FileExplorerState,
  formData: FormData,
): Promise<FileExplorerState> {
  const values = normalizeValues(formData)

  try {
    const result = await browseDirectory({
      includeHidden: values.includeHidden,
      depth: DEFAULT_FILE_EXPLORER_ROOT_DEPTH,
    })

    return createFileExplorerState({
      values,
      result,
    })
  } catch (error) {
    if (error instanceof FileBrowserServiceError) {
      return createFileExplorerState({
        values,
        result: previousState.result,
        error: error.message,
      })
    }

    return createFileExplorerState({
      values,
      result: previousState.result,
      error: "Unexpected error occurred while loading directory tree.",
    })
  }
}

export async function getInitialFileExplorerStateAction(): Promise<FileExplorerState> {
  try {
    const result = await browseDirectory({
      includeHidden: DEFAULT_FILE_EXPLORER_VALUES.includeHidden,
      depth: DEFAULT_FILE_EXPLORER_ROOT_DEPTH,
    })

    return createFileExplorerState({
      values: DEFAULT_FILE_EXPLORER_VALUES,
      result,
    })
  } catch (error) {
    return createFileExplorerState({
      values: DEFAULT_FILE_EXPLORER_VALUES,
      result: null,
      error:
        error instanceof FileBrowserServiceError
          ? error.message
          : "Failed to initialize file explorer.",
    })
  }
}
