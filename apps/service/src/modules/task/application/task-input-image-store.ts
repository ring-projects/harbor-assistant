export type SaveTaskInputFileInput = {
  projectPath: string
  name: string
  mediaType: string
  content: Buffer
}

export type SavedTaskInputFile = {
  path: string
  size: number
}

export interface TaskInputFileStore {
  save(input: SaveTaskInputFileInput): Promise<SavedTaskInputFile>
}

export type SaveTaskInputImageInput = SaveTaskInputFileInput
export type SavedTaskInputImage = SavedTaskInputFile
export type TaskInputImageStore = TaskInputFileStore
