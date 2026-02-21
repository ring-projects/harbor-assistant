import type { BrowseDirectoryResult } from "@/services/file-browser/types"

export type FileExplorerValues = {
  includeHidden: boolean
}

export type FileExplorerState = {
  values: FileExplorerValues
  result: BrowseDirectoryResult | null
  error: string | null
}

export const DEFAULT_FILE_EXPLORER_VALUES: FileExplorerValues = {
  includeHidden: false,
}

export const DEFAULT_FILE_EXPLORER_ROOT_DEPTH = 3

export function createFileExplorerState(args: {
  values: FileExplorerValues
  result: BrowseDirectoryResult | null
  error?: string | null
}): FileExplorerState {
  return {
    values: args.values,
    result: args.result,
    error: args.error ?? null,
  }
}
