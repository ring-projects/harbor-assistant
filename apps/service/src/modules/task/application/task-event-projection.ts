import type { TaskEventStream } from "./task-read-models"

export type GetTaskEventsInput = {
  taskId: string
  afterSequence?: number
  limit?: number
}

export interface TaskEventProjection {
  getTaskEvents(input: GetTaskEventsInput): Promise<TaskEventStream>
}
