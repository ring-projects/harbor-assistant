import { FileExplorer } from "@/components/file-explorer"
import {
  browseDirectory,
  FileBrowserServiceError,
} from "@/services/file-browser/file-browser.service"
import {
  createFileExplorerState,
  DEFAULT_FILE_EXPLORER_ROOT_DEPTH,
  DEFAULT_FILE_EXPLORER_VALUES,
} from "@/services/file-browser/file-explorer-state"

export default async function ChatsPage() {
  let initialState = createFileExplorerState({
    values: DEFAULT_FILE_EXPLORER_VALUES,
    result: null,
  })

  try {
    const result = await browseDirectory({
      includeHidden: DEFAULT_FILE_EXPLORER_VALUES.includeHidden,
      depth: DEFAULT_FILE_EXPLORER_ROOT_DEPTH,
    })
    initialState = createFileExplorerState({
      values: DEFAULT_FILE_EXPLORER_VALUES,
      result,
    })
  } catch (error) {
    initialState = createFileExplorerState({
      values: DEFAULT_FILE_EXPLORER_VALUES,
      result: null,
      error:
        error instanceof FileBrowserServiceError
          ? error.message
          : "Failed to initialize file explorer.",
    })
  }

  return (
    <div className="bg-muted/30 flex flex-1 p-4 md:p-6">
      <div className="mx-auto w-full max-w-6xl">
        <FileExplorer initialState={initialState} />
      </div>
    </div>
  )
}
